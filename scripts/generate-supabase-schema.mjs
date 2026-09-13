import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const entitiesDirectory = path.join(root, "base44", "entities");
const migrationsDirectory = path.join(root, "supabase", "migrations");
const migrationPath = path.join(
  migrationsDirectory,
  "20260810000100_base44_entities.sql",
);
const mappingPath = path.join(root, "docs", "BASE44_SUPABASE_ENTITY_MAP.md");

const metadataColumns = [
  ["id", "text primary key default gen_random_uuid()::text"],
  ["created_date", "timestamptz not null default now()"],
  ["updated_date", "timestamptz not null default now()"],
  ["created_by_id", "text"],
  ["created_by", "text"],
  ["is_sample", "boolean not null default false"],
];

function snakeCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlType(definition) {
  const type = Array.isArray(definition.type)
    ? definition.type.find((candidate) => candidate !== "null")
    : definition.type;

  if (type === "string" && definition.format === "date-time") {
    return "timestamptz";
  }
  if (type === "string" && definition.format === "date") {
    return "date";
  }

  return {
    string: "text",
    number: "double precision",
    integer: "bigint",
    boolean: "boolean",
    array: "jsonb",
    object: "jsonb",
  }[type] ?? "jsonb";
}

function sqlDefault(definition) {
  if (!Object.hasOwn(definition, "default") || definition.default === null) {
    return "";
  }

  const value = definition.default;
  if (typeof value === "string") {
    return ` default ${quoteLiteral(value)}`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return ` default ${String(value)}`;
  }

  return ` default ${quoteLiteral(JSON.stringify(value))}::jsonb`;
}

function readSchemas() {
  const files = fs
    .readdirSync(entitiesDirectory)
    .filter((file) => file.endsWith(".jsonc"))
    .sort((a, b) => a.localeCompare(b));

  return files.map((file) => {
    const source = fs.readFileSync(path.join(entitiesDirectory, file), "utf8");
    const schema = JSON.parse(source.replace(/^\uFEFF/, ""));
    if (!schema.name || schema.type !== "object" || !schema.properties) {
      throw new Error(`Schéma Base44 invalide : ${file}`);
    }
    return { file, schema, table: snakeCase(schema.name) };
  });
}

function validateSchemas(entries) {
  const tableNames = new Set();
  for (const entry of entries) {
    if (tableNames.has(entry.table)) {
      throw new Error(`Nom de table dupliqué : ${entry.table}`);
    }
    tableNames.add(entry.table);

    const columns = new Set(metadataColumns.map(([name]) => name));
    for (const property of Object.keys(entry.schema.properties)) {
      const column = snakeCase(property);
      if (columns.has(column)) {
        throw new Error(
          `Colonne dupliquée dans ${entry.schema.name} : ${column}`,
        );
      }
      columns.add(column);
    }
  }
}

function buildMigration(entries) {
  const lines = [
    "-- Généré depuis base44/entities par npm run supabase:schema.",
    "-- Ne pas modifier à la main : corriger le générateur ou le schéma source.",
    "-- Les champs métier restent nullables pendant l'import afin de préserver les données historiques.",
    "",
    "create extension if not exists pgcrypto with schema extensions;",
    "",
    "create or replace function public.set_updated_date()",
    "returns trigger",
    "language plpgsql",
    "security invoker",
    "set search_path = ''",
    "as $$",
    "begin",
    "  new.updated_date = now();",
    "  return new;",
    "end;",
    "$$;",
    "",
  ];

  for (const { schema, table } of entries) {
    const columns = metadataColumns.map(
      ([name, definition]) => `  ${quoteIdentifier(name)} ${definition}`,
    );

    for (const [property, definition] of Object.entries(schema.properties)) {
      const column = snakeCase(property);
      columns.push(
        `  ${quoteIdentifier(column)} ${sqlType(definition)}${sqlDefault(definition)}`,
      );
    }

    lines.push(
      `create table if not exists public.${quoteIdentifier(table)} (`,
      columns.join(",\n"),
      ");",
      `comment on table public.${quoteIdentifier(table)} is ${quoteLiteral(`Entité Base44 d'origine : ${schema.name}`)};`,
      `alter table public.${quoteIdentifier(table)} enable row level security;`,
      `revoke all on table public.${quoteIdentifier(table)} from anon, authenticated;`,
      `drop trigger if exists ${quoteIdentifier(`set_${table}_updated_date`)} on public.${quoteIdentifier(table)};`,
      `create trigger ${quoteIdentifier(`set_${table}_updated_date`)}`,
      `before update on public.${quoteIdentifier(table)}`,
      "for each row execute function public.set_updated_date();",
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildMapping(entries) {
  const totalProperties = entries.reduce(
    (sum, { schema }) => sum + Object.keys(schema.properties).length,
    0,
  );
  const totalRequired = entries.reduce(
    (sum, { schema }) => sum + (schema.required?.length ?? 0),
    0,
  );

  const lines = [
    "# Correspondance Base44 vers Supabase",
    "",
    "Ce document est généré par `npm run supabase:schema` à partir des schémas du dépôt.",
    "",
    `- Entités : ${entries.length}`,
    `- Propriétés métier : ${totalProperties}`,
    `- Champs marqués obligatoires par Base44 : ${totalRequired}`,
    "- Identifiants Base44 conservés sous forme de texte",
    "- Tableaux et objets conservés en `jsonb`",
    "- Tables verrouillées par RLS, sans politique publique initiale",
    "- Contraintes métier obligatoires différées jusqu'à la validation des données exportées",
    "",
    "| Entité Base44 | Table PostgreSQL | Propriétés | Obligatoires |",
    "|---|---|---:|---:|",
  ];

  for (const { schema, table } of entries) {
    lines.push(
      `| ${schema.name} | \`${table}\` | ${Object.keys(schema.properties).length} | ${schema.required?.length ?? 0} |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

const entries = readSchemas();
validateSchemas(entries);
fs.mkdirSync(migrationsDirectory, { recursive: true });
fs.writeFileSync(migrationPath, buildMigration(entries), "utf8");
fs.writeFileSync(mappingPath, buildMapping(entries), "utf8");

console.log(`Migration générée : ${path.relative(root, migrationPath)}`);
console.log(`Correspondance générée : ${path.relative(root, mappingPath)}`);
console.log(`Entités converties : ${entries.length}`);
