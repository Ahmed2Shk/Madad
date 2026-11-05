// Enforces two CLAUDE.md rules ESLint cannot express:
// 1. Logical properties only: no ml/mr/pl/pr/left/right (Tailwind classes or CSS).
// 2. Colors come from tokens.css only: no hex literals in components.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../src', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const TOKENS = 'styles/tokens.css';

const physicalClass =
  /(?<![\w-])-?(?:ml|mr|pl|pr|left|right|rounded-[lr]|rounded-[tb][lr]|border-[lr]|scroll-m[lr]|scroll-p[lr])-(?:[\w.[\]/%-]+)|(?<![\w-])text-(?:left|right)(?![\w-])/g;
const physicalCss = /\b(?:margin|padding|border)-(?:left|right)\b|(?<![\w-])(?:left|right)\s*:/g;
const hex = /#[0-9a-fA-F]{3,8}\b/g;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const problems = [];
for (const file of walk(ROOT)) {
  if (!/\.(tsx?|css)$/.test(file)) continue;
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  const isTest = /\.test\.tsx?$/.test(rel);
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (line.includes('check-styles-ignore')) return;
      const where = `src/${rel}:${i + 1}`;
      const re = file.endsWith('.css') ? physicalCss : physicalClass;
      // Tests hold data (ids like "pr-sanad"), not class names; they render no styles.
      if (!isTest) for (const m of line.matchAll(re)) problems.push(`${where}  physical property "${m[0]}" (use ms/me/ps/pe/start/end)`);
      if (rel !== TOKENS && !isTest) {
        for (const m of line.matchAll(hex)) problems.push(`${where}  hex color "${m[0]}" (use tokens.css)`);
      }
    });
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\ncheck-styles: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log('check-styles: ok');
