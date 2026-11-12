// CAP-18A candidate fixture protocol. Not connected to the gateway or Unreal.
// Raw input must already have been bounded by the transport before allocation.
import {createHash} from 'node:crypto';
import {validateCap18MetadataFreePng} from './cap18-png-strict.mjs';

const invalid=()=>{throw new Error('Invalid or uncorrelated bounded capture frame');};
const object=x=>x!==null && typeof x==='object' && !Array.isArray(x);
const keys=['version','requestId','editorEpoch','projectIdentity','worldPath','pieInstance',
  'width','height','pngBase64','pngSha256'];
const token=x=>typeof x==='string' && x.length>0 && x.length<=512 && !/[\u0000-\u001f\u007f]/u.test(x);
const integer=x=>Number.isSafeInteger(x) && x>0;

// Only a flat object of strings and integers is allowed; JSON.parse alone
// silently accepts duplicate keys, so scan each field before decoding it.
function parseFlatFrame(text) {
  let i=0; const out=Object.create(null);
  const ws=()=>{while(i<text.length && /[ \t\r\n]/u.test(text[i])) i++;};
  const string=()=>{
    if(text[i]!==String.fromCharCode(34)) invalid();
    const start=i++;
    while(i<text.length) {
      const c=text[i++];
      if(c===String.fromCharCode(34)) {
        try {return JSON.parse(text.slice(start,i));} catch {invalid();}
      }
      if(c==='\\') {if(i>=text.length) invalid();i++;}
    }
    invalid();
  };
  ws(); if(text[i++]!=='{') invalid(); ws();
  if(text[i]==='}') {i++;ws();if(i!==text.length) invalid();return out;}
  while(i<text.length) {
    ws();const key=string();if(Object.hasOwn(out,key)) invalid();
    ws();if(text[i++]!==':') invalid();ws();
    let value;
    if(text[i]===String.fromCharCode(34)) value=string();
    else {const match=/-?(?:0|[1-9][0-9]*)/uy;match.lastIndex=i;const found=match.exec(text);
      if(!found) invalid();i=match.lastIndex;value=Number(found[0]);if(!Number.isSafeInteger(value)) invalid();}
    out[key]=value;ws();
    if(text[i]==='}') {i++;ws();if(i!==text.length) invalid();return out;}
    if(text[i++]!==',') invalid();
  }
  invalid();
}

/** Parse a single already-received candidate frame under explicit fixture budgets.
 * The transport MUST independently enforce its limit before allocating the raw
 * frame. This does not implement a native protocol, prove a live marker, or
 * independently attest the editor/world. It is deliberately not a callable tool.
 */
export function parseCap18DirectFrame(raw,{requestId,editorEpoch,projectIdentity,worldPath,pieInstance},limits) {
  if (!object(limits) || !integer(limits.maxFrameBytes) || limits.maxFrameBytes>16*1024*1024
    || !integer(limits.maxImageBytes) || limits.maxImageBytes>8*1024*1024
    || !integer(limits.maxPixels) || limits.maxPixels>4*1024*1024
    || !integer(limits.maxDimension) || limits.maxDimension>4096) invalid();
  if (!/^[a-f0-9]{32}$/u.test(requestId) || !token(editorEpoch) || !token(projectIdentity)
    || !token(worldPath) || !worldPath.startsWith('/') || !Number.isSafeInteger(pieInstance) || pieInstance<0) invalid();
  if (!Buffer.isBuffer(raw) || raw.length===0 || raw.length>limits.maxFrameBytes) invalid();
  let frame;
  try { frame=parseFlatFrame(new TextDecoder('utf-8',{fatal:true}).decode(raw)); } catch {invalid();}
  if (!object(frame) || Object.keys(frame).length!==keys.length || keys.some(k=>!Object.hasOwn(frame,k))
    || frame.version!==1 || frame.requestId!==requestId || frame.editorEpoch!==editorEpoch
    || frame.projectIdentity!==projectIdentity || frame.worldPath!==worldPath || frame.pieInstance!==pieInstance
    || !integer(frame.width) || !integer(frame.height) || !/^[a-f0-9]{64}$/u.test(frame.pngSha256)
    || typeof frame.pngBase64!=='string') invalid();
  const b64=frame.pngBase64;
  const maxBase64=4*Math.ceil(limits.maxImageBytes/3);
  if (!b64.length || b64.length>maxBase64 || b64.length%4!==0
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(b64)) invalid();
  const png=Buffer.from(b64,'base64');
  if (png.length>limits.maxImageBytes || png.toString('base64')!==b64
    || createHash('sha256').update(png).digest('hex')!==frame.pngSha256) invalid();
  try {validateCap18MetadataFreePng(png,{width:frame.width,height:frame.height,
    maxBytes:limits.maxImageBytes,maxPixels:limits.maxPixels,maxDimension:limits.maxDimension});} catch {invalid();}
  // Preserve the parsed candidate fields (not original JSON bytes) and provide
  // an image block. Neither proves live capture or authenticated identity.
  return {receipt:{...frame},image:{type:'image',mimeType:'image/png',data:b64}};
}
