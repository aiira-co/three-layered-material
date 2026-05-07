import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = join(packageRoot, 'dist');
const jsFiles = [];

function collectJsFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      collectJsFiles(path);
    } else if (stats.isFile() && path.endsWith('.js')) {
      jsFiles.push(path);
    }
  }
}

function toSpecifier(fromFile, resolvedFile) {
  let specifier = relative(dirname(fromFile), resolvedFile).split(sep).join('/');

  if (!specifier.startsWith('.')) {
    specifier = `./${specifier}`;
  }

  return specifier;
}

function resolveRelativeSpecifier(fromFile, specifier) {
  if (!specifier.startsWith('.') || extname(specifier)) {
    return specifier;
  }

  const base = resolve(dirname(fromFile), specifier);
  const asFile = `${base}.js`;
  const asIndex = join(base, 'index.js');

  if (existsSync(asFile)) {
    return toSpecifier(fromFile, asFile);
  }

  if (existsSync(asIndex)) {
    return toSpecifier(fromFile, asIndex);
  }

  return specifier;
}

function fixFile(file) {
  const source = readFileSync(file, 'utf8');
  const fixed = source
    .replace(/(from\s+["'])(\.[^"']+)(["'])/g, (_, prefix, specifier, suffix) => {
      return `${prefix}${resolveRelativeSpecifier(file, specifier)}${suffix}`;
    })
    .replace(/(import\s*\(\s*["'])(\.[^"']+)(["']\s*\))/g, (_, prefix, specifier, suffix) => {
      return `${prefix}${resolveRelativeSpecifier(file, specifier)}${suffix}`;
    });

  if (fixed !== source) {
    writeFileSync(file, fixed);
  }
}

if (existsSync(distRoot)) {
  collectJsFiles(distRoot);
  jsFiles.forEach(fixFile);
}
