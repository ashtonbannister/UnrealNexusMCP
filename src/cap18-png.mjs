// CAP-18A fixture-stage validator. Not wired to a callable operation.
// Supports only 8-bit non-interlaced RGB/RGBA PNG; no claim about other PNGs.
import {inflateSync} from 'node:zlib';

const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const CRC_TABLE=Array.from({length:256},(_,i)=>{
  let c=i; for(let j=0;j<8;j++) c=(c&1)?0xedb88320^(c>>>1):c>>>1; return c>>>0;
});
function crc32(data) {
  let c=0xffffffff; for(const byte of data) c=CRC_TABLE[(c^byte)&255]^(c>>>8);
  return (c^0xffffffff)>>>0;
}
const invalid=()=>{throw new Error('Invalid or unsupported bounded PNG');};

/** Validate an untrusted capture against caller-supplied limits and receipt.
 *  This accepts a deliberately narrow image format, bounds inflate, verifies
 *  every chunk CRC and scanline filter, and returns dimensions only. It does not
 *  authenticate a native receipt, decode pixels, or prove the image is fresh.
 */
export function validateCap18Png(png,{width,height,maxBytes,maxPixels,maxDimension}) {
  for (const n of [width,height,maxBytes,maxPixels,maxDimension])
    if(!Number.isSafeInteger(n)||n<1) invalid();
  if(!Buffer.isBuffer(png)||png.length>maxBytes||png.length<45||!png.subarray(0,8).equals(SIGNATURE)) invalid();
  let offset=8,header=false,end=false,seenIdat=false,afterIdat=false,palette=false;
  let channels=0; const idat=[]; let compressedBytes=0;
  while(offset<png.length) {
    if(png.length-offset<12) invalid();
    const length=png.readUInt32BE(offset);
    if(length>png.length-offset-12) invalid();
    const typeBytes=png.subarray(offset+4,offset+8);
    if(![...typeBytes].every(c=>(c>=65&&c<=90)||(c>=97&&c<=122)) || (typeBytes[2]&32)) invalid();
    const type=typeBytes.toString('ascii');
    const data=png.subarray(offset+8,offset+8+length);
    if(crc32(png.subarray(offset+4,offset+8+length))!==png.readUInt32BE(offset+8+length)) invalid();
    offset+=12+length;
    if(!header && type!=='IHDR') invalid();
    if(type==='IHDR') {
      if(header||length!==13) invalid();
      header=true;
      const w=data.readUInt32BE(0),h=data.readUInt32BE(4),depth=data[8],color=data[9];
      if(w!==width||h!==height||w>maxDimension||h>maxDimension||w>Math.floor(maxPixels/h)
        ||depth!==8||![2,6].includes(color)||data[10]!==0||data[11]!==0||data[12]!==0) invalid();
      channels=color===2?3:4;
    } else if(type==='IDAT') {
      if(afterIdat||end) invalid();
      seenIdat=true; compressedBytes+=length; if(compressedBytes>maxBytes) invalid(); idat.push(data);
    } else if(type==='IEND') {
      if(!seenIdat||end||length!==0||offset!==png.length) invalid(); end=true;
    } else {
      if(seenIdat) afterIdat=true;
      if(type==='PLTE') {
        if(palette||seenIdat||length===0||length>768||length%3!==0) invalid(); palette=true;
      } else if((typeBytes[0]&32)===0 || ['acTL','fcTL','fdAT'].includes(type)) invalid();
    }
    if(end) break;
  }
  if(!end||!seenIdat||!compressedBytes) invalid();
  const rowBytes=width*channels; const rawBytes=(rowBytes+1)*height;
  if(!Number.isSafeInteger(rawBytes)||rawBytes>maxPixels*4+height) invalid();
  let decoded,used;
  try {
    const result=inflateSync(Buffer.concat(idat,compressedBytes),{maxOutputLength:rawBytes,info:true});
    decoded=result.buffer; used=result.engine.bytesWritten;
  } catch { invalid(); }
  if(decoded.length!==rawBytes||used!==compressedBytes) invalid();
  for(let row=0;row<height;row++) if(decoded[row*(rowBytes+1)]>4) invalid();
  return {width,height,colorType:channels===3?2:6};
}
