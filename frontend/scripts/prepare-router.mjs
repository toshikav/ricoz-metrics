import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonical = path.join('src', 'app');

function full(name) {
  const resolved = path.resolve(frontendDir, name);
  const root = frontendDir.endsWith(path.sep) ? frontendDir : frontendDir + path.sep;
  if (resolved !== frontendDir && !resolved.startsWith(root)) {
    throw new Error('Refusing to touch ' + name);
  }
  return resolved;
}

function exists(name) {
  return fs.existsSync(full(name));
}

function remove(name) {
  const target = full(name);
  const keep = full(canonical);
  if (target === keep || target.startsWith(keep + path.sep)) {
    throw new Error('Refusing to remove the App Router at ' + canonical);
  }
  if (!fs.existsSync(target)) return false;
  fs.rmSync(target, { recursive: true, force: true });
  console.log('Removed ' + name + ' so the App Router has one root.');
  return true;
}

// Next throws when `pages` and `app` have different parents. Render checks
// this repo out under a directory named src and can reuse an older tree, so
// a root `app` or `pages` beside `src/app` fails `next build`.
export function prepareRouter() {
  if (exists(canonical)) {
    remove('app');
    remove('pages');
    remove(path.join('src', 'pages'));
  }

  const found = ['app', 'pages', path.join('src', 'app'), path.join('src', 'pages')]
    .filter((name) => exists(name));
  console.log('Router directories: ' + (found.join(', ') || 'none'));

  const pagesDir = exists('pages') ? full('pages') : exists(path.join('src', 'pages')) ? full(path.join('src', 'pages')) : null;
  const appDir = exists('app') ? full('app') : exists(canonical) ? full(canonical) : null;
  if (pagesDir && appDir && path.dirname(pagesDir) !== path.dirname(appDir)) {
    throw new Error('pages and app still have different parents.');
  }
  if (!appDir) {
    throw new Error('No app directory remains for the Next build.');
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry === fileURLToPath(import.meta.url)) {
  prepareRouter();
}
