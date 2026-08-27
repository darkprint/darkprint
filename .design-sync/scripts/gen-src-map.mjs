// Regenerates cfg.componentSrcMap from the component tree.
//
// The converter finds a component's source by filename (`<Name>.tsx`), which
// misses every secondary export: this repo puts several components in one file
// (Badge.tsx also exports KindBadge, PartFigures.tsx exports six figures), and an
// unmatched component loses both its group and its JSDoc. Pinning every path
// fixes both. Re-run after adding or moving a component.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const files = execFileSync('find', ['components', '-name', '*.tsx', '!', '-name', '*.test.*', '!', '-name', '*.stories.*'], { cwd: repo })
  .toString().trim().split('\n').sort();

const DECL = /export\s+(?:default\s+)?(?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9]*)[\s(<:=]/g;
const RENAME = /export\s*\{([^}]*)\}/g;

const map = {};
for (const f of files) {
  const text = readFileSync(resolve(repo, f), 'utf8');
  const names = new Set();
  for (const m of text.matchAll(DECL)) names.add(m[1]);
  for (const m of text.matchAll(RENAME)) {
    for (const part of m[1].split(',')) {
      // `export { Frame as FigureFrame }` — the exported name is what ships.
      const as = /(?:\w+)\s+as\s+([A-Z][A-Za-z0-9]*)/.exec(part) ?? /^\s*([A-Z][A-Za-z0-9]*)\s*$/.exec(part);
      if (as && !/\btype\b/.test(part)) names.add(as[1]);
    }
  }
  for (const n of names) {
    // ALL-CAPS is a constant (NAV, LAYERS, COLS), never a component. The converter
    // drops these on its own; the map has to agree or a non-null entry re-adds them.
    if (/^[A-Z0-9]+$/.test(n)) continue;
    // A file named after the component always wins over a co-located re-export.
    if (map[n] && map[n].endsWith(`/${n}.tsx`)) continue;
    map[n] = f;
  }
}

const cfgPath = resolve(repo, '.design-sync/config.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
cfg.componentSrcMap = { ...map, ...(cfg.componentSrcMapPins ?? {}) };
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

const groups = {};
for (const f of Object.values(cfg.componentSrcMap)) (groups[f.split('/')[1]] ??= 0), groups[f.split('/')[1]]++;
console.log(`componentSrcMap: ${Object.keys(cfg.componentSrcMap).length} components across ${Object.keys(groups).length} groups`);
