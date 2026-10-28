import test from 'node:test';
import assert from 'node:assert/strict';
import {compileSchema} from '../src/validation.mjs';

test('validator rejects unsupported schema keywords rather than ignoring them',()=>{
  for(const key of ['oneOf','format','$ref','not','patternProperties']) {
    assert.throws(()=>compileSchema({type:'string',[key]:true}),/Unsupported schema keyword/);
  }
  assert.throws(()=>compileSchema({type:'object',properties:{}}),/reject extra fields/);
  assert.throws(()=>compileSchema({type:'number',minLength:1}),/Inapplicable/);
  assert.throws(()=>compileSchema({type:'number',minimum:2,maximum:1}),/Inverted/);
});
test('plain objects, required own fields and accessors are checked without coercion',()=>{
  const check=compileSchema({type:'object',properties:{count:{type:'integer',minimum:1}},required:['count'],additionalProperties:false});
  assert.equal(check({count:1}),true);
  for(const value of [null,[],{}, {count:'1'},{count:1,extra:true},Object.create({count:1})]) {
    assert.throws(()=>check(value),{code:'INVALID_ARGUMENTS'});
  }
  let read=false;
  assert.throws(()=>check({get count(){read=true;return 1;}}),{code:'INVALID_ARGUMENTS'});
  assert.equal(read,false);
});
test('arrays and strings enforce lengths, uniqueness, patterns and primitive enums',()=>{
  const check=compileSchema({type:'array',items:{type:'string',minLength:1,maxLength:2,pattern:'^[AB]+$'},minItems:1,maxItems:2,uniqueItems:true});
  assert.equal(check(['A','BB']),true);
  for(const v of [[],['A','A'],['A','B','A'],['C'],['AAA'],[1]]) assert.throws(()=>check(v),{code:'INVALID_ARGUMENTS'});
  const unicode=compileSchema({type:'string',minLength:1,maxLength:1});
  assert.equal(unicode('😀'),true);
  const flag=compileSchema({type:'boolean',enum:[true]});
  assert.equal(flag(true),true);
  for(const v of [false,1,'true']) assert.throws(()=>flag(v),{code:'INVALID_ARGUMENTS'});
});
test('finite numeric bounds are enforced',()=>{
  const check=compileSchema({type:'number',minimum:-1,maximum:1});
  assert.equal(check(0.5),true);
  for(const v of [NaN,Infinity,-Infinity,2,-2,'0',null]) assert.throws(()=>check(v),{code:'INVALID_ARGUMENTS'});
});

test('array accessors, holes, custom fields and hidden object fields are refused without getters',()=>{
  const array=compileSchema({type:'array',items:{type:'string'},minItems:1,maxItems:3});
  let calls=0;const accessor=[];
  Object.defineProperty(accessor,'0',{get(){calls++;return 'A';},enumerable:true});
  const extra=['A'];extra.extra='B';
  for(const value of [accessor,Array(1),extra]) assert.throws(()=>array(value),{code:'INVALID_ARGUMENTS'});
  assert.equal(calls,0);
  const object=compileSchema({type:'object',properties:{x:{type:'string'}},required:['x'],additionalProperties:false});
  assert.throws(()=>object(Object.defineProperty({},'x',{value:'A'})),{code:'INVALID_ARGUMENTS'});
});
