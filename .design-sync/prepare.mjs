// Everything the converter needs that this repo does not already build.
// Run before package-build.mjs; wired as cfg.buildCmd so a re-sync gets it too.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const run = (f) => execFileSync(process.execPath, [resolve(here, f)], { stdio: 'inherit' });

// Order matters: the snapshot is a Tailwind @source, so it exists before the
// scan; gen-types copies the finished stylesheet into the staging package.
run('scripts/snapshot-content.mjs');
run('build-css.mjs');
run('scripts/gen-types.mjs');
