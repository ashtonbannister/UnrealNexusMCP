import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {NexusError} from './errors.mjs';
import {windowsProcessEvidence, localEndpoint} from './provider-probes.mjs';

// Fixed line protocol: generated request id, operation, validated PID and
// optional port. No paths or caller-controlled script fragments are accepted.
const WORKER_SCRIPT = `
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
while ($null -ne ($line = [Console]::In.ReadLine())) {
  if ($line -notmatch '^([a-f0-9]{16}):(p|l):([1-9][0-9]{0,9})(?::([0-9]{1,5}))?$') { exit 3 }
  $requestId = $Matches[1]
  $operation = $Matches[2]
  $nexusPid = [int]$Matches[3]
  $nexusPort = if ($Matches[4]) { [int]$Matches[4] } else { -1 }
  try {
    if ($operation -eq 'l') {
      if ($nexusPort -lt 0 -or $nexusPort -gt 65535) { throw "Invalid port" }
      $owners = @(Get-NetTCPConnection -State Listen -LocalPort $nexusPort -ErrorAction Stop |
        Select-Object -ExpandProperty OwningProcess -Unique)
      $reply = [pscustomobject]@{id=$requestId; ok=$true; owners=@($owners)}
      [Console]::Out.WriteLine(($reply | ConvertTo-Json -Depth 4 -Compress))
      continue
    }
    if ($nexusPort -ne -1) { throw "Unexpected port" }
    $before = [System.Diagnostics.Process]::GetProcessById($nexusPid).StartTime.ToUniversalTime().Ticks.ToString()
    $procRow = Get-CimInstance Win32_Process -Filter "ProcessId = $nexusPid" -ErrorAction Stop
    if ($null -eq $procRow) { throw "Process missing" }
    $process = [pscustomobject]@{processId=[int]$procRow.ProcessId; executablePath=$procRow.ExecutablePath;
      commandLine=$procRow.CommandLine; startTicks=$procRow.CreationDate.ToUniversalTime().Ticks.ToString()}
    $after = [System.Diagnostics.Process]::GetProcessById($nexusPid).StartTime.ToUniversalTime().Ticks.ToString()
    $reply = [pscustomobject]@{id=$requestId; ok=$true; snapshot=[pscustomobject]@{beforeTicks=$before; process=$process; afterTicks=$after}}
  } catch {
    $reply = [pscustomobject]@{id=$requestId; ok=$false}
  }
  [Console]::Out.WriteLine(($reply | ConvertTo-Json -Depth 4 -Compress))
}
`;

const MAX_REPLY_BYTES = 1024 * 1024;
const validPid = pid => Number.isSafeInteger(pid) && pid > 0 && pid <= 0x7fffffff;
const failure = message => new NexusError('IDENTITY_UNPROVEN',message);

