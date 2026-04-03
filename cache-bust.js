#!/usr/bin/env node

/**
 * cache-bust.js
 *
 * Computes content hashes and updates query strings (?v={hash}) for:
 *   - main.css and main.js  → in index.html and sw.js
 *   - index.html, scenarios-rpg.json, howler.js, and all script JS files → in sw.js
 * Also bumps the SW CACHE_NAME so stale caches are purged.
 *
 * Usage: node cache-bust.js
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HTML = join(__dirname, 'public', 'index.html');
const SW   = join(__dirname, 'public', 'sw.js');

// Files referenced in both index.html and sw.js
const TARGETS = [
  {
    file:    join(__dirname, 'public', 'css', 'main.css'),
    htmlRef: /css\/main\.css(?:\?v=[a-f0-9]+)?/,
    swRef:   /\/css\/main\.css(?:\?v=[a-f0-9]+)?/,
    htmlNew: (h) => `css/main.css?v=${h}`,
    swNew:   (h) => `/css/main.css?v=${h}`,
  },
  {
    file:    join(__dirname, 'public', 'js', 'main.js'),
    htmlRef: /js\/main\.js(?:\?v=[a-f0-9]+)?/,
    swRef:   /\/js\/main\.js(?:\?v=[a-f0-9]+)?/,
    htmlNew: (h) => `js/main.js?v=${h}`,
    swNew:   (h) => `/js/main.js?v=${h}`,
  },
];

// Files referenced only in sw.js
const SW_TARGETS = [
  {
    file:  join(__dirname, 'public', 'scenarios-rpg.json'),
    swRef: /\/scenarios-rpg\.json(?:\?v=[a-f0-9]+)?/,
    swNew: (h) => `/scenarios-rpg.json?v=${h}`,
  },
  {
    file:  join(__dirname, 'public', 'js', 'vendor', 'howler.js'),
    swRef: /\/js\/vendor\/howler\.js(?:\?v=[a-f0-9]+)?/,
    swNew: (h) => `/js/vendor/howler.js?v=${h}`,
  },
  {
    file:  join(__dirname, 'public', 'js', 'scripts', 'show-fluffy-dice.js'),
    swRef: /\/js\/scripts\/show-fluffy-dice\.js(?:\?v=[a-f0-9]+)?/,
    swNew: (h) => `/js/scripts/show-fluffy-dice.js?v=${h}`,
  },
  {
    file:  join(__dirname, 'public', 'js', 'scripts', 'arcade-cat.js'),
    swRef: /\/js\/scripts\/arcade-cat\.js(?:\?v=[a-f0-9]+)?/,
    swNew: (h) => `/js/scripts/arcade-cat.js?v=${h}`,
  },
  {
    file:  join(__dirname, 'public', 'js', 'scripts', 'troll-charm.js'),
    swRef: /\/js\/scripts\/troll-charm\.js(?:\?v=[a-f0-9]+)?/,
    swNew: (h) => `/js/scripts/troll-charm.js?v=${h}`,
  },
  {
    file:  join(__dirname, 'public', 'js', 'scripts', 'show-wizard-charm.js'),
    swRef: /\/js\/scripts\/show-wizard-charm\.js(?:\?v=[a-f0-9]+)?/,
    swNew: (h) => `/js/scripts/show-wizard-charm.js?v=${h}`,
  },
];

function shortHash(content) {
  return createHash('md5').update(content).digest('hex').slice(0, 8);
}

let html = readFileSync(HTML, 'utf8');
let sw   = readFileSync(SW, 'utf8');

// Phase 1: update html and sw for CSS/main.js targets
for (const { file, htmlRef, swRef, htmlNew, swNew } of TARGETS) {
  const content = readFileSync(file);
  const hash = shortHash(content);
  html = html.replace(htmlRef, htmlNew(hash));
  sw   = sw.replace(swRef, swNew(hash));
  console.log(`${file.split('/').pop()} → ?v=${hash}`);
}

// Phase 2: hash the final index.html content (after CSS/JS substitutions) and update sw
{
  const hash = shortHash(html);
  sw = sw.replace(/\/index\.html(?:\?v=[a-f0-9]+)?/, `/index.html?v=${hash}`);
  console.log(`index.html → ?v=${hash}`);
}

// Phase 3: update sw for SW-only targets
for (const { file, swRef, swNew } of SW_TARGETS) {
  const content = readFileSync(file);
  const hash = shortHash(content);
  sw = sw.replace(swRef, swNew(hash));
  console.log(`${file.split('/').pop()} → ?v=${hash}`);
}

// Bump the SW CACHE_NAME so stale caches are purged
sw = sw.replace(
  /(const CACHE_NAME\s*=\s*['"][^'"]+\.)(\d+)(['"]\s*;)/,
  (_, prefix, num, suffix) => `${prefix}${parseInt(num, 10) + 1}${suffix}`
);

writeFileSync(HTML, html, 'utf8');
console.log('Updated: public/index.html');

writeFileSync(SW, sw, 'utf8');
console.log('Updated: public/sw.js');
