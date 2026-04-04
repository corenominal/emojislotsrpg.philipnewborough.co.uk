#!/usr/bin/env node

/**
 * cache-bust.js
 *
 * Applies a Date.now() timestamp as query strings (?v={timestamp}) for:
 *   - main.css and main.js  → in index.html and sw.js
 *   - index.html, scenarios.json, howler.js, and all script JS files → in sw.js
 * Also bumps the SW CACHE_NAME so stale caches are purged.
 *
 * Usage: node cache-bust.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HTML = join(__dirname, 'public', 'index.html');
const SW   = join(__dirname, 'public', 'sw.js');

// Files referenced in both index.html and sw.js
const TARGETS = [
  {
    htmlRef: /css\/main\.css(?:\?v=[a-zA-Z0-9]+)?/,
    swRef:   /\/css\/main\.css(?:\?v=[a-zA-Z0-9]+)?/,
    htmlNew: (t) => `css/main.css?v=${t}`,
    swNew:   (t) => `/css/main.css?v=${t}`,
  },
  {
    htmlRef: /js\/main\.js(?:\?v=[a-zA-Z0-9]+)?/,
    swRef:   /\/js\/main\.js(?:\?v=[a-zA-Z0-9]+)?/,
    htmlNew: (t) => `js/main.js?v=${t}`,
    swNew:   (t) => `/js/main.js?v=${t}`,
  },
];

// Files referenced only in sw.js
const SW_TARGETS = [
  {
    swRef: /\/scenarios-rpg\.json(?:\?v=[a-zA-Z0-9]+)?/,
    swNew: (t) => `/scenarios.json?v=${t}`,
  },
  {
    swRef: /\/js\/vendor\/howler\.js(?:\?v=[a-zA-Z0-9]+)?/,
    swNew: (t) => `/js/vendor/howler.js?v=${t}`,
  },
  {
    swRef: /\/js\/scripts\/show-fluffy-dice\.js(?:\?v=[a-zA-Z0-9]+)?/,
    swNew: (t) => `/js/scripts/show-fluffy-dice.js?v=${t}`,
  },
  {
    swRef: /\/js\/scripts\/arcade-cat\.js(?:\?v=[a-zA-Z0-9]+)?/,
    swNew: (t) => `/js/scripts/arcade-cat.js?v=${t}`,
  },
  {
    swRef: /\/js\/scripts\/troll-charm\.js(?:\?v=[a-zA-Z0-9]+)?/,
    swNew: (t) => `/js/scripts/troll-charm.js?v=${t}`,
  },
  {
    swRef: /\/js\/scripts\/show-wizard-charm\.js(?:\?v=[a-zA-Z0-9]+)?/,
    swNew: (t) => `/js/scripts/show-wizard-charm.js?v=${t}`,
  },
  {
    swRef: /\/js\/scripts\/show-magic-8-ball\.js(?:\?v=[a-zA-Z0-9]+)?/,
    swNew: (t) => `/js/scripts/show-magic-8-ball.js?v=${t}`,
  },
];

const ts = String(Date.now());

let html = readFileSync(HTML, 'utf8');
let sw   = readFileSync(SW, 'utf8');

// Phase 1: update html and sw for CSS/main.js targets
for (const { htmlRef, swRef, htmlNew, swNew } of TARGETS) {
  html = html.replace(htmlRef, htmlNew(ts));
  sw   = sw.replace(swRef, swNew(ts));
}

// Phase 2: update index.html version in sw
sw = sw.replace(/\/index\.html(?:\?v=[a-zA-Z0-9]+)?/, `/index.html?v=${ts}`);

// Phase 3: update sw for SW-only targets
for (const { swRef, swNew } of SW_TARGETS) {
  sw = sw.replace(swRef, swNew(ts));
}

console.log(`Applied timestamp: ?v=${ts}`);

// Bump the SW CACHE_NAME so stale caches are purged
sw = sw.replace(
  /(const CACHE_NAME\s*=\s*['"][^'"]+\.)(\d+)(['"]\s*;)/,
  (_, prefix, num, suffix) => `${prefix}${parseInt(num, 10) + 1}${suffix}`
);

writeFileSync(HTML, html, 'utf8');
console.log('Updated: public/index.html');

writeFileSync(SW, sw, 'utf8');
console.log('Updated: public/sw.js');
