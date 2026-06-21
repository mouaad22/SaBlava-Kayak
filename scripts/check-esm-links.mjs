#!/usr/bin/env node
// check-esm-links.mjs — static ESM import/export linkage checker.
//
// Catches the exact class of bug that once white-screened the live site:
// a module importing a NAMED export that the target module doesn't actually
// provide (e.g. `import { trackThroughPois } from "../nav/geo.js"` before the
// export existed). The browser resolves imports statically at link time, so one
// missing export throws a SyntaxError that aborts the WHOLE module graph rooted
// at app.js — total white screen. `node --check` never sees this because it
// checks one file's syntax in isolation, never the links between files.
//
// This walks app/js, builds each file's export set, and verifies every named
// (and default) import resolves to a real export in the target file. Fast,
// deterministic, no browser. Exit 1 on any broken link.
//
// Usage:  node scripts/check-esm-links.mjs

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const JS_ROOT = resolve(fileURLToPath(import.meta.url), "../../app/js");

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

// Strip block + line comments so `// export function foo` etc. don't register.
// (Good enough for this codebase; not a full tokenizer.)
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function parseExports(src) {
  const names = new Set();
  let m;
  const reDecl = /^\s*export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z0-9_$]+)/gm;
  while ((m = reDecl.exec(src))) names.add(m[1]);
  const reVar = /^\s*export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/gm;
  while ((m = reVar.exec(src))) names.add(m[1]);
  const reList = /export\s*\{([^}]*)\}(?!\s*from)/g; // local re-list, not re-export
  while ((m = reList.exec(src))) {
    for (const part of m[1].split(",")) {
      const seg = part.trim();
      if (!seg) continue;
      const as = seg.split(/\s+as\s+/);
      names.add((as[1] || as[0]).trim());
    }
  }
  if (/^\s*export\s+default\b/m.test(src)) names.add("default");
  return names;
}

function parseImports(src) {
  const imports = [];
  const re = /import\s+([^'";]*?)\s+from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const clause = m[1].trim();
    const source = m[2];
    const entry = { source, names: [], hasDefault: false, isNamespace: false };
    if (/\*\s+as\s+/.test(clause)) entry.isNamespace = true;
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) {
      for (const part of braces[1].split(",")) {
        const seg = part.trim();
        if (!seg) continue;
        entry.names.push(seg.split(/\s+as\s+/)[0].trim());
      }
    }
    // A bare leading identifier (not `{` / `*`) is a default import.
    if (/^[A-Za-z0-9_$]+\s*(,|$)/.test(clause)) entry.hasDefault = true;
    imports.push(entry);
  }
  return imports;
}

function resolveSource(fromFile, source) {
  if (!source.startsWith(".")) return null; // bare/external specifier — skip
  let p = resolve(dirname(fromFile), source);
  if (existsSync(p)) return p;
  if (existsSync(p + ".js")) return p + ".js";
  if (existsSync(join(p, "index.js"))) return join(p, "index.js");
  return p; // non-existent; reported below
}

const files = walk(JS_ROOT);
const exportsByFile = new Map();
for (const f of files) exportsByFile.set(f, parseExports(stripComments(readFileSync(f, "utf8"))));

const problems = [];
for (const f of files) {
  const src = stripComments(readFileSync(f, "utf8"));
  for (const imp of parseImports(src)) {
    const target = resolveSource(f, imp.source);
    if (target === null) continue; // external
    const rel = (p) => p.replace(JS_ROOT, "app/js").replace(/\\/g, "/");
    if (!existsSync(target)) {
      problems.push(`${rel(f)} → import from "${imp.source}" resolves to a missing file`);
      continue;
    }
    const exp = exportsByFile.get(target);
    if (!exp) continue; // not a walked .js (shouldn't happen)
    for (const name of imp.names) {
      if (!exp.has(name)) {
        problems.push(
          `${rel(f)} → imports { ${name} } from "${imp.source}", but ${rel(target)} does not export it`
        );
      }
    }
    if (imp.hasDefault && !exp.has("default")) {
      problems.push(`${rel(f)} → default-imports from "${imp.source}", but ${rel(target)} has no default export`);
    }
  }
}

if (problems.length) {
  console.error("[esm-links] BROKEN module links (these white-screen the app):");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`[esm-links] OK: ${files.length} modules, all imports resolve to real exports.`);
