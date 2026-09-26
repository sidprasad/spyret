// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { parseLayoutSpec } from 'spytial-core';
import { getSpytialSpec, spytialRulesToYaml, SpytialSpecError, type SpytialRuntime } from '../src/spytial/spec';
import { toDataInstance } from '../src/diagram';
import { spytialSchema } from '../src/spytial/generated';
// @ts-ignore JavaScript generator is also the deterministic drift checker.
import { generate } from '../scripts/generate-spytial.mjs';

const manifest = JSON.parse(fs.readFileSync(new URL('../node_modules/spytial-core/docs/spytial-language.json', import.meta.url), 'utf8'));
const datum = (name: string, fields: Record<string, unknown> = {}, identity = { $fieldNames: Object.keys(fields) }) =>
  ({ kind: 'data', $name: name, $arity: Object.keys(fields).length, $constructor: identity, dict: { ...fields } });
const none = datum('none');
const some = (value: unknown) => datum('some', { value });
const list = (values: unknown[]): any => values.reduceRight((rest, first) => datum('link', { first, rest }), datum('empty'));
const fn = (app: () => unknown) => ({ kind: 'function', app });
const method = (app: (self: any) => unknown) => ({ kind: 'method', app });
const object = (dict: Record<string, unknown>) => ({ kind: 'object', dict });
const runtime: SpytialRuntime = {
  Any: {}, isNumber: v => typeof v === 'number', isNothing: () => false,
  isDataValue: (v: any) => v?.kind === 'data', isTuple: (v: any) => v?.kind === 'tuple',
  isRef: (v: any) => v?.kind === 'ref', isFunction: (v: any) => v?.kind === 'function',
  isMethod: (v: any) => v?.kind === 'method', isOpaque: (v: any) => v?.kind === 'opaque',
  isObject: (v: any) => ['data', 'object'].includes(v?.kind),
  hasField: (v: any, key) => key in v.dict,
  getColonField: (v: any, key) => v.dict[key],
  getField: (v: any, key) => v.dict[key].kind === 'method' ? fn(() => v.dict[key].app(v)) : v.dict[key],
  num_to_fixnum: v => v as number,
  ffi: { isEmpty: (v: any) => v?.$name === 'empty', isLink: (v: any) => v?.$name === 'link',
    isSome: (v: any) => v?.$name === 'some', isNone: (v: any) => v?.$name === 'none' },
  safeCall: (thunk, after) => after(thunk()),
  runThunk: (thunk, done) => { try { done({ result: thunk() }); } catch (exn) { done({ exn }); } },
  isSuccessResult: (v: any) => 'result' in v,
};

function fieldValue(f: any, value: any): unknown {
  if (f.type === 'enum' || f.type === 'enum-list') {
    const vocab = (spytialSchema.enums as any)[f.enum];
    const member = (v: string) => datum(Object.keys(vocab).find(k => vocab[k] === v)!);
    return f.type === 'enum' ? member(value) : list(value.map(member));
  }
  if (f.type === 'block') {
    const schema = (spytialSchema.blocks as any)[f.block];
    if (typeof value === 'string') value = { points: value };
    return record(schema.constructor, schema.fields, value);
  }
  return value;
}
function record(name: string, fields: any[], values: Record<string, any>): unknown {
  return datum(name, Object.fromEntries(fields.map(f => [f.pyretName,
    f.required ? fieldValue(f, values[f.name]) : values[f.name] === undefined ? none : some(fieldValue(f, values[f.name]))])));
}
function rule(name: string, values: any): unknown {
  const schema = (spytialSchema.rules as any)[name];
  const required = schema.fields.filter((f: any) => f.required);
  const optional = schema.fields.filter((f: any) => !f.required);
  const fields = Object.fromEntries(required.map((f: any) => [f.pyretName, fieldValue(f, values[f.name])]));
  if (optional.length) fields.options = record(schema.optionsConstructor, optional, values);
  return datum(schema.section === 'constraints' ? 'constraint' : 'directive', { value: datum(schema.constructor, fields) });
}

