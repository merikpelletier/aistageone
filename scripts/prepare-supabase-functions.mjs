import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(projectRoot, 'base44', 'functions');
const targetRoot = path.join(projectRoot, 'supabase', 'functions');
const agentsRoot = path.join(projectRoot, 'base44', 'agents');

const agentPrompts = {};
for (const fileName of ['production_assistant.jsonc', 'story_orchestrator.jsonc']) {
  const config = JSON.parse(fs.readFileSync(path.join(agentsRoot, fileName), 'utf8'));
  agentPrompts[config.name] = config.instructions;
}

const promptModule = `// Generated from base44/agents. Do not edit manually.\nexport const agentPrompts: Record<string, string> = ${JSON.stringify(agentPrompts, null, 2)};\n`;
fs.writeFileSync(path.join(targetRoot, '_shared', 'generatedAgentPrompts.ts'), promptModule);

for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const sourceFile = path.join(sourceRoot, entry.name, 'entry.ts');
  if (!fs.existsSync(sourceFile)) continue;

  let source = fs.readFileSync(sourceFile, 'utf8');
  source = source.replace(
    /^import\s+\{\s*createClientFromRequest\s*\}\s+from\s+['"]npm:@base44\/sdk@[^'"]+['"];?\r?\n/,
    "import { createClientFromRequest } from '../_shared/base44Compat.ts';\nimport { serveWithCors } from '../_shared/cors.ts';\n",
  );
  source = source.replace('Deno.serve(', 'serveWithCors(');

  const targetDirectory = path.join(targetRoot, entry.name);
  fs.mkdirSync(targetDirectory, { recursive: true });
  fs.writeFileSync(path.join(targetDirectory, 'index.ts'), source);
}

console.log('Supabase functions prepared from the recovered Base44 sources.');

