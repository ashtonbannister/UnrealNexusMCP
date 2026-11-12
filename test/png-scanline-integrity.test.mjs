import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {validatePngScanlineIntegrity} from '../src/png-scanline-integrity.mjs';
const sig=Buffer.from([137,80,78,71,13,10,26,10]);
function chunk(type,data){const tag=Buffer.from(type),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);tag.copy(b,4);data.copy(b,8);let c=0xffffffff;for(const byte of b.subarray(4,8+data.length)){c^=byte;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;}b.writeUInt32BE((c^0xffffffff)>>>0,8+data.length);return b;}
function png({width=1,height=1,depth=8,color=6,interlace=0,raw=Buffer.from([0,1,2,3,4]),extras=[],compressed}={}){
 const h=Buffer.alloc(13);h.writeUInt32BE(width,0);h.writeUInt32BE(height,4);h[8]=depth;h[9]=color;h[12]=interlace;
 return Buffer.concat([sig,chunk('IHDR',h),...extras,chunk('IDAT',compressed??deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const limits={width:1,height:1,maxEncodedBytes:4096,maxPixels:64,maxInflatedBytes:512,maxDimension:16,maxChunks:32};

test('valid static RGBA, packed grayscale, indexed and Adam7 scanlines are accepted under explicit limits',()=>{
 for(const x of [png(),png({color:0,depth:1,raw:Buffer.from([0,0x80])}),
   png({color:3,depth:1,raw:Buffer.from([0,0]),extras:[chunk('PLTE',Buffer.from([0,0,0]))]}),
   png({interlace:1})]) {
   const prior=Buffer.from(x);assert.equal(validatePngScanlineIntegrity(x,limits).width,1);assert.deepEqual(x,prior);
 }
});
test('Adam7 validates every nonempty pass, including later pass filter bytes',()=>{
 const raw=Buffer.from([0,1,2,3,4, 0,5,6,7,8, 0,9,10,11,12,13,14,15,16]);
 const twoByTwo={...limits,width:2,height:2};
 assert.equal(validatePngScanlineIntegrity(png({width:2,height:2,interlace:1,raw}),twoByTwo).inflatedBytes,19);
 const invalid=Buffer.from(raw);invalid[10]=5;
 assert.throws(()=>validatePngScanlineIntegrity(png({width:2,height:2,interlace:1,raw:invalid}),twoByTwo));
});
test('invalid compression, excess bytes, bad scanlines and trailing streams are refused',()=>{
 for(const compressed of [Buffer.from('broken'),deflateSync(Buffer.alloc(10000)),Buffer.concat([deflateSync(Buffer.from([0,1,2,3,4])),Buffer.from([0])])])
  assert.throws(()=>validatePngScanlineIntegrity(png({compressed}),limits));
 assert.throws(()=>validatePngScanlineIntegrity(png({raw:Buffer.from([5,1,2,3,4])}),limits));
 assert.throws(()=>validatePngScanlineIntegrity(png(),{...limits,maxInflatedBytes:4}));
 assert.throws(()=>validatePngScanlineIntegrity(png(),{...limits,maxEncodedBytes:10}));
});
test('zero-length IDAT chunk floods and excessive chunk budgets are rejected',()=>{
 const h=Buffer.alloc(13);h.writeUInt32BE(1);h.writeUInt32BE(1,4);h[8]=8;h[9]=6;
 const many=Buffer.concat([sig,chunk('IHDR',h),...Array.from({length:40},()=>chunk('IDAT',Buffer.alloc(0))),
  chunk('IDAT',deflateSync(Buffer.from([0,1,2,3,4]))),chunk('IEND',Buffer.alloc(0))]);
 assert.throws(()=>validatePngScanlineIntegrity(many,limits));
 assert.throws(()=>validatePngScanlineIntegrity(png(),{...limits,maxChunks:4097}));
});
test('unsupported animation, invalid palette and corrupted framing are rejected',()=>{
 assert.throws(()=>validatePngScanlineIntegrity(png({extras:[chunk('acTL',Buffer.alloc(8))]}),limits));
 assert.throws(()=>validatePngScanlineIntegrity(png({color:3,depth:1,raw:Buffer.from([0,0])}),limits));
 assert.throws(()=>validatePngScanlineIntegrity(png({color:0,depth:1,raw:Buffer.from([0,0]),extras:[chunk('PLTE',Buffer.from([0,0,0]))]}),limits));
 const corrupt=png();corrupt[29]^=1;assert.throws(()=>validatePngScanlineIntegrity(corrupt,limits));
 assert.throws(()=>validatePngScanlineIntegrity(png(),{...limits,width:2}));
});