/** Trusted runtime helper. It never restarts or retries a failed request. */
export function createWindowsProcessInspector({spawnProcess=spawn,timeoutMs=5000,closeTimeoutMs=5000} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000
    || !Number.isInteger(closeTimeoutMs) || closeTimeoutMs < 100 || closeTimeoutMs > 60000)
    throw new NexusError('INVALID_CONFIGURATION','Invalid process inspector timeout.');
  let child,closed=false,broken=false,active=null,buffer='',bufferBytes=0,tail=Promise.resolve(),closePromise;
  let resolveClosed,workerClosed;
  const decoder = new TextDecoder('utf-8',{fatal:true});

  function failWorker(message) {
    if (broken) return;
    broken=true;
    if (active) {const pending=active;active=null;clearTimeout(pending.timer);pending.reject(failure(message));}
    try {child?.kill();} catch { /* close() still verifies termination */ }
  }
  function onData(chunk) {
    if (closed || broken) return;
    try {
      if (!Buffer.isBuffer(chunk)) throw new Error('non-buffer');
      bufferBytes+=chunk.length;
      if (bufferBytes>MAX_REPLY_BYTES) throw new Error('too-large');
      buffer+=decoder.decode(chunk,{stream:true});
      let newline;
      while ((newline=buffer.indexOf('\n'))!==-1) {
        const line=buffer.slice(0,newline).replace(/\r$/u,'');
        buffer=buffer.slice(newline+1);
        bufferBytes=Buffer.byteLength(buffer,'utf8');
        if (!active || !line) throw new Error('unsolicited');
        const reply=JSON.parse(line), pending=active;
        if (!reply || typeof reply!=='object' || Array.isArray(reply)
          || reply.id!==pending.id || typeof reply.ok!=='boolean') throw new Error('crossed');
        active=null;clearTimeout(pending.timer);
        if (!reply.ok) pending.reject(failure('Windows process could not be inspected.'));
        else {
          try {
            if (pending.kind === 'p') pending.resolve(windowsProcessEvidence(pending.pid,reply.snapshot));
            else {
              if (!Array.isArray(reply.owners) || reply.owners.length !== 1 || reply.owners[0] !== pending.pid)
                throw failure('Listening socket is not uniquely owned by the selected editor.');
              pending.resolve({processId:pending.pid,port:pending.port,method:'windows-tcp-owner'});
            }
          } catch (error) {pending.reject(error);}
        }
      }
    } catch {failWorker('Windows process inspector returned malformed or uncorrelated data.');}
  }
  function start() {
    if (child) return;
    workerClosed=new Promise(resolve=>{resolveClosed=resolve;});
    try {
      child=spawnProcess('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',WORKER_SCRIPT],
        {windowsHide:true,stdio:['pipe','pipe','pipe']});
      child.on('close',()=>{resolveClosed();if(!closed)failWorker('Windows process inspector exited.');});
      child.on('error',()=>failWorker('Windows process inspector failed to start.'));
      child.stdout.on('data',onData);
      child.stderr.resume();
      child.stdin.on('error',()=>failWorker('Windows process inspector input failed.'));
    } catch {
      broken=true;
      if (child) {try {child.kill();} catch { /* close() reports unconfirmed cleanup */ }}
      else resolveClosed();
      throw failure('Windows process inspector failed to start.');
    }
  }
  async function request(kind,pid,port) {
    if (closed || broken) throw failure('Windows process inspector is unavailable.');
    start();
    if (broken) throw failure('Windows process inspector is unavailable.');
    const id=randomBytes(8).toString('hex');
    return await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>failWorker('Windows process inspection timed out.'),timeoutMs);
      active={id,kind,pid,port,resolve,reject,timer};
      try {child.stdin.write(id+':'+kind+':'+pid+(kind==='l'?':'+port:'')+'\n',error=>{if(error)failWorker('Windows process inspector input failed.');});}
      catch {failWorker('Windows process inspector input failed.');}
    });
  }
  function inspect(pid) {
    if (!validPid(pid)) return Promise.reject(failure('A positive editor processId is required.'));
    const job=tail.then(()=>request('p',pid));
    tail=job.catch(()=>{});
    return job;
  }
  function inspectListener(endpoint,pid) {
    let port;
    try {({port}=localEndpoint(endpoint));} catch (error) {return Promise.reject(error);}
    if (!validPid(pid)) return Promise.reject(failure('Invalid listener owner PID.'));
    const job=tail.then(()=>request('l',pid,port));
    tail=job.catch(()=>{});
    return job;
  }
  function close() {
    if (closePromise) return closePromise;
    closed=true;
    closePromise=(async()=>{
      if (!child) return;
      if (active) {const pending=active;active=null;clearTimeout(pending.timer);pending.reject(failure('Windows process inspector closed.'));}
      try {child.stdin.end();} catch { /* wait for confirmed exit below */ }
      let timer;
      try {
        await Promise.race([workerClosed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new NexusError(
          'PROCESS_INSPECTOR_CLOSE_TIMEOUT','Windows process inspector did not exit.')),closeTimeoutMs);})]);
      } catch (error) {
        try {child.kill();} catch { /* cleanup remains unconfirmed */ }
        throw error;
      } finally {clearTimeout(timer);}
    })();
    return closePromise;
  }
  return {inspect,inspectListener,close};
}
