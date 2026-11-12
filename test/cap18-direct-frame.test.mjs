import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {parseCap18DirectFrame} from '../src/cap18-direct-frame.mjs';

function chunk(type,data){const tag=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);tag.copy(out,4);data.copy(out,8);let c=0xffffffff;for(const x of out.subarray(4,8+data.length)){c^=x;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;}out.writeUInt32BE((c^0xffffffff)>>>0,8+data.length);return out;}
function image(){const h=Buffer.alloc(13);h.writeUInt32BE(1);h.writeUInt32BE(1,4);h[8]=8;h[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(Buffer.from([0,1,2,3,4]))),chunk('IEND',Buffer.alloc(0))]);}
const expected={requestId:'a'.repeat(32),editorEpoch:'epoch',projectIdentity:'project',worldPath:'/Game/Map',pieInstance:1};
const limits={maxFrameBytes:4096,maxImageBytes:1024,maxPixels:64,maxDimension:16};
function envelope(){const png=image();return {version:1,...expected,width:1,height:1,pngBase64:png.toString('base64'),pngSha256:createHash('sha256').update(png).digest('hex')};}
const bytes=x=>Buffer.from(JSON.stringify(x));

test('candidate frame preserves envelope and yields only the correlated bounded image',()=>{
 const frame=envelope();const raw=bytes(frame),copy=Buffer.from(raw);const out=parseCap18DirectFrame(raw,expected,limits);
 assert.deepEqual(out.receipt,frame);assert.equal(out.image.data,frame.pngBase64);assert.equal(out.image.mimeType,'image/png');assert.deepEqual(raw,copy);
});
test('wrong identities, crossed response, malformed schema and invalid UTF-8 fail closed',()=>{
 const valid=envelope();for(const mutation of [{requestId:'b'.repeat(32)},{editorEpoch:'other'},{projectIdentity:'other'},{worldPath:'/Game/Other'},{pieInstance:2},{version:2},{extra:true}])
   assert.throws(()=>parseCap18DirectFrame(bytes({...valid,...mutation}),expected,limits));
 assert.throws(()=>parseCap18DirectFrame(Buffer.from([0xff]),expected,limits));
 assert.throws(()=>parseCap18DirectFrame(Buffer.from(JSON.stringify(valid).replace('{','{\"version\":1,')),expected,limits));
 assert.throws(()=>parseCap18DirectFrame(bytes(valid),expected,{...limits,maxFrameBytes:10}));
});
test('image corruption, noncanonical encoding, mismatched digest and output limits fail closed',()=>{
 const valid=envelope();for(const mutation of [{pngBase64:valid.pngBase64+'='},{pngSha256:'0'.repeat(64)},{width:2},{pngBase64:'AAAA',pngSha256:createHash('sha256').update(Buffer.from([0,0,0])).digest('hex')}])
   assert.throws(()=>parseCap18DirectFrame(bytes({...valid,...mutation}),expected,limits));
 assert.throws(()=>parseCap18DirectFrame(bytes(valid),expected,{...limits,maxImageBytes:8}));
 assert.throws(()=>parseCap18DirectFrame(bytes(valid),expected,{...limits,maxPixels:0}));
});
