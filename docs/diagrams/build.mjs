// Builds the editable Excalidraw scene and its SVG/PNG exports from architecture.scene.mjs.
// Usage: [PLAYWRIGHT_CORE=<path>] [CHROME_PATH=<chrome>] node docs/diagrams/build.mjs <excalidraw-tool-dir>
// <excalidraw-tool-dir> is a scratch folder (outside this repo) holding `bundle.js`: @excalidraw/excalidraw@0.18.1
// bundled with esbuild so that `window.ExLib` exposes convertToExcalidrawElements, serializeAsJSON, exportToSvg,
// exportToBlob and restore. Nothing is added to Reprise's own dependencies.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import skeleton, { groups } from './architecture.scene.mjs';

const toolDir = process.argv[2];
if (!toolDir) throw new Error('Pass the excalidraw tool directory (contains bundle.js).');
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage();
page.on('pageerror', e => console.error('pageerror:', e.message.slice(0, 400)));
await page.setContent('<html><body style="margin:0"></body></html>');
await page.addScriptTag({ content: readFileSync(join(toolDir, 'bundle.js'), 'utf8') });

const result = await page.evaluate(async ({ skeleton, groups }) => {
  const L = window.ExLib;
  const elements = L.convertToExcalidrawElements(skeleton, { regenerateIds: false });
  // Group each box with its bound title and its body text so a box moves as one object.
  for (const g of groups) {
    for (const el of elements) {
      if (el.id === g || el.id === `${g}-title` || el.id === `${g}-body` || el.containerId === g) el.groupIds = [`grp-${g}`];
    }
  }
  const appState = { viewBackgroundColor: '#f7f6f2', exportBackground: true, exportWithDarkMode: false, exportEmbedScene: false, gridSize: null };
  const files = {};
  const json = L.serializeAsJSON(elements, appState, files, 'local');
  const svg = await L.exportToSvg({ elements, appState, files, exportPadding: 36 });
  const svgText = new XMLSerializer().serializeToString(svg);
  const blob = await L.exportToBlob({ elements, appState, files, mimeType: 'image/png', exportPadding: 36,
    getDimensions: (w, h) => ({ width: w * 2, height: h * 2, scale: 2 }) });
  const png = Array.from(new Uint8Array(await blob.arrayBuffer()));
  return { json, svgText, png, count: elements.length, types: elements.reduce((m, e) => (m[e.type] = (m[e.type] ?? 0) + 1, m), {}) };
}, { skeleton, groups });

const scene = JSON.parse(result.json);
scene.source = 'https://excalidraw.com';
writeFileSync(join(here, 'reprise-architecture.excalidraw'), JSON.stringify(scene, null, 2) + '\n');
// Excalidraw writes only "Helvetica, Segoe UI Emoji"; add generic fallbacks so Linux viewers do not drop to a serif face.
const svgText = result.svgText.replaceAll('font-family="Helvetica, Segoe UI Emoji"', 'font-family="Helvetica, Arial, \'Liberation Sans\', sans-serif"');
writeFileSync(join(here, '..', 'assets', 'reprise-architecture.svg'), svgText);
writeFileSync(join(here, '..', 'assets', 'reprise-architecture.png'), Buffer.from(result.png));
console.log('elements', result.count, JSON.stringify(result.types));
await browser.close();
