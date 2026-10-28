// Fixture-stage PNG compressed-scanline integrity check; not a decoder.
// PNG layout: https://www.w3.org/TR/png/ (static images, including Adam7).
// Caller MUST enforce transport bounds before allocating the received buffer.
import {inflateSync} from 'node:zlib';
import {constants as bufferConstants} from 'node:buffer';

const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const legal=new Map([[0,[1,2,4,8,16]],[2,[8,16]],[3,[1,2,4,8]],[4,[8,16]],[6,[8,16]]]);
const channels=new Map([[0,1],[2,3],[3,1],[4,2],[6,4]]);
const adam7=[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]];
const invalid=()=>{throw new Error('Invalid or unsupported bounded PNG scanlines');};
const positive=n=>Number.isSafeInteger(n) && n>0;
const table=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++) c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes) {let c=0xffffffff;for(const byte of bytes)c=table[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
const passSize=(size,start,step)=>size<=start?0:Math.ceil((size-start)/step);

/** Check bounded static PNG framing and zlib scanline integrity.
 * Does not reconstruct pixels, check palette indices after unfiltering, validate
 * every ancillary chunk, authenticate the source or establish actual rendering.
 * Animated PNG is intentionally refused. Limits bound this function only: the
 * encoded input is already allocated, and zlib/Node retain internal overhead.
 */
export function validatePngScanlineIntegrity(png,{width,height,maxEncodedBytes,maxPixels,maxInflatedBytes,maxDimension,maxChunks}) {
  for(const n of [width,height,maxEncodedBytes,maxPixels,maxInflatedBytes,maxDimension,maxChunks]) if(!positive(n)) invalid();
  if(maxChunks>4096 || maxEncodedBytes>bufferConstants.MAX_LENGTH || maxInflatedBytes>bufferConstants.MAX_LENGTH
    || width>0x7fffffff || height>0x7fffffff || width>maxDimension || height>maxDimension
    || width>Math.floor(maxPixels/height)) invalid();
  if(!Buffer.isBuffer(png)||png.length>maxEncodedBytes||png.length<45||!png.subarray(0,8).equals(signature)) invalid();
  let offset=8,seenHeader=false,seenIdat=false,idatClosed=false,seenEnd=false,seenPalette=false,chunkCount=0;
  let color,depth,interlace; const chunks=[]; let compressedBytes=0;
  while(offset<png.length) {
    if(++chunkCount>maxChunks || png.length-offset<12) invalid();
    const length=png.readUInt32BE(offset);if(length>png.length-offset-12) invalid();
    const tag=png.subarray(offset+4,offset+8);
    if(![...tag].every(c=>(c>=65&&c<=90)||(c>=97&&c<=122)) || (tag[2]&32)) invalid();
    const type=tag.toString('ascii'), data=png.subarray(offset+8,offset+8+length);
    if(crc32(png.subarray(offset+4,offset+8+length))!==png.readUInt32BE(offset+8+length)) invalid();
    offset+=length+12;
    if(!seenHeader && type!=='IHDR') invalid();
    if(type==='IHDR') {
      if(seenHeader||length!==13 || data.readUInt32BE(0)!==width || data.readUInt32BE(4)!==height) invalid();
      seenHeader=true;depth=data[8];color=data[9];interlace=data[12];
      if(!legal.has(color)||!legal.get(color).includes(depth)||data[10]!==0||data[11]!==0||![0,1].includes(interlace)) invalid();
    } else if(type==='PLTE') {
      if(seenPalette||seenIdat||[0,4].includes(color)||length===0||length>768||length%3!==0
        || (color===3 && length/3>2**depth)) invalid();
      seenPalette=true;
    } else if(type==='IDAT') {
      if(idatClosed || (color===3&&!seenPalette)) invalid();
      seenIdat=true;compressedBytes+=length;if(compressedBytes>maxEncodedBytes) invalid();chunks.push(data);
    } else if(type==='IEND') {
      if(!seenIdat||compressedBytes===0||length!==0||offset!==png.length) invalid();seenEnd=true;break;
    } else {
      if(seenIdat) idatClosed=true;
      if((tag[0]&32)===0 || ['acTL','fcTL','fdAT'].includes(type)) invalid();
    }
  }
  if(!seenHeader||!seenIdat||!seenEnd) invalid();
  const passes=interlace===0?[[0,0,1,1]]:adam7;
  const spans=[];let rawBytes=0;
  for(const [x,y,dx,dy] of passes) {
    const w=passSize(width,x,dx),h=passSize(height,y,dy);if(!w||!h) continue;
    const bits=w*channels.get(color)*depth;
    if(!Number.isSafeInteger(bits)) invalid();
    const rowBytes=Math.ceil(bits/8), bytes=(rowBytes+1)*h;
    if(!Number.isSafeInteger(bytes)||bytes>maxInflatedBytes-rawBytes) invalid();
    spans.push({rowBytes,height:h});rawBytes+=bytes;
  }
  if(!rawBytes) invalid();
  let output,used;
  try {const info=inflateSync(Buffer.concat(chunks,compressedBytes),{maxOutputLength:rawBytes,info:true});output=info.buffer;used=info.engine.bytesWritten;}
  catch {invalid();}
  if(output.length!==rawBytes||used!==compressedBytes) invalid();
  let at=0;for(const span of spans) for(let y=0;y<span.height;y++) {if(output[at]>4) invalid();at+=span.rowBytes+1;}
  return {width,height,colorType:color,bitDepth:depth,interlace,encodedBytes:png.length,inflatedBytes:rawBytes};
}
