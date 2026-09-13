import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsMap.set(process.argv[index], process.argv[index + 1]);
}

const inputDirectory = argumentsMap.get("--input");
const outputPath = argumentsMap.get("--output");
if (!inputDirectory || !outputPath) {
  throw new Error(
    "Usage : node scripts/prepare-base44-import.mjs --input <dossier CSV> --output <fichier SQL privé>",
  );
}

const resolvedInput = path.resolve(inputDirectory);
const resolvedOutput = path.resolve(outputPath);
const outputInsideRepository = !path
  .relative(root, resolvedOutput)
  .startsWith("..");
if (outputInsideRepository) {
  throw new Error(
    "Le SQL contient les données exportées et doit rester hors du dépôt Git.",
  );
}

const metadataDefinitions = {
  id: { type: "string" },
  created_date: { type: "string", format: "date-time" },
  updated_date: { type: "string", format: "date-time" },
  created_by_id: { type: "string" },
  created_by: { type: "string" },
  is_sample: { type: "boolean" },
};

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
  if (String(value).includes("\0")) {
    throw new Error("Une valeur contient un caractère NUL non importable.");
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("CSV invalide : guillemet non fermé.");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows.filter(
    (candidate) => candidate.length > 1 || candidate[0]?.length > 0,
  );
}

function scalarType(definition) {
  return Array.isArray(definition.type)
    ? definition.type.find((candidate) => candidate !== "null")
    : definition.type;
}

function sqlValue(rawValue, definition, context) {
  const type = scalarType(definition);
  if (rawValue === "" && type !== "string") {
    return "null";
  }

  if (type === "boolean") {
    const normalized = rawValue.toLowerCase();
    if (["true", "1"].includes(normalized)) return "true";
    if (["false", "0"].includes(normalized)) return "false";
    throw new Error(`${context} : booléen invalide.`);
  }

  if (type === "number" || type === "integer") {
    if (!Number.isFinite(Number(rawValue))) {
      throw new Error(`${context} : nombre invalide.`);
    }
    return rawValue;
  }

  if (type === "array" || type === "object") {
    try {
      JSON.parse(rawValue);
    } catch {
      throw new Error(`${context} : JSON invalide.`);
    }
    return `${quoteLiteral(rawValue)}::jsonb`;
  }

  if (definition.format === "date-time") {
    if (rawValue === "") return "null";
    if (Number.isNaN(Date.parse(rawValue))) {
      throw new Error(`${context} : date invalide.`);
    }
    return `${quoteLiteral(rawValue)}::timestamptz`;
  }

  if (definition.format === "date") {
    if (rawValue === "") return "null";
    return `${quoteLiteral(rawValue)}::date`;
  }

  return quoteLiteral(rawValue);
}

const csvFiles = fs
  .readdirSync(resolvedInput)
  .filter((file) => file.endsWith("_export.csv"))
  .sort((a, b) => a.localeCompare(b));

const statements = [
  "-- Import privé généré depuis l'export Base44.",
  "-- Ce fichier contient des données réelles : ne pas l'ajouter à Git.",
  "begin;",
  "set local statement_timeout = 0;",
  "",
];
const counts = [];
const tableBlocks = [];

