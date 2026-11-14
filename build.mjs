// Build : copie src/ vers dist/, insère le CSS dans les pages, génère sitemap.xml et robots.txt.
// Usage : node build.mjs   (aucune dépendance)
import { cpSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// Adresse publique du site. À changer ici (une seule fois) si vous branchez un nom de domaine.
const SITE = 'https://alph3789-sketch.github.io/casa-grill-vayres';
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
  writeFileSync(f, readFileSync(f, 'utf8').replace('/*INLINE_CSS*/', () => css).replaceAll('https://casagrill-vayres.fr', SITE));
}
rmSync(new URL('css/', dist), { recursive: true, force: true });

// Données + JS insérés dans index.html : aucune requête bloquante, aucun décalage de mise en page.
const json = (f) => JSON.parse(readFileSync(new URL(f, src), 'utf8'));
const data = JSON.stringify({ menu: json('data/menu.json'), config: json('data/config.json') }).replace(/</g, '\\u003c');
const js = readFileSync(new URL('js/app.js', src), 'utf8').replace(/<\/script/gi, '<\\/script');
// Décide dès le <head> si le bandeau s'affiche, pour éviter tout décalage de la page au chargement.
const bn = json('data/config.json').banner || {};
const boot = `(function(){try{var b=${JSON.stringify({ e: !!bn.enabled && (bn.messages || []).length > 0, f: bn.announceFrom || bn.startDate || '', t: bn.endDate || '' })};if(!b.e)return;
var m=/[?&]simnow=([0-9T:\\-]+)/.exec(location.search),n;
if(m)n=decodeURIComponent(m[1]);else{var p={};new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).forEach(function(x){p[x.type]=x.value});n=p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute}
if((b.f&&n<b.f)||(b.t&&n>b.t))return;var c=document.documentElement.classList;c.add('hn');
var k=0;try{k=+localStorage.getItem('cg-banner-closed')||0}catch(e){}if(Date.now()-k>=864e5)c.add('bn')}catch(e){}})();`;
const idx = new URL('index.html', dist);
let html = readFileSync(idx, 'utf8')
  .replace(/\s*<link rel="preload" href="data\/[^>]+>/g, '')
  .replace('/*BANNER_BOOT*/', () => boot)
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