describe('generated Pyret rules', () => {
  it('matches the pinned Core manifest and every checked-in generated artifact', () => {
    for (const [file, content] of Object.entries(generate(manifest))) {
      expect(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')).toBe(content);
    }
    expect(spytialSchema.coreVersion).toBe('6.3.2');
    expect(Object.keys(spytialSchema.rules)).toEqual(manifest.items.map((i: any) => i.id));
  });

  it('fails generation on unfamiliar manifest field types or enum vocabularies', () => {
    const changed = structuredClone(manifest);
    changed.items[0].fields[0].type = 'new-selector-type';
    expect(() => generate(changed)).toThrow(/Unhandled field type/);
    changed.items[0].fields[0].type = 'enum';
    changed.items[0].fields[0].values = ['new-vocabulary'];
    expect(() => generate(changed)).toThrow(/new enum vocabulary/);
    const newValidation = structuredClone(manifest);
    newValidation.items[0].fields[1].minItems = 1;
    expect(() => generate(newValidation)).toThrow(/Unhandled field metadata/);
  });

  it.each(manifest.items)('emits the Core example for $id in its canonical section', (item: any) => {
    const value = item.example;
    const yaml = spytialRulesToYaml(list([rule(item.id, value)]), runtime);
    expect(parseLayoutSpec(yaml)).toEqual(parseLayoutSpec(JSON.stringify({ [item.sections[0]]: [{ [item.yamlKey]: item.valueShape === 'scalar' ? item.example[item.fields[0].name] : item.example }] })));
  });

  it('composes mixed rules, styled group connectors, source and negation', () => {
    const values = [rule('group', { selector: 'children', name: 'family', hold: 'never',
      addEdge: { points: 'togroup', lineStyle: { color: '#123456', weight: 1.5 } }, source: { text: 'S.group(...)' } }),
    rule('atomStyle', { selector: 'node', showLabel: false, fillStyle: { color: 'red' }, iconStyle: { opacity: 0.5 } }),
    rule('orientation', { selector: 'next', directions: ['above', 'left'] })];
    const parsed = parseLayoutSpec(spytialRulesToYaml(list(values), runtime));
    expect(parsed).toBeDefined();
    expect(spytialRulesToYaml(list([]), runtime)).toBe('"constraints": []\n"directives": []\n');
  });

  it.each([
    ['size', { width: 0, height: 2 }, 'bounds'],
    ['size', { width: Infinity, height: 2 }, 'bounds'],
    ['atomStyle', { iconStyle: { opacity: 2 } }, 'bounds'],
    ['orientation', { selector: 'x', directions: ['above', 'below'] }, 'incompatible'],
    ['orientation', { selector: 'x', directions: ['directlyAbove', 'left'] }, 'incompatible'],
    ['align', { selector: '', direction: 'horizontal' }, 'empty'],
    ['inferredEdge', { name: 'edge', selector: 'x', draw: 'no arrow' }, 'pattern'],
  ])('rejects invalid %s fields', (name, values, message) => {
    expect(() => spytialRulesToYaml(list([rule(name as string, values)]), runtime)).toThrow(message as string);
  });

  it('rejects malformed lists, wrappers, options and variants', () => {
    expect(() => spytialRulesToYaml([], runtime)).toThrow(/Pyret List/);
    expect(() => spytialRulesToYaml(list([datum('constraint', { value: datum('unknown') })]), runtime)).toThrow(/variant/);
    const bad: any = rule('size', { width: 1, height: 2 });
    bad.$name = 'directive';
    expect(() => spytialRulesToYaml(list([bad]), runtime)).toThrow(/variant/);
    bad.$name = 'constraint'; bad.dict.value.dict.options.dict.selector = 'bad';
    expect(() => spytialRulesToYaml(list([bad]), runtime)).toThrow(/Option/);
    const cycle = list([rule('size', { width: 1, height: 2 })]); cycle.dict.rest = cycle;
    expect(() => spytialRulesToYaml(cycle, runtime)).toThrow(/cyclic/);
  });
});

describe('getSpytialSpec', () => {
  it('collects hooks once by identity, binds self, and walks every instance and hookless parent', async () => {
    let calls = 0;
    const shared = method(self => { calls++; expect(self.dict.n).toBe(1); return list([rule('size', { width: 10, height: 20 })]); });
    const a = datum('same', { n: 1, child: 0 });
    const b = datum('same', { n: 2, child: object({ _spytial: fn(() => 'child') }) });
    Object.assign(a.dict, { _spytial: shared }); Object.assign(b.dict, { _spytial: shared });
    const distinctSameName = datum('same', {});
    Object.assign(distinctSameName.dict, { _spytial: fn(() => 'distinct') });
    const root = object({ children: [a, b, distinctSameName, a] });
    root.dict.self = root;
    const specs = await getSpytialSpec(root, runtime);
    expect(specs).toEqual([spytialRulesToYaml(list([rule('size', { width: 10, height: 20 })]), runtime), 'distinct', 'child']);
    expect(calls).toBe(1);
    await getSpytialSpec(root, runtime);
    expect(calls).toBe(2); // Per-call deduplication, no global cache.
  });

  it('walks tuple and initialized reference children, including cycles', async () => {
    const ref = { kind: 'ref', state: 2, anns: { anns: [{ ann: runtime.Any }] }, value: null as any };
    const child = object({ _spytial: fn(() => 'nested'), cycle: ref });
    ref.value = { kind: 'tuple', vals: [child] };
    expect(await getSpytialSpec([ref], runtime)).toEqual(['nested']);
  });

  it('invokes the hooks discovered before execution even if an earlier hook mutates a field', async () => {
    const later = object({ _spytial: fn(() => 'original') });
    const first = object({ _spytial: fn(() => { later.dict._spytial = fn(() => 'replacement'); return 'first'; }) });
    expect(await getSpytialSpec([first, later], runtime)).toEqual(['first', 'original']);
  });

  it('ignores unrelated callable fields without executing them', async () => {
    const root = object({ f: fn(() => { throw Error('do not run'); }), child: object({ _spytial: fn(() => 'ok') }) });
    expect(await getSpytialSpec(root, runtime)).toEqual(['ok']);
    expect(await getSpytialSpec([1, true, 'str'], runtime)).toEqual([]);
  });

  it('reports malformed hooks, hook failures and unsupported descendants with paths', async () => {
    await expect(getSpytialSpec(object({ child: object({ _spytial: 3 }) }), runtime)).rejects.toThrow('value["child"]');
    await expect(getSpytialSpec(object({ _spytial: fn(() => 42) }), runtime)).rejects.toThrow(/_spytial.*Pyret List/);
    await expect(getSpytialSpec(object({ _spytial: fn(() => { throw Error('boom'); }) }), runtime)).rejects.toThrow(/_spytial.*boom/);
    await expect(getSpytialSpec([object({ hidden: { kind: 'opaque' } })], runtime)).rejects.toBeInstanceOf(SpytialSpecError);
  });

  it('handles deep values without recursing through the JS stack', async () => {
    let root: unknown = object({ _spytial: fn(() => 'bottom') });
    for (let i = 0; i < 20000; i++) root = [root];
    expect(await getSpytialSpec(root, runtime)).toEqual(['bottom']);
  });

  it('lets toDataInstance capture hook-bearing objects and constructors without invoking hooks', () => {
    const hook = fn(() => { throw Error('must not run'); });
    const child = datum('child', { n: 42 }); Object.assign(child.dict, { _spytial: hook });
    const instance = toDataInstance(object({ child, _spytial: hook }), runtime);
    expect(instance.getAtoms().some(a => a.label === '42')).toBe(true);
    expect(instance.getRelations().some(r => r.name === '_spytial')).toBe(false);
  });
});
