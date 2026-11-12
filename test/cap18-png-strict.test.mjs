import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {validateCap18Png} from '../src/cap18-png.mjs';
import {validateCap18MetadataFreePng} from '../src/cap18-png-strict.mjs';

const signature=Buffer.from([137,80,78,71,13,10,26,10]);
function chunk(type,data) {
  const tag=Buffer.from(type);const out=Buffer.alloc(data.length+12);
  out.writeUInt32BE(data.length);tag.copy(out,4);data.copy(out,8);
  let crc=0xffffffff;for(const byte of out.subarray(4,8+data.length)){crc^=byte;for(let i=0;i<8;i++)crc=(crc&1)?0xedb88320^(crc>>>1):crc>>>1;}
  out.writeUInt32BE((crc^0xffffffff)>>>0,8+data.length);return out;
}
function image(optional=[]) {
  const header=Buffer.alloc(13);header.writeUInt32BE(1);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;
  return Buffer.concat([signature,chunk('IHDR',header),...optional,chunk('IDAT',deflateSync(Buffer.from([0,1,2,3,4]))),chunk('IEND',Buffer.alloc(0))]);
}
const limits={width:1,height:1,maxBytes:1024,maxPixels:1,maxDimension:1};

test('metadata-free policy accepts supported pixels but refuses ancillary interpretation data',()=>{
  assert.deepEqual(validateCap18MetadataFreePng(image(),limits),{width:1,height:1,colorType:6});
  for(const extra of [chunk('tEXt',Buffer.from('key\0value')),chunk('sRGB',Buffer.from([0]))]) {
    const input=image([extra]);
    assert.equal(validateCap18Png(input,limits).width,1,'the fixture isolates the stricter metadata policy');
    assert.throws(()=>validateCap18MetadataFreePng(input,limits),/unsupported metadata/);
  }
});
