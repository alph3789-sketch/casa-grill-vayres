// Build : copie src/ vers dist/, insère le CSS dans les pages, génère sitemap.xml et robots.txt.
// Usage : node build.mjs   (aucune dépendance)
import { cpSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SITE = 'https://casagrill-vayres.fr';
const src = new URL('./src/', import.meta.url);
const dist = new URL('./dist/', import.meta.url);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(src, dist, { recursive: true });

const minCss = (css) => css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s*\n\s*/g, '')
  .replace(/\s*([{};,>])\s*/g, '$1')
  .replace(/;}/g, '}');
const css = minCss(readFileSync(new URL('css/style.css', src), 'utf8'));

for (const page of ['index.html', 'mentions-legales.html']) {
  const f = new URL(page, dist);
  writeFileSync(f, readFileSync(f, 'utf8').replace('/*INLINE_CSS*/', () => css));
}
rmSync(new URL('css/', dist), { recursive: true, force: true });

// Données + JS insérés dans index.html : aucune requête bloquante, aucun décalage de mise en page.
const json = (f) => JSON.parse(readFileSync(new URL(f, src), 'utf8'));
const data = JSON.stringify({ menu: json('data/menu.json'), config: json('data/config.json') }).replace(/</g, '\\u003c');
const js = readFileSync(new URL('js/app.js', src), 'utf8').replace(/<\/script/gi, '<\\/script');
const idx = new URL('index.html', dist);
let html = readFileSync(idx, 'utf8')
  .replace(/\s*<link rel="preload" href="data\/[^>]+>/g, '')
  .replace('<script src="js/app.js" defer></script>', () => `<script id="cg-data" type="application/json">${data}</script>\n<script>${js}</script>`);
writeFileSync(idx, html);

const today = new Date().toISOString().slice(0, 10);
writeFileSync(new URL('sitemap.xml', dist), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE}/mentions-legales.html</loc><lastmod>${today}</lastmod><changefreq>yearly</changefreq><priority>0.2</priority></url>
</urlset>
`);
writeFileSync(new URL('.nojekyll', dist), '');
writeFileSync(new URL('robots.txt', dist), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log('dist/ prêt — CSS inline :', css.length, 'octets');
