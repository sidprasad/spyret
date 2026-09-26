/** Generate the Pyret authoring surface and wire schema from pinned Core data. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const kebab = name => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const pascal = name => name[0].toUpperCase() + name.slice(1);
const enumNames = new Map([
  ['above,below,left,right,directlyAbove,directlyBelow,directlyLeft,directlyRight', 'Direction'],
  ['clockwise,counterclockwise', 'Rotation'], ['horizontal,vertical', 'Alignment'],
  ['none,togroup,fromgroup', 'GroupEdgeDirection'], ['small,normal,large', 'TextSize'],
  ['solid,dashed,dotted', 'LinePattern'], ['full,badge', 'IconPlacement'],
  ['hideDisconnected,hideDisconnectedBuiltIns', 'LayoutFlag'], ['always,never', 'Hold'],
]);
// New validation semantics must not disappear during a Core upgrade. Prose,
// selector arity (evaluated by Core), and defaults (omission) need no encoder.
const fieldKeys = new Set(['name', 'type', 'required', 'values', 'block', 'minimum', 'maximum',
  'exclusiveMinimum', 'pattern', 'listRules', 'alternativeForm', 'accepts', 'arity',
  'default', 'deprecated', 'description', 'enforcement', 'note']);

export function generate(manifest) {
  if (manifest.language !== 'spytial-layout-spec' || manifest.document.sectionShape !== 'list'
      || JSON.stringify(manifest.document.sections) !== '["constraints","directives"]') {
    throw new Error('Unsupported Spytial manifest document shape');
  }
  const enums = {};
  const blocks = {};
  const rules = {};
  function field(owner, f) {
    for (const key of Object.keys(f)) if (!fieldKeys.has(key)) throw new Error(`Unhandled field metadata: ${owner}.${f.name}.${key}`);
    for (const key of Object.keys(f.listRules ?? {})) {
      if (!['atMostOneOf', 'narrowsListTo'].includes(key)) throw new Error(`Unhandled list rule: ${owner}.${f.name}.${key}`);
    }
    // A parameter cannot shadow its enclosing function in Pyret: flag(name).
    const out = { name: f.name, pyretName: owner === 'flag' && f.name === 'flag' ? 'name' : kebab(f.name), type: f.type, required: !!f.required };
    for (const key of ['minimum', 'maximum', 'exclusiveMinimum', 'pattern', 'listRules']) {
      if (f[key] !== undefined) out[key] = f[key];
    }
    if (f.alternativeForm) {
      // Emit the richer block form; its points field represents the bare enum.
      if (f.type !== 'enum' || f.alternativeForm.type !== 'block'
          || JSON.stringify(f.values) !== JSON.stringify(f.alternativeForm.fields.find(x => x.name === 'points')?.values)) {
        throw new Error(`Unhandled alternative form: ${owner}.${f.name}`);
      }
      const name = owner + pascal(f.name);
      block(name, f.alternativeForm.fields);
      return { ...out, type: 'block', block: name };
    }
    if (f.type === 'enum' || f.type === 'enum-list') {
      const name = enumNames.get(f.values?.join(','));
      if (!name) throw new Error(`Name the new enum vocabulary: ${owner}.${f.name}`);
      enums[name] = Object.fromEntries(f.values.map(v => [`${kebab(name)}-${kebab(v)}`, v]));
      out.enum = name;
    } else if (f.type === 'block') out.block = f.block;
    else if (!['selector', 'relation', 'string', 'color', 'icon-path', 'number', 'integer', 'boolean'].includes(f.type)) {
      throw new Error(`Unhandled field type: ${owner}.${f.name}: ${f.type}`);
    }
    return out;
  }
  function block(name, fields) {
    if (blocks[name]) throw new Error(`Duplicate block: ${name}`);
    blocks[name] = { name, typeName: pascal(name), constructor: kebab(name), fields: fields.map(f => field(name, f)) };
  }
  for (const b of manifest.blocks) block(b.name, b.fields);
  block('ruleSource', manifest.source.fields);
  for (const item of manifest.items) {
    if (item.sections.length !== 1 || !manifest.document.sections.includes(item.sections[0])
        || !['mapping', 'scalar'].includes(item.valueShape)
        || (item.valueShape === 'scalar' && item.fields.length !== 1)) {
      throw new Error(`Unhandled rule shape: ${item.id}`);
    }
    if (item.discriminator && !(item.discriminator.present === false
        && !item.fields.some(f => f.name === item.discriminator.field))) {
      throw new Error(`Unhandled rule discriminator: ${item.id}`);
    }
    const fields = item.fields.map(f => field(item.id, f));
    if (item.supportsHold) fields.push(field(item.id, { name: 'hold', type: 'enum', values: manifest.hold.values }));
    if (manifest.source.supportedBy.includes(item.id)) fields.push(field(item.id, { name: 'source', type: 'block', block: 'ruleSource' }));
    rules[item.id] = { name: item.id, yamlKey: item.yamlKey, section: item.sections[0], shape: item.valueShape,
      constructor: `spytial-${kebab(item.id)}`, optionsConstructor: `${kebab(item.id)}-options`, fields };
  }
  for (const b of [...Object.values(blocks), ...Object.values(rules)]) {
    for (const f of b.fields) if (f.type === 'block' && !blocks[f.block]) throw new Error(`Unknown block ${f.block}`);
  }
  const schema = { languageVersion: manifest.languageVersion, coreVersion: manifest.spytialCoreVersion, enums, blocks, rules };
  function ann(f) {
    if (f.type === 'enum') return f.enum;
    if (f.type === 'enum-list') return `List<${f.enum}>`;
    if (f.type === 'block') return blocks[f.block].typeName;
    if (f.type === 'number' || f.type === 'integer') return 'Number';
    if (f.type === 'boolean') return 'Boolean';
    return 'String';
  }
  const lines = ['# Generated by scripts/generate-spytial.mjs; do not edit.',
    `# Core ${schema.coreVersion}; language ${schema.languageVersion}.`, 'provide *', 'provide-types *',
    'import option as O', 'import lists as L', ''];
  for (const [name, variants] of Object.entries(enums)) {
    lines.push(`data ${name}:`, ...Object.keys(variants).map(v => `  | ${v}`), 'end', '');
  }
  // Optional fields are real Option<T>s; fluent setters keep common calls short.
  function record(typeName, ctor, fields) {
    const args = fields.map(f => `${f.pyretName} :: ${f.required ? ann(f) : `Option<${ann(f)}>`}`);
    lines.push(`data ${typeName}:`, `  | ${ctor}(${args.join(', ')})${fields.length ? ' with:' : ''}`);
    fields.forEach((f, i) => {
      const values = fields.map(g => g === f ? (f.required ? 'new-value' : 'O.some(new-value)') : `self.${g.pyretName}`);
      lines.push(`    method with-${f.pyretName}(self, new-value :: ${ann(f)}) -> ${typeName}:`,
        `      ${ctor}(${values.join(', ')})`, `    end${i < fields.length - 1 ? ',' : ''}`);
    });
    lines.push('end');
    if (fields.every(f => !f.required)) lines.push(`default-${ctor} = ${ctor}(${fields.map(() => 'O.none').join(', ')})`);
    lines.push('');
  }
  for (const b of Object.values(blocks)) record(b.typeName, b.constructor, b.fields);
  for (const r of Object.values(rules)) {
    const optional = r.fields.filter(f => !f.required);
    if (optional.length) record(`${pascal(r.name)}Options`, r.optionsConstructor, optional);
  }
  for (const [section, typeName] of [['constraints', 'Constraint'], ['directives', 'Directive']]) {
    lines.push(`data ${typeName}:`);
    for (const r of Object.values(rules).filter(r => r.section === section)) {
      const args = r.fields.filter(f => f.required).map(f => `${f.pyretName} :: ${ann(f)}`);
      if (r.fields.some(f => !f.required)) args.push(`options :: ${pascal(r.name)}Options`);
      lines.push(`  | ${r.constructor}(${args.join(', ')})`);
    }
    lines.push('end', '');
  }
  lines.push('data SpytialRule:', '  | constraint(value :: Constraint)', '  | directive(value :: Directive)', 'end', '');
  const reference = ['# Generated Pyret rule reference', '',
    `Core ${schema.coreVersion}; language ${schema.languageVersion}.`, '',
    'Import `pyret/spytial.arr` as `S`. Constructors return `S.SpytialRule` automatically.',
    'Optional fields use typed options. Start with `S.default-<rule>-options`,',
    'chain `.with-<field>(value)`, then pass it to `<rule>-with` after the required arguments.',
    'Style blocks similarly offer `default-<block>` and `.with-<field>(value)`.', '',
    'Numeric bounds, patterns and incompatible direction combinations are checked during serialization.', '',
    '| Constructor | Optional fields |', '| --- | --- |'];
  for (const r of Object.values(rules)) {
    const required = r.fields.filter(f => f.required);
    const optional = r.fields.filter(f => !f.required);
    const args = required.map(f => `${f.pyretName} :: ${ann(f)}`);
    const values = required.map(f => f.pyretName);
    const wrapper = r.section === 'constraints' ? 'constraint' : 'directive';
    const publicName = kebab(r.name);
    lines.push(`fun ${publicName}(${args.join(', ')}) -> SpytialRule:`,
      `  ${wrapper}(${r.constructor}(${[...values, ...(optional.length ? [`default-${r.optionsConstructor}`] : [])].join(', ')}))`, 'end');
    if (optional.length) lines.push(`fun ${publicName}-with(${[...args, `options :: ${pascal(r.name)}Options`].join(', ')}) -> SpytialRule:`,
      `  ${wrapper}(${r.constructor}(${[...values, 'options'].join(', ')}))`, 'end');
    lines.push('');
    const deprecated = manifest.items.find(i => i.id === r.name).deprecated;
    reference.push(`| \`${publicName}(${args.join(', ')})\`${deprecated ? ` (deprecated; use ${kebab(deprecated.replacedBy)})` : ''} | ${optional.map(f => `\`${f.pyretName}: ${ann(f)}\``).join(', ')} |`);
  }
  reference.push('', '## Enum values', '');
  for (const [name, variants] of Object.entries(enums)) reference.push(`- \`${name}\`: ${Object.keys(variants).map(v => `\`${v}\``).join(', ')}`);
  reference.push('', '## Blocks', '');
  for (const b of Object.values(blocks)) reference.push(`- \`${b.constructor}(${b.fields.map(f => `${f.pyretName}: ${f.required ? ann(f) : `Option<${ann(f)}>`}`).join(', ')})\``);
  return {
    // Builtins have no implicit context; qualification also avoids shadowing
    // context-provided names when the same file is imported by URL or file.
    'pyret/spytial.arr': lines.join('\n').replace(/\bOption</g, 'O.Option<').replace(/\bList</g, 'L.List<').trimEnd() + '\n',
    'src/spytial/generated.ts': '// Generated by scripts/generate-spytial.mjs; do not edit.\n'
      + `export const spytialSchema = ${JSON.stringify(schema, null, 2)} as const;\n`,
    'docs/SPYTIAL_RULES_REFERENCE.md': reference.join('\n') + '\n',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/spytial-core/docs/spytial-language.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (manifest.spytialCoreVersion !== pkg.devDependencies['spytial-core']) throw new Error('Core manifest does not match the pinned dependency');
  for (const [relative, content] of Object.entries(generate(manifest))) {
    const destination = path.join(root, relative);
    if (process.argv.includes('--check')) {
      if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== content) throw new Error(`Stale ${relative}; run npm run generate:spytial`);
    } else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, content);
    }
  }
}
