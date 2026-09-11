// Compiles the design-system stylesheet. app/globals.css only carries the
// @theme tokens; the utilities come from Tailwind's scan of the markup, which
// in the app is Next's job and here is ours. Re-run before every converter
// build so classes used only in newly authored previews are present.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const input = resolve(here, 'css/entry.css');
const output = resolve(here, '.cache/darkprint.css');
const cli = resolve(repo, '.ds-sync/node_modules/.bin/tailwindcss');

mkdirSync(dirname(output), { recursive: true });
execFileSync(cli, ['-i', input, '-o', output], { cwd: repo, stdio: 'inherit' });
