import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {validateCap18Png} from '../src/cap18-png.mjs';

const sig=Buffer.from([137,80,78,71,13,10,26,10]);
function crc(data){let c=0xffffffff;for(const byte of data){c^=byte;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;}return (c^0xffffffff)>>>0;}
function chunk(type,data){const tag=Buffer.from(type);const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);tag.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(out.subarray(4,8+data.length)),8+data.length);return out;}
function png({w=2,h=1,color=6,raw=Buffer.from([0,1,2,3,4,5,6,7,8]),extra=[],compressed}={}){
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=color;
 return Buffer.concat([sig,chunk('IHDR',ihdr),...extra,chunk('IDAT',compressed??deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const limits={width:2,height:1,maxBytes:2048,maxPixels:100,maxDimension:16};

test('bounded supported PNG validates receipt dimensions and compressed scanline structure',()=>{
 const bytes=png();const before=Buffer.from(bytes);
 assert.deepEqual(validateCap18Png(bytes,limits),{width:2,height:1,colorType:6});
 assert.deepEqual(bytes,before);
 assert.throws(()=>validateCap18Png(bytes,{...limits,width:1}));
 assert.throws(()=>validateCap18Png(bytes,{...limits,maxPixels:1}));
 assert.throws(()=>validateCap18Png(bytes,{...limits,maxBytes:bytes.length-1}));
});

test('rejects corruption, unsupported dimensions and malformed chunk framing',()=>{
 const badCrc=png();badCrc[29]^=1;assert.throws(()=>validateCap18Png(badCrc,limits));
 const good=png();assert.throws(()=>validateCap18Png(good.subarray(0,-1),limits));
 assert.throws(()=>validateCap18Png(Buffer.concat([good,Buffer.from([0])]),limits));
 assert.throws(()=>validateCap18Png(png({extra:[chunk('ABCD',Buffer.alloc(0))]}),limits));
 assert.throws(()=>validateCap18Png(png({extra:[chunk('acTL',Buffer.alloc(8))]}),limits));
 const huge=png({w:0xffffffff,h:1});
 assert.throws(()=>validateCap18Png(huge,{...limits,width:0xffffffff}));
});

test('bounded inflate refuses bombs, extra streams, malformed rows and invalid filters',()=>{
 for(const raw of [Buffer.alloc(8),Buffer.alloc(10),Buffer.from([5,1,2,3,4,5,6,7,8]),Buffer.alloc(100000)])
   assert.throws(()=>validateCap18Png(png({raw}),limits));
 const stream=deflateSync(Buffer.from([0,1,2,3,4,5,6,7,8]));
 assert.throws(()=>validateCap18Png(png({compressed:Buffer.concat([stream,Buffer.from([0])])}),limits));
 assert.throws(()=>validateCap18Png(png({compressed:Buffer.from([1,2,3])}),limits));
});
