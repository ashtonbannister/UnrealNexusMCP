import { NexusError } from './errors.mjs';

// Deliberately small, fail-closed JSON Schema subset for THIS static catalogue.
// It is not a general-purpose JSON Schema implementation. Unsupported keywords
// fail at catalogue construction instead of silently weakening validation.
const allowed = new Set([
  'type', 'description', 'properties', 'required', 'additionalProperties', 'items',
  'minItems', 'maxItems', 'uniqueItems', 'minLength', 'maxLength', 'pattern',
  'minimum', 'maximum', 'enum',
]);
const types = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean']);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && [Object.prototype, null].includes(Object.getPrototypeOf(v));

export function compileSchema(schema) {
  function compile(s, path) {
    if (!plain(s) || !types.has(s.type)) throw new Error('Unsupported schema type at ' + path);
    for (const key of Object.keys(s)) {
      if (!allowed.has(key)) throw new Error('Unsupported schema keyword: ' + path + '.' + key);
    }
    const perType = {
      object: ['properties', 'required', 'additionalProperties'],
      array: ['items', 'minItems', 'maxItems', 'uniqueItems'],
      string: ['minLength', 'maxLength', 'pattern'],
      number: ['minimum', 'maximum'],
      integer: ['minimum', 'maximum'],
      boolean: [],
    };
    for (const key of Object.keys(s)) {
      if (!['type', 'description', 'enum'].includes(key) && !perType[s.type].includes(key)) {
        throw new Error('Inapplicable schema keyword: ' + path + '.' + key);
      }
    }
    for (const key of ['minimum', 'maximum', 'minItems', 'maxItems', 'minLength', 'maxLength']) {
      if (own(s, key) && (!Number.isFinite(s[key])
        || (['minItems', 'maxItems', 'minLength', 'maxLength'].includes(key)
          && (!Number.isInteger(s[key]) || s[key] < 0)))) {
        throw new Error('Invalid schema bound: ' + path + '.' + key);
      }
    }
    for (const [lo, hi] of [['minimum', 'maximum'], ['minItems', 'maxItems'], ['minLength', 'maxLength']]) {
      if (own(s, lo) && own(s, hi) && s[lo] > s[hi]) throw new Error('Inverted schema bounds at ' + path);
    }
    if (s.enum !== undefined && (!Array.isArray(s.enum) || s.enum.length === 0
      || s.enum.some((v) => v !== null && typeof v === 'object'))) {
      throw new Error('Only nonempty primitive enums are supported at ' + path);
    }
    if (s.uniqueItems !== undefined && typeof s.uniqueItems !== 'boolean') throw new Error('Invalid uniqueItems');
    let checks, item, pattern;
    if (s.type === 'object') {
      if (s.additionalProperties !== false || !plain(s.properties)) {
        throw new Error('Objects must declare properties and reject extra fields at ' + path);
      }
      if (s.required !== undefined && (!Array.isArray(s.required)
        || new Set(s.required).size !== s.required.length
        || s.required.some((k) => typeof k !== 'string' || !own(s.properties, k)))) {
        throw new Error('Invalid required list at ' + path);
      }
      checks = new Map(Object.entries(s.properties).map(([k, v]) => [k, compile(v, path + '.' + k)]));
    }
    if (s.type === 'array') item = compile(s.items, path + '[]');
    if (s.pattern !== undefined) {
      if (typeof s.pattern !== 'string') throw new Error('Invalid pattern at ' + path);
      pattern = new RegExp(s.pattern, 'u');
    }
    return (value, at = '$') => {
      const fail = (why) => { throw new NexusError('INVALID_ARGUMENTS', at + ': ' + why); };
      if (s.type === 'object') {
        if (!plain(value)) fail('expected a plain JSON object');
        for (const key of Reflect.ownKeys(value)) {
          if (typeof key !== 'string') fail('symbol properties are not JSON');
          if (!checks.has(key)) fail('unexpected property ' + key);
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (!descriptor || !own(descriptor, 'value') || !descriptor.enumerable) {
            fail('accessor or nonenumerable properties are not JSON');
          }
          checks.get(key)(descriptor.value, at + '.' + key);
        }
        for (const key of s.required ?? []) if (!own(value, key)) fail('missing ' + key);
      } else if (s.type === 'array') {
        if (!Array.isArray(value)) fail('expected an array');
        if (s.minItems !== undefined && value.length < s.minItems) fail('too few items');
        if (s.maxItems !== undefined && value.length > s.maxItems) fail('too many items');
        for (const key of Reflect.ownKeys(value)) {
          if (key === 'length') continue;
          if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
            fail('non-index array properties are not JSON');
          }
        }
        const values = [];
        for (let i = 0; i < value.length; i++) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
          if (!descriptor || !own(descriptor, 'value') || !descriptor.enumerable) {
            fail('array holes, accessors or nonenumerable elements are not JSON');
          }
          item(descriptor.value, at + '[' + i + ']');
          values.push(descriptor.value);
        }
        if (s.uniqueItems && new Set(values.map((v) => JSON.stringify(v))).size !== value.length) fail('duplicate items');
      } else if (s.type === 'string') {
        if (typeof value !== 'string') fail('expected a string');
        const length = [...value].length;
        if (s.minLength !== undefined && length < s.minLength) fail('string too short');
        if (s.maxLength !== undefined && length > s.maxLength) fail('string too long');
        if (pattern && !pattern.test(value)) fail('string does not match the required pattern');
      } else if (s.type === 'boolean') {
        if (typeof value !== 'boolean') fail('expected a boolean');
      } else {
        if (typeof value !== 'number' || !Number.isFinite(value)) fail('expected a finite number');
        if (s.type === 'integer' && !Number.isInteger(value)) fail('expected an integer');
        if (s.minimum !== undefined && value < s.minimum) fail('below minimum');
        if (s.maximum !== undefined && value > s.maximum) fail('above maximum');
      }
      if (s.enum && !s.enum.some((v) => Object.is(v, value))) fail('value is not in enum');
      return true;
    };
  }
  return compile(schema, '$schema');
}
