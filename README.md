# Casa Grill Vayres — site vitrine + commande WhatsApp

Site statique, mobile-first, en HTML/CSS/JS vanilla (aucun framework, aucune dépendance).

## Modifier le site sans toucher au code

| Je veux changer… | Fichier |
|---|---|
| un prix, un plat, une catégorie, les horaires, le téléphone | `src/data/menu.json` |
| le bandeau « Spéciale ouverture » (textes, dates) | `src/data/config.json` → `banner` |
| une fermeture exceptionnelle (jour férié, congés) | `src/data/config.json` → `closures` |
| les liens Uber Eats / Deliveroo / Facebook / Instagram / TikTok | `src/data/config.json` → `links` (un lien vide = bouton masqué) |
| les statistiques (Plausible ou Umami) | `src/data/config.json` → `analytics.provider` = `"plausible"` ou `"umami"` |

Après une modification, il faut relancer le build (Netlify le fait tout seul à chaque mise en ligne).

### Bandeau « Spéciale ouverture »
- `announceFrom` : le bandeau apparaît à partir de cette date.
- `startDate` : date de la grande ouverture. Tant qu'elle n'est pas passée, le hero affiche un compte à rebours.
- `endDate` : le bandeau et le badge « Nouveau à Vayres » disparaissent après cette date.
- `blockOrdersBeforeStart` (optionnel, `true`/`false`) : si `true`, aucun créneau de commande n'est proposé avant `startDate`.

### Fermetures exceptionnelles
```json
"closures": [
  { "date": "2026-12-25", "label": "Noël" },
  { "from": "2027-08-01", "to": "2027-08-15", "label": "Congés" }
]
```
Le statut ouvert/fermé, les créneaux et la page des horaires en tiennent compte.

## Lancer en local
```bash
node build.mjs
```
```bash
python3 -m http.server 8080 --directory dist
```
Ouvrez ensuite http://localhost:8080. Pour simuler une heure (heure de Paris) : `http://localhost:8080/?simnow=2026-11-16T15:30`.

## Mise en ligne (Netlify, gratuit)
1. Créez un dépôt GitHub avec ce dossier, puis « Add new site → Import from Git » sur Netlify. `netlify.toml` règle déjà la commande (`node build.mjs`) et le dossier (`dist`).
2. Branchez le domaine (par ex. `casagrill-vayres.fr`). Si vous en choisissez un autre, remplacez `casagrill-vayres.fr` dans `src/index.html`, `src/mentions-legales.html`, `build.mjs` et `config.json`.
3. Créez ou réclamez la fiche **Google Business Profile** et mettez l'adresse du site dans le champ « Site web ». C'est le plus important pour le référencement local.
4. Imprimez `qr-flyer.png` sur les affiches. Il pointe vers `?utm_source=flyer`, ce qui permet de compter ces visites dans Plausible ou Umami.

## À compléter avant la mise en ligne
- [ ] `src/mentions-legales.html` : raison sociale, SIRET, directeur de la publication, hébergeur (surlignés).
- [ ] `config.json` : vraies dates d'ouverture (celles en place sont des exemples : ouverture le 09/11/2026, fin du bandeau le 14/12/2026 — à ajuster).
- [ ] `config.json` : liens Uber Eats, Deliveroo et réseaux sociaux.
- [ ] Coordonnées GPS du JSON-LD (`geo` dans `src/index.html`) : elles sont approximatives, à remplacer par celles de la fiche Google.

## Structure
```
src/
  index.html            page unique (hero, carte, horaires, accès)
  mentions-legales.html
  css/style.css         inséré dans les pages au build
  js/app.js             statut, carte, panier, WhatsApp, bandeau (inséré au build)
  data/menu.json        plats, prix, horaires
  data/config.json      bandeau, fermetures, liens, statistiques
  img/                  photos recadrées (AVIF + WebP), logo, icônes, og-image
  fonts/                Rakkas + Figtree (auto-hébergées, latin)
sources/                affiches originales
build.mjs               build sans dépendance → dist/
```
