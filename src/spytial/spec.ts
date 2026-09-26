import { createPyretRuntimeAdapter, type PyretCaptureRuntime } from '../data-instance/pyret/runtime-adapter';
import { constructorInfo } from '../data-instance/pyret/identity';
import { spytialSchema } from './generated';

/** The owning runtime, with its standard field, list and execution APIs. */
export interface SpytialRuntime extends PyretCaptureRuntime {
  hasField(value: unknown, name: string): boolean;
  getColonField(value: unknown, name: string): unknown;
  getField(value: unknown, name: string): unknown;
  num_to_fixnum(value: unknown): number;
  ffi: {
    isLink(value: unknown): boolean;
    isEmpty(value: unknown): boolean;
    isSome(value: unknown): boolean;
    isNone(value: unknown): boolean;
  };
  safeCall(thunk: () => unknown, after: (value: unknown) => unknown, frame: string): unknown;
  runThunk(thunk: () => unknown, done: (result: { result?: unknown; exn?: unknown }) => void): void;
  isSuccessResult(result: unknown): boolean;
}

export class SpytialSpecError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'SpytialSpecError';
  }
}

type Field = {
  name: string; pyretName: string; type: string; required: boolean;
  enum?: string; block?: string; minimum?: number; maximum?: number;
  exclusiveMinimum?: number; pattern?: string;
  listRules?: { atMostOneOf?: readonly (readonly string[])[]; narrowsListTo?: Readonly<Record<string, readonly string[]>> };
};
type RecordSchema = { constructor: string; fields: readonly Field[] };
type RuleSchema = RecordSchema & { name: string; yamlKey: string; section: string; shape: string; optionsConstructor: string };
type Json = string | number | boolean | Json[] | { [key: string]: Json };
const rules: readonly RuleSchema[] = Object.values(spytialSchema.rules);
const blocks: Readonly<Record<string, RecordSchema>> = spytialSchema.blocks;
const enums: Readonly<Record<string, Readonly<Record<string, string>>>> = spytialSchema.enums;

function fail(path: string, message: string): never { throw new SpytialSpecError(path, message); }

/** Read runtime-owned declared fields, never printers or user-defined accessors. */
function data(value: unknown, runtime: SpytialRuntime, path: string, name: string, fields: readonly string[]): Record<string, unknown> {
  if (!runtime.isDataValue(value)) return fail(path, `expected ${name}`);
  const v = value as { $name: string; dict: Record<string, unknown> };
  const info = constructorInfo(v);
  if (v.$name !== name || !info || info.fields.length !== fields.length
      || info.fields.some((f, i) => f !== fields[i])) return fail(path, `expected ${name}`);
  return v.dict;
}

/** ffi.toArray assumes an acyclic list; hooks may return arbitrary values. */
function list(value: unknown, runtime: SpytialRuntime, path: string): unknown[] {
  const seen = new Set<unknown>();
  const result: unknown[] = [];
  while (!runtime.ffi.isEmpty(value)) {
    if (!runtime.ffi.isLink(value)) return fail(path, 'expected a Pyret List');
    if (seen.has(value)) return fail(path, 'cyclic rule list');
    seen.add(value);
    const dict = (value as { dict: Record<string, unknown> }).dict;
    result.push(dict.first);
    value = dict.rest;
  }
  return result;
}