for (const file of csvFiles) {
  const entity = file.replace(/_export\.csv$/, "");
  const table = snakeCase(entity);
  const schemaPath = path.join(root, "base44", "entities", `${entity}.jsonc`);
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schéma absent pour ${entity}.`);
  }

  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const definitions = {
    ...metadataDefinitions,
    ...schema.properties,
  };
  const csvRows = parseCsv(
    fs.readFileSync(path.join(resolvedInput, file), "utf8").replace(/^\uFEFF/, ""),
  );
  if (csvRows.length === 0) {
    counts.push({ entity, table, rows: 0 });
    continue;
  }

  const headers = csvRows[0];
  if (new Set(headers).size !== headers.length) {
    throw new Error(`${entity} : en-tête CSV dupliqué.`);
  }
  for (const header of headers) {
    if (!definitions[header]) {
      throw new Error(`${entity} : colonne inconnue ${header}.`);
    }
  }

  const dataRows = csvRows.slice(1);
  for (const [index, row] of dataRows.entries()) {
    if (row.length !== headers.length) {
      throw new Error(
        `${entity}, ligne ${index + 2} : ${row.length} valeurs pour ${headers.length} colonnes.`,
      );
    }
  }

  if (dataRows.length > 0) {
    const columnsSql = headers
      .map((header) => quoteIdentifier(snakeCase(header)))
      .join(", ");
    const rowsSql = dataRows.map((row, rowIndex) => {
      const values = row.map((value, columnIndex) =>
        sqlValue(
          value,
          definitions[headers[columnIndex]],
          `${entity}, ligne ${rowIndex + 2}, ${headers[columnIndex]}`,
        ),
      );
      return `  (${values.join(", ")})`;
    });

    const insertLines = [
      `insert into public.${quoteIdentifier(table)} (${columnsSql})`,
      "values",
      rowsSql.join(",\n"),
      "on conflict (\"id\") do nothing;",
      "",
    ];
    statements.push(...insertLines);
    tableBlocks.push({ table, rows: dataRows.length, insertLines });
  }
  counts.push({ entity, table, rows: dataRows.length });
}

for (const { table, rows } of counts.filter((entry) => entry.rows > 0)) {
  statements.push(
    "do $$",
    "begin",
    `  if (select count(*) from public.${quoteIdentifier(table)}) <> ${rows} then`,
    `    raise exception 'Validation échouée pour ${table} : nombre de lignes inattendu';`,
    "  end if;",
    "end;",
    "$$;",
    "",
  );
}

statements.push("commit;", "");
fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
fs.writeFileSync(resolvedOutput, statements.join("\n"), "utf8");

const chunkDirectory = `${resolvedOutput}.chunks`;
if (fs.existsSync(chunkDirectory)) {
  throw new Error(
    `Le dossier de lots existe déjà : ${chunkDirectory}. Choisir un autre fichier de sortie.`,
  );
}
fs.mkdirSync(chunkDirectory, { recursive: true });

const chunkLimit = 300_000;
const chunks = [];
let currentBlocks = [];
let currentSize = 0;
for (const block of tableBlocks) {
  const validationLines = [
    "do $$",
    "begin",
    `  if (select count(*) from public.${quoteIdentifier(block.table)}) <> ${block.rows} then`,
    `    raise exception 'Validation échouée pour ${block.table} : nombre de lignes inattendu';`,
    "  end if;",
    "end;",
    "$$;",
    "",
  ];
  const blockSql = [...block.insertLines, ...validationLines].join("\n");
  const blockSize = Buffer.byteLength(blockSql, "utf8");
  if (currentBlocks.length > 0 && currentSize + blockSize > chunkLimit) {
    chunks.push(currentBlocks);
    currentBlocks = [];
    currentSize = 0;
  }
  currentBlocks.push(blockSql);
  currentSize += blockSize;
}
if (currentBlocks.length > 0) {
  chunks.push(currentBlocks);
}

for (const [index, blocks] of chunks.entries()) {
  const chunkSql = [
    "-- Lot privé d'import Base44. Ne pas ajouter à Git.",
    "begin;",
    "set local statement_timeout = 0;",
    "",
    ...blocks,
    "commit;",
    "",
  ].join("\n");
  const chunkName = `${String(index + 1).padStart(3, "0")}.sql`;
  fs.writeFileSync(path.join(chunkDirectory, chunkName), chunkSql, "utf8");
}

const summary = {
  csvFiles: csvFiles.length,
  tablesWithData: counts.filter((entry) => entry.rows > 0).length,
  emptyTables: counts.filter((entry) => entry.rows === 0).length,
  records: counts.reduce((sum, entry) => sum + entry.rows, 0),
  outputBytes: fs.statSync(resolvedOutput).size,
  chunks: chunks.length,
  largestChunkBytes: Math.max(
    ...fs
      .readdirSync(chunkDirectory)
      .map((file) => fs.statSync(path.join(chunkDirectory, file)).size),
  ),
};
fs.writeFileSync(
  `${resolvedOutput}.summary.json`,
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(summary, null, 2));
