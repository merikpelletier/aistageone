import React, { useMemo } from 'react';

const SYSTEM_FIELDS = new Set(['prompt', 'duration', 'aspect_ratio', 'reference_images']);

const titleFor = (key) => String(key || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const resolveSchema = (schema, document) => {
  if (!schema?.$ref) return schema || {};
  const path = schema.$ref.replace(/^#\//, '').split('/');
  return path.reduce((value, part) => value?.[part], document) || {};
};

const normalizeSchema = (schema, document) => {
  let field = resolveSchema(schema, document);
  if (Array.isArray(field?.allOf) && field.allOf.length) {
    field = field.allOf.reduce((merged, item) => ({ ...merged, ...resolveSchema(item, document) }), { ...field, allOf: undefined });
  }
  if (Array.isArray(field?.anyOf) && field.anyOf.length) {
    const candidates = field.anyOf.map((item) => resolveSchema(item, document));
    const preferred = candidates.find((item) => item?.type && item.type !== 'null') || candidates[0] || {};
    field = { ...field, ...preferred, anyOf: undefined };
  }
  if (Array.isArray(field?.oneOf) && field.oneOf.length) {
    const candidates = field.oneOf.map((item) => resolveSchema(item, document));
    const preferred = candidates.find((item) => item?.type && item.type !== 'null') || candidates[0] || {};
    field = { ...field, ...preferred, oneOf: undefined };
  }
  return field || {};
};

export const getModelInputSchema = (model) => {
  const document = model?.schema;
  if (!document) return null;
  return resolveSchema(document?.components?.schemas?.Input, document) || null;
};

export const getModelFieldSchema = (model, fieldName) => {
  const document = model?.schema;
  const inputSchema = getModelInputSchema(model);
  const rawField = inputSchema?.properties?.[fieldName];
  if (!document || !rawField) return null;
  return normalizeSchema(rawField, document);
};

export const getModelDefaults = (model) => {
  const document = model?.schema;
  const inputSchema = getModelInputSchema(model);
  if (!document || !inputSchema?.properties) return {};
  return Object.fromEntries(Object.entries(inputSchema.properties)
    .map(([key, raw]) => [key, normalizeSchema(raw, document)?.default])
    .filter(([, value]) => value !== undefined));
};

const displayValue = (value, field) => {
  if (value === undefined || value === null) return '';
  if (field.type === 'array') {
    if (!Array.isArray(value)) return '';
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
    if (field.items?.type === 'object' || text.startsWith('[')) {
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
  const field = normalizeSchema(rawField, document);
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
    control = <input type="number" value={effective ?? ''} min={field.minimum} max={field.maximum} step={field.type === 'integer' ? 1 : (field.multipleOf || 'any')} onChange={(event) => setValue(parseValue(event.target.value, field))} className={commonClass} />;
  } else if (field.type === 'array' || field.type === 'object') {
    control = <textarea value={displayValue(effective, field)} onChange={(event) => setValue(parseValue(event.target.value, field))} className={`${commonClass} min-h-20`} placeholder={field.type === 'array' ? 'One value per line' : 'JSON object'} />;
  } else {
    control = <input value={effective ?? ''} onChange={(event) => setValue(parseValue(event.target.value, field))} className={commonClass} placeholder={field.format === 'uri' || field.format === 'url' ? 'https://…' : ''} />;
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
    return Object.entries(inputSchema.properties)
      .filter(([name]) => !SYSTEM_FIELDS.has(name))
      .map(([name, rawField]) => ({ name, rawField, required: required.has(name) }));
  }, [document, inputSchema]);

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
