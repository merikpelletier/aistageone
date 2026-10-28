import React, { useMemo } from 'react';

export const SHOOT_SYSTEM_FIELDS = new Set(['prompt', 'duration', 'aspect_ratio', 'reference_images']);

const titleFor = (key) => String(key || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const resolvePointer = (ref, document) => {
  if (!ref?.startsWith('#/')) return null;
  return ref.slice(2).split('/').reduce((value, part) => value?.[part.replace(/~1/g, '/').replace(/~0/g, '~')], document) || null;
};

const mergeSchemas = (left = {}, right = {}) => ({
  ...left,
  ...right,
  properties: left.properties || right.properties ? { ...(left.properties || {}), ...(right.properties || {}) } : undefined,
  required: left.required || right.required ? [...new Set([...(left.required || []), ...(right.required || [])])] : undefined,
});

export const normalizeModelSchema = (schema, document, seen = new Set()) => {
  if (!schema || typeof schema !== 'object') return {};
  let field = schema;
  if (field.$ref) {
    if (seen.has(field.$ref)) return {};
    const resolved = resolvePointer(field.$ref, document);
    if (!resolved) return {};
    field = normalizeModelSchema(resolved, document, new Set([...seen, field.$ref]));
  }
  if (Array.isArray(field.allOf) && field.allOf.length) {
    field = field.allOf.reduce((merged, item) => mergeSchemas(merged, normalizeModelSchema(item, document, seen)), { ...field, allOf: undefined });
  }
  const union = Array.isArray(field.oneOf) && field.oneOf.length ? field.oneOf : Array.isArray(field.anyOf) && field.anyOf.length ? field.anyOf : null;
  if (union) {
    const candidates = union.map((item) => normalizeModelSchema(item, document, seen));
    const concrete = candidates.filter((item) => item?.type !== 'null');
    const preferred = concrete.find((item) => item?.enum?.length) || concrete.find((item) => item?.type) || concrete[0] || {};
    field = mergeSchemas({ ...field, oneOf: undefined, anyOf: undefined }, preferred);
  }
  return field || {};
};

export const getModelInputSchema = (model) => {
  const document = model?.schema;
  if (!document) return null;
  return normalizeModelSchema(document?.components?.schemas?.Input, document) || null;
};

export const getModelFieldSchema = (model, fieldName) => {
  const document = model?.schema;
  const inputSchema = getModelInputSchema(model);
  const rawField = inputSchema?.properties?.[fieldName];
  if (!document || !rawField) return null;
  return normalizeModelSchema(rawField, document);
};

export const getMappedModelField = (model, sourceName) => {
  const inputSchema = getModelInputSchema(model);
  if (!inputSchema?.properties) return null;
  const mapping = model?.input_mapping || {};
  for (const [name, rawField] of Object.entries(inputSchema.properties)) {
    const source = mapping[name] || name;
    if (source === sourceName) return { name, source, schema: normalizeModelSchema(rawField, model.schema) };
  }
  return null;
};

export const getModelDefaults = (model) => {
  const inputSchema = getModelInputSchema(model);
  if (!model?.schema || !inputSchema?.properties) return {};
  return Object.fromEntries(Object.entries(inputSchema.properties)
    .map(([key, raw]) => [key, normalizeModelSchema(raw, model.schema)?.default])
    .filter(([, value]) => value !== undefined));
};

export const buildModelToolInput = (model, values = {}, systemValues = {}) => {
  const inputSchema = getModelInputSchema(model);
  if (!inputSchema?.properties) return {};
  const mapping = model?.input_mapping || {};
  const input = {};
  for (const [name] of Object.entries(inputSchema.properties)) {
    const source = mapping[name] || name;
    if (SHOOT_SYSTEM_FIELDS.has(source)) {
      if (systemValues[source] !== undefined) input[source] = systemValues[source];
      continue;
    }
    if (values[name] !== undefined) input[source] = values[name];
  }
  return input;
};

const displayValue = (value, field) => {
  if (value === undefined || value === null) return '';
  if (field.type === 'array') {
    if (!Array.isArray(value)) return typeof value === 'string' ? value : '';
    if (field.items?.type === 'object' || typeof value[0] === 'object') return JSON.stringify(value, null, 2);
    return value.join('\n');
  }
  if (field.type === 'object') return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return String(value);
};

const parseValue = (raw, field) => {
  if (raw === '') return undefined;
  if (field.type === 'boolean') return raw === true || raw === 'true';
  if (field.type === 'integer') {
    const value = Number(raw);
    return Number.isFinite(value) ? Math.trunc(value) : undefined;
  }
  if (field.type === 'number') {
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }
  if (field.type === 'array') {
    const text = String(raw).trim();
    if (!text) return undefined;
    if (field.items?.type === 'object' || field.items?.type === 'array' || text.startsWith('[')) {
      try { return JSON.parse(text); } catch { return raw; }
    }
    return text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }
  if (field.type === 'object') {
    try { return JSON.parse(String(raw)); } catch { return raw; }
  }
  return raw;
};

function FieldControl({ name, rawField, document, value, inheritedValue, required, onChange }) {
  const field = normalizeModelSchema(rawField, document);
  const effective = value !== undefined ? value : inheritedValue !== undefined ? inheritedValue : field.default;
  const description = field.description || '';
  const enumValues = Array.isArray(field.enum) ? field.enum : null;
  const commonClass = 'mt-1 w-full border border-white/10 bg-black/30 p-2 text-xs text-white outline-none focus:border-[#23c7be]';
  const setValue = (next) => onChange(name, next);

  let control;
  if (enumValues?.length) {
    control = <select value={effective ?? ''} onChange={(event) => setValue(parseValue(event.target.value, field))} className={commonClass}>
      {!required && <option value="">Default</option>}
      {enumValues.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}
    </select>;
  } else if (field.type === 'boolean') {
    control = <select value={effective === undefined ? '' : String(Boolean(effective))} onChange={(event) => setValue(event.target.value === '' ? undefined : event.target.value === 'true')} className={commonClass}>
      {!required && <option value="">Default</option>}
      <option value="true">True</option>
      <option value="false">False</option>
    </select>;
  } else if (field.type === 'number' || field.type === 'integer') {
    control = <input type="number" value={effective ?? ''} min={field.minimum} max={field.maximum} step={field.multipleOf || (field.type === 'integer' ? 1 : 'any')} onChange={(event) => setValue(parseValue(event.target.value, field))} className={commonClass} />;
  } else if (field.type === 'array' || field.type === 'object') {
    control = <textarea value={displayValue(effective, field)} onChange={(event) => setValue(parseValue(event.target.value, field))} className={`${commonClass} min-h-20`} placeholder={field.type === 'array' ? (field.items?.type === 'object' ? 'JSON array' : 'One value per line') : 'JSON object'} />;
  } else {
    const inputType = field.format === 'uri' || field.format === 'url' ? 'url' : 'text';
    control = <input type={inputType} value={effective ?? ''} minLength={field.minLength} maxLength={field.maxLength} pattern={field.pattern} onChange={(event) => setValue(parseValue(event.target.value, field))} className={commonClass} placeholder={inputType === 'url' ? 'https://…' : ''} />;
  }

  return <label className="block text-[10px] text-white/55">
    <span className="font-black uppercase tracking-[0.08em] text-white/65">{field.title || titleFor(name)}{required ? ' *' : ''}</span>
    {control}
    {description && <span className="mt-1 block text-[9px] leading-4 text-white/35">{description}</span>}
  </label>;
}

export default function DynamicAiModelControls({ model, values = {}, inheritedValues = {}, onChange }) {
  const document = model?.schema;
  const inputSchema = useMemo(() => getModelInputSchema(model), [model]);
  const fields = useMemo(() => {
    if (!document || !inputSchema?.properties) return [];
    const required = new Set(inputSchema.required || []);
    const mapping = model?.input_mapping || {};
    return Object.entries(inputSchema.properties)
      .filter(([name]) => !SHOOT_SYSTEM_FIELDS.has(mapping[name] || name))
      .map(([name, rawField]) => ({ name, rawField, required: required.has(name) }));
  }, [document, inputSchema, model?.input_mapping]);

  if (!model) return null;
  if (!inputSchema?.properties) return <div className="mt-3 border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100">This model has no imported input schema, so its options cannot be exposed safely.</div>;
  if (!fields.length) return <p className="mt-3 text-xs text-white/40">This model has no additional options beyond the Shoot controls.</p>;

  return <div className="mt-4 border-t border-white/10 pt-4">
    <div className="mb-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#23c7be]">Model options</p>
      <p className="text-[10px] text-white/40">Generated automatically from the selected model schema.</p>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map(({ name, rawField, required }) => <FieldControl key={name} name={name} rawField={rawField} document={document} value={values[name]} inheritedValue={inheritedValues[name]} required={required} onChange={onChange} />)}
    </div>
  </div>;
}