function fieldValue(value: unknown, field: Field, runtime: SpytialRuntime, path: string): Json {
  if (field.type === 'enum' || field.type === 'enum-list') {
    const vocabulary = enums[field.enum!];
    const member = (v: unknown, p: string): string => {
      const name = (v as { $name?: string } | null)?.$name;
      if (!name || !Object.prototype.hasOwnProperty.call(vocabulary, name)) return fail(p, `expected ${field.enum}`);
      data(v, runtime, p, name, []);
      return vocabulary[name];
    };
    if (field.type === 'enum') return member(value, path);
    const values = list(value, runtime, path).map((v, i) => member(v, `${path}[${i}]`));
    for (const group of field.listRules?.atMostOneOf ?? []) {
      if (group.filter(v => values.includes(v)).length > 1) fail(path, 'incompatible directions');
    }
    for (const [v, allowed] of Object.entries(field.listRules?.narrowsListTo ?? {})) {
      if (values.includes(v) && values.some(other => !allowed.includes(other))) fail(path, 'incompatible directions');
    }
    return values;
  }
  if (field.type === 'block') return record(value, blocks[field.block!], runtime, path);
  if (field.type === 'boolean') {
    if (typeof value !== 'boolean') return fail(path, 'expected Boolean');
    return value;
  }
  if (field.type === 'number' || field.type === 'integer') {
    if (!runtime.isNumber(value)) return fail(path, 'expected Number');
    const number = runtime.num_to_fixnum(value);
    if (!Number.isFinite(number) || (field.type === 'integer' && !Number.isSafeInteger(number))
        || (field.minimum !== undefined && number < field.minimum)
        || (field.maximum !== undefined && number > field.maximum)
        || (field.exclusiveMinimum !== undefined && number <= field.exclusiveMinimum)) {
      return fail(path, 'number is outside the manifest bounds');
    }
    return number;
  }
  if (typeof value !== 'string') return fail(path, 'expected String');
  if (field.required && !value.trim()) return fail(path, 'required string must not be empty');
  if (field.pattern && !new RegExp(field.pattern).test(value)) return fail(path, 'string does not match the manifest pattern');
  return value;
}

function readFields(dict: Record<string, unknown>, fields: readonly Field[], runtime: SpytialRuntime, path: string): Record<string, Json> {
  const result: Record<string, Json> = {};
  for (const f of fields) {
    let value = dict[f.pyretName];
    const p = `${path}.${f.pyretName}`;
    if (!f.required) {
      if (runtime.ffi.isNone(value)) continue;
      if (!runtime.ffi.isSome(value)) fail(p, 'expected Option');
      value = (value as { dict: { value: unknown } }).dict.value;
    }
    result[f.name] = fieldValue(value, f, runtime, p);
  }
  return result;
}

function record(value: unknown, schema: RecordSchema, runtime: SpytialRuntime, path: string): Record<string, Json> {
  return readFields(data(value, runtime, path, schema.constructor, schema.fields.map(f => f.pyretName)), schema.fields, runtime, path);
}

// JSON scalars/inline arrays are YAML-compatible; quote all keys and strings.
// This small emitter handles only the validated document, not arbitrary YAML.
function yaml(value: Json, indent = 0): string {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return '\n' + value.map(v => `${pad}- ${yaml(v, indent + 2).trimStart()}`).join('\n');
  }
  if (typeof value !== 'object') return JSON.stringify(value);
  const entries = Object.entries(value);
  if (!entries.length) return '{}';
  return '\n' + entries.map(([k, v]) => {
    const rendered = Array.isArray(v) && v.every(x => typeof x !== 'object') ? JSON.stringify(v) : yaml(v, indent + 2);
    return `${pad}${JSON.stringify(k)}:${rendered.startsWith('\n') ? '' : ' '}${rendered}`;
  }).join('\n');
}

/** Serialize a List<SpytialRule> from pyret/spytial.arr as one layout document. */
export function spytialRulesToYaml(value: unknown, runtime: SpytialRuntime): string {
  const document: Record<string, Json[]> = { constraints: [], directives: [] };
  for (const [i, rule] of list(value, runtime, 'rules').entries()) {
    const path = `rules[${i}]`;
    const wrapper = (rule as { $name?: string } | null)?.$name;
    if (wrapper !== 'constraint' && wrapper !== 'directive') fail(path, 'expected SpytialRule');
    const payload = data(rule, runtime, path, wrapper, ['value']).value;
    const name = (payload as { $name?: string } | null)?.$name;
    const schema = rules.find(r => r.constructor === name);
    if (!schema || schema.section !== `${wrapper}s`) fail(path, `invalid ${wrapper} variant`);
    const required = schema.fields.filter(f => f.required);
    const optional = schema.fields.filter(f => !f.required);
    const dict = data(payload, runtime, path, schema.constructor,
      [...required.map(f => f.pyretName), ...(optional.length ? ['options'] : [])]);
    const fields = readFields(dict, required, runtime, path);
    if (optional.length) Object.assign(fields, record(dict.options,
      { constructor: schema.optionsConstructor, fields: optional }, runtime, `${path}.options`));
    document[schema.section].push({ [schema.yamlKey]: schema.shape === 'scalar' ? fields[schema.fields[0].name] : fields });
  }
  return yaml(document).trimStart() + '\n';
}

