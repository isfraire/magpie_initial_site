#!/usr/bin/env node
/** build.mjs — renders the static site from data/ into site/ */
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderIndex, renderAlertPage, renderSitemap, SITE } from '../src/template.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site');

const alerts = JSON.parse(await readFile(path.join(ROOT, 'data', 'alerts.json'), 'utf8'));
const meta = JSON.parse(await readFile(path.join(ROOT, 'data', 'sweep-meta.json'), 'utf8'));

await rm(OUT, { recursive: true, force: true });
await mkdir(path.join(OUT, 'alerts'), { recursive: true });

await writeFile(path.join(OUT, 'index.html'), renderIndex(alerts, meta));
for (const a of alerts) {
  await writeFile(path.join(OUT, 'alerts', `${a.id}.html`), renderAlertPage(a));
}
await copyFile(path.join(ROOT, 'src', 'styles.css'), path.join(OUT, 'styles.css'));
await copyFile(path.join(ROOT, 'src', 'app.js'), path.join(OUT, 'app.js'));

// Standalone single-file build: CSS + JS inlined, for previews and sharing.
// The deployed site keeps external files for caching; this file needs nothing.
const [indexHtml, css, js] = await Promise.all([
  readFile(path.join(OUT, 'index.html'), 'utf8'),
  readFile(path.join(ROOT, 'src', 'styles.css'), 'utf8'),
  readFile(path.join(ROOT, 'src', 'app.js'), 'utf8'),
]);
const standalone = indexHtml
  .replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`)
  .replace('<script src="app.js" defer></script>', `<script>\n${js}\n</script>`)
  .replace(/href="alerts\/[^"]+\.html"/g, 'href="#feed"'); // permalinks need the full site
await writeFile(path.join(OUT, 'magpie-news-standalone.html'), standalone);

const sitemap = renderSitemap(alerts);
if (sitemap) {
  await writeFile(path.join(OUT, 'sitemap.xml'), sitemap);
  await writeFile(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE.baseUrl}/sitemap.xml\n`);
} else {
  await writeFile(path.join(OUT, 'robots.txt'), 'User-agent: *\nAllow: /\n');
}
await writeFile(path.join(OUT, '.nojekyll'), '');

console.log(`Built site/ · index + ${alerts.length} alert pages${sitemap ? ' + sitemap' : ' (set MAGPIE_BASE_URL for sitemap/canonical URLs)'}`);
