// Offline structural review only. This does not inspect an editor or establish truth.
import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import compatibility from '../catalog/compatibility-patches.json' with {type:'json'};
import {loadCatalog} from '../src/catalog.mjs';
import {compatibilitySatisfied} from '../src/compatibility.mjs';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const present = value => typeof value === 'string' && value.trim().length > 0;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const revision = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const outcomes = new Set(['pass','fail','blocked','not-run']);
// A reference is an identifier relative to an operator-controlled evidence root.
// This lexical check does not resolve symlinks or read or validate artifact bytes.
function safeReference(value) {
  return present(value) && !value.startsWith('/') && !value.includes('\\')
    && !/^[a-z][a-z0-9+.-]*:/i.test(value) && !/[\x00-\x1f\x7f]/.test(value)
    && value.split('/').every(part => part && part !== '.' && part !== '..');
}
export function validateQualificationManifest(manifest, {catalog = loadCatalog()} = {}) {
  const errors=[];
  const requireField=(ok,field)=>{if(!ok) errors.push(field);};
  if (!record(manifest)) return {valid:false, errors:['manifest must be an object']};
  requireField(manifest.schema_version===1,'schema_version must be 1');
  requireField(present(manifest.run_id),'run_id required');
  requireField(outcomes.has(manifest.status),'status must be pass, fail, blocked or not-run');
  requireField(Array.isArray(manifest.cases),'cases must be an array');
  const profile=record(manifest.profile)?manifest.profile:{};
  const enabled=Array.isArray(profile.enabled_operations)?profile.enabled_operations:[];
  requireField(Array.isArray(profile.enabled_operations),'profile.enabled_operations must be an array');
  const seen=new Set();
  for(const id of enabled) {
    try { catalog.get(id); } catch {errors.push('profile contains unknown operation');}
    if(seen.has(id)) errors.push('profile contains duplicate operation');
    seen.add(id);
  }
  const providers=Array.isArray(profile.providers)?profile.providers:[];
  requireField(Array.isArray(profile.providers),'profile.providers must be an array');
  const providerSet=new Set();
  for(const provider of providers) {
    if(typeof provider!=='string' || !Object.hasOwn(catalog.upstreams.sources,provider)) errors.push('profile contains unknown provider');
    if(providerSet.has(provider)) errors.push('profile contains duplicate provider');
    providerSet.add(provider);
  }
  for (const [index,item] of (Array.isArray(manifest.cases)?manifest.cases:[]).entries()) {
    const prefix='cases['+index+']';
    if (!record(item)) { errors.push(prefix+' must be an object'); continue; }
    requireField(outcomes.has(item.outcome),prefix+'.outcome invalid');
    let operation;
    if(item.operation!==null && item.operation!==undefined) {
      try {operation=catalog.get(item.operation);} catch {errors.push(prefix+'.operation unknown');}
      requireField(seen.has(item.operation),prefix+'.operation not enabled in profile');
    }
    for(const field of ['preconditions','before_artifacts','after_artifacts','owned_resources','cleanup_actions','unresolved']) {
      requireField(Array.isArray(item[field]),prefix+'.'+field+' must be an array');
    }
    if(item.receipt_artifact!==null && item.receipt_artifact!==undefined) {
      requireField(safeReference(item.receipt_artifact),prefix+'.receipt_artifact must be a relative evidence reference');
      requireField(hash(item.receipt_sha256),prefix+'.receipt_sha256 must be SHA-256');
    } else if(item.receipt_sha256!==null && item.receipt_sha256!==undefined) errors.push(prefix+'.receipt_sha256 requires a receipt reference');
    if(['fail','blocked'].includes(item.outcome)) requireField(present(item.reason),prefix+'.reason required for fail or blocked');
    if(item.outcome==='pass') {
      requireField(present(item.operation),prefix+'.operation required for pass');
      requireField(present(item.case),prefix+'.case required for pass');
      requireField(item.applicability==='applicable',prefix+'.applicability must be applicable for pass');
      requireField(['positive','negative'].includes(item.case_kind),prefix+'.case_kind must be positive or negative for pass');
      requireField(operation && item.provider===operation.provider,prefix+'.provider must match the selected operation provider');
      requireField(operation && item.provider_pin===catalog.upstreams.sources[operation.provider]?.commit,prefix+'.provider_pin must match the selected provider lock');
      if(operation?.requiredCompatibility) {
        // Omitted patch ID preserves legacy v1 evidence; newer variants must
        // be explicitly named and satisfy the narrowly reviewed relation.
        const actual=item.compatibility_patch ?? operation.requiredCompatibility;
        const allowed=compatibilitySatisfied(operation.provider,operation.requiredCompatibility,actual);
        const patch=allowed && compatibility.patches.find(p=>p.id===actual && p.provider===operation.provider && p.baseCommit===item.provider_pin);
        requireField(Boolean(patch) && item.patch_sha256===patch.sha256,prefix+'.patch_sha256 must match the selected compatibility patch');
        // These are assertions only; no live marker or loaded binary is checked.
        requireField(Boolean(patch) && isDeepStrictEqual(item.live_marker,patch.capabilityMarker),prefix+'.live_marker must match the selected compatibility marker');
        if (['uap-nexus-strict-status-v2','uap-nexus-queued-status-v3','uap-nexus-owned-pie-v4'].includes(actual)) {
          const v1=compatibility.patches.find(p=>p.id==='uap-nexus-no-replay-v1' && p.provider===operation.provider);
          requireField(Boolean(v1) && isDeepStrictEqual(item.no_replay_marker,v1.capabilityMarker),prefix+'.no_replay_marker must match the v1 no-replay marker');
        }
        if (actual==='uap-nexus-owned-pie-v4') {
          const v3=compatibility.patches.find(p=>p.id==='uap-nexus-queued-status-v3' && p.provider===operation.provider);
          requireField(Boolean(v3) && isDeepStrictEqual(item.strict_status_marker,v3.capabilityMarker),prefix+'.strict_status_marker must match the v3 marker');
        }
      }
      requireField(Array.isArray(profile.providers) && profile.providers.includes(item.provider),prefix+'.provider must be declared in profile');
      requireField(hash(item.loaded_artifact_sha256),prefix+'.loaded_artifact_sha256 required for pass');
      requireField(present(item.target_identity),prefix+'.target_identity required for pass');
      requireField(Number.isInteger(item.dispatch_count) && item.dispatch_count>=0,prefix+'.dispatch_count required for pass');
      if(item.dispatch_count>0) requireField(safeReference(item.receipt_artifact) && hash(item.receipt_sha256),prefix+'.receipt required when dispatched');
      requireField(Array.isArray(item.unresolved) && item.unresolved.length===0,prefix+'.unresolved must be empty for pass');
    }
  }
  if(manifest.status==='pass' || (Array.isArray(manifest.cases) && manifest.cases.some(c=>c?.outcome==='pass'))) {
    requireField(revision(manifest.nexus_commit),'nexus_commit required for pass');
    requireField(hash(manifest.lockfile_sha256),'lockfile_sha256 required for pass');
    for(const field of ['os','architecture','engine_build','compiler_sdk','node','python']) requireField(present(manifest.platform?.[field]),'platform.'+field+' required for pass');
    for(const field of ['revision','disposable_copy_id']) requireField(present(manifest.project?.[field]),'project.'+field+' required for pass');
    requireField(hash(manifest.project?.baseline_manifest_sha256),'project.baseline_manifest_sha256 required for pass');
    requireField(present(profile.transport) && Array.isArray(profile.providers) && profile.providers.length>0,'profile transport and providers required for pass');
    requireField(present(manifest.target?.project_identity) && Number.isInteger(manifest.target?.editor_pid) && manifest.target.editor_pid>0 && present(manifest.target?.editor_start_epoch),'target identity, pid and epoch required for pass');
    requireField(present(manifest.reviewer) && present(manifest.qualification_scope),'reviewer and qualification_scope required for pass');
  }
  // A run may be partial, but an overall pass requires a dispatched positive
  // observation for each enabled operation. This is not full coverage proof.
  if(manifest.status==='pass') {
    const requiredProviders=new Set();
    for(const id of enabled) {try {requiredProviders.add(catalog.get(id).provider);} catch { /* Reported above. */ }}
    requireField(providerSet.size===requiredProviders.size && [...requiredProviders].every(p=>providerSet.has(p)),'profile providers must exactly match enabled operation providers for pass');
    requireField(Array.isArray(manifest.cases) && manifest.cases.length>0 && manifest.cases.every(c=>c?.outcome==='pass'),'all recorded cases must pass for pass status');
    requireField(enabled.length>0 && enabled.every(id=>manifest.cases?.some(c=>c?.operation===id && c?.outcome==='pass' && c?.applicability==='applicable' && c?.case_kind==='positive' && Number.isInteger(c?.dispatch_count) && c.dispatch_count>0)),'each enabled operation needs an applicable dispatched positive case');
  }
  return {valid:errors.length===0,errors};
}
async function main() {
  if(process.argv.length!==3) {console.error('Usage: node scripts/qualification-evidence.mjs <manifest.json>');process.exitCode=2;return;}
  try {
    const file=await open(process.argv[2],constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
    let manifest;
    try {
      if (!(await file.stat()).isFile()) throw new Error('Manifest must be a file');
      const buffer=Buffer.alloc(1024*1024+1);
      let length=0;
      while (length<buffer.length) {
        const {bytesRead}=await file.read(buffer,length,buffer.length-length,null);
        if (!bytesRead) break;
        length+=bytesRead;
      }
      if (length>1024*1024) throw new Error('Manifest too large');
      manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,length)));
    } finally { await file.close(); }
    const result=validateQualificationManifest(manifest);
    console.log(JSON.stringify({...result,scope:'structural check only; no native qualification or artifact verification'},null,2));
    if(!result.valid) process.exitCode=1;
  } catch {console.error('Could not read or parse manifest.');process.exitCode=2;}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) await main();