type ValuePath = { parent?: ValuePath; key: string | number };
function formatPath(path?: ValuePath): string {
  const parts: (string | number)[] = [];
  for (; path; path = path.parent) parts.push(path.key);
  return 'value' + parts.reverse().map(k => `[${JSON.stringify(k)}]`).join('');
}

/**
 * Collect one YAML document per distinct _spytial function/method, in breadth-
 * first order. Methods bind to the first encountered owner; hooks must describe
 * types, not individual instances. Discovery finishes before user code runs.
 * Call from the JS host while the owning runtime is idle (or paused).
 */
export async function getSpytialSpec(value: unknown, runtime: SpytialRuntime): Promise<string[]> {
  const adapter = createPyretRuntimeAdapter(runtime);
  const seen = new Set<unknown>();
  const hooks = new Set<unknown>();
  const calls: Array<{ fn: { app(): unknown }; path?: ValuePath }> = [];
  const queue: Array<{ value: unknown; path?: ValuePath }> = [{ value }];
  for (let i = 0; i < queue.length; i++) {
    const { value: current, path } = queue[i];
    if (seen.has(current)) continue;
    seen.add(current);
    // Functions have no diagrammed descendants. Only _spytial is invoked.
    if (runtime.isFunction(current) || runtime.isMethod(current)) continue;
    const child = (v: unknown, key: string | number) => queue.push({ value: v, path: { parent: path, key } });
    try {
      if (runtime.isObject(current) && runtime.hasField(current, '_spytial')) {
        const hook = runtime.getColonField(current, '_spytial');
        if (!runtime.isFunction(hook) && !runtime.isMethod(hook)) fail(formatPath(path), '_spytial must be a function or method');
        if (!hooks.has(hook)) {
          hooks.add(hook);
          // Bind now so an earlier hook cannot replace a later discovered hook.
          calls.push({ fn: runtime.getField(current, '_spytial') as { app(): unknown }, path });
        }
      }
      const o = adapter.observe(current);
      switch (o.kind) {
        case 'constructor': o.values.forEach((v, n) => child(v, o.info.fields[n])); break;
        case 'object': o.fields.forEach(([name, v]) => child(v, name)); break;
        case 'raw-array': case 'tuple': o.values.forEach(child); break;
        case 'reference': child(o.value, 'target'); break;
        case 'string-dict': o.entries.forEach(([name, v]) => child(v, name)); break;
        case 'table': o.rows.forEach((row, n) => row.forEach((v, c) => queue.push({ value: v,
          path: { parent: { parent: { parent: path, key: 'rows' }, key: n }, key: o.headers[c] } }))); break;
      }
    } catch (error) {
      if (error instanceof SpytialSpecError) throw error;
      throw new SpytialSpecError(formatPath(path), error instanceof Error ? error.message : String(error));
    }
  }
  if (!calls.length) return [];
  const documents: string[] = [];
  let index = 0;
  let activePath = 'value';
  // safeCall saves the continuation if compiled Pyret runs out of gas or pauses.
  const next = (): unknown => {
    if (index === calls.length) return documents;
    const call = calls[index++];
    activePath = `${formatPath(call.path)}._spytial`;
    return runtime.safeCall(() => call.fn.app(), result => {
      // A raw YAML string remains an escape hatch for existing hooks.
      documents.push(typeof result === 'string' ? result : spytialRulesToYaml(result, runtime));
      return next();
    }, activePath);
  };
  return new Promise((resolve, reject) => {
    runtime.runThunk(next, result => {
      if (runtime.isSuccessResult(result)) resolve(documents);
      else reject(new SpytialSpecError(activePath, result.exn instanceof Error ? result.exn.message : String(result.exn)));
    });
  });
}
