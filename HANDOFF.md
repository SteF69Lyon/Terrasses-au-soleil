# Handoff — reprise du travail entre PCs

Ce fichier est le point de reprise partagé entre les 3 PCs. Il vit dans le repo et suit via `git pull`.

---

## 🚀 Reprise rapide

### Sur un PC déjà setup

```bash
cd /c/dev/terrasses-au-soleil
git pull origin main
npm install              # deps racine (Astro)
cd app && npm install    # deps SPA
cd .. && cd functions && npm install    # deps Cloud Functions
```

### Sur un nouveau PC (setup complet)

```bash
# 1. Cloner hors OneDrive
mkdir -p /c/dev
git clone https://github.com/SteF69Lyon/Terrasses-au-soleil.git /c/dev/terrasses-au-soleil
cd /c/dev/terrasses-au-soleil

# 2. Installer les 3 jeux de deps
npm install
cd app && npm install && cd ..
cd functions && npm install && cd ..

# 3. Recréer app/.env.local (non commité, spécifique à chaque PC)
echo "VITE_ADMIN_EMAIL=sflandrin@outlook.com" > app/.env.local

# 4. CLI Firebase
firebase projects:list    # si pas connecté : firebase login
firebase use terrassesausoleil

# 5. Vérifier compile
npm run build:astro    # produit dist/ avec la landing
cd app && npm run build    # produit app/dist/

# 6. (Optionnel) dev server
cd app && npm run dev    # http://localhost:3000/app/
```

Ouvrir Claude Code dans le repo et dire : *"Reprends le travail, lis HANDOFF.md"*.

---

## 🌅 Reprise — à lire en premier

**Dernière session** : 2026-04-23. Chantier "star de l'été" complet (PRs #26-29), fix SPA search (PRs #31-32), puis debug sitemap GSC (sitemap supprimé + resoumis dans Search Console à 11h environ).

**À valider dès la reprise (2 min) :**

1. **Recherche SPA** : https://terrasse-au-soleil.fr/app/ → chercher `café juliette Lyon` (cas qui foirait en "Erreur IA : internal"). PR #32 a ajouté un extracteur JSON bracket-balanced (Cloud Function redéployée manuellement).
   - ✅ Si ça marche : tout OK.
   - ❌ Si re-crash : `firebase functions:log --only geminiSearch | tail -40` → les logs donnent maintenant la tête + queue du JSON qui plante.

2. **Sitemap Search Console** : https://search.google.com/search-console → Sitemaps
   - Le sitemap a été **supprimé puis resoumis** en fin de session précédente pour forcer Google à refetcher (le cache précédent ne voyait que 1 URL à cause d'un ancien état transitoire).
   - **État attendu** après 12-24h : "Pages découvertes" doit être passé de 1 à **173**.
   - Si toujours à 1 après 48h : on soupçonne un bug plus profond (peu probable, le XML côté serveur est OK à 173 URLs).

3. **Indexation Google — onglet "Pages"** : normal de voir 0-5 URLs indexées les premiers jours, monte sur plusieurs semaines pour atteindre ~70-90% du sitemap. Indexation manuelle demandée pour les 5 plus grosses villes — quota GSC ~10/jour.

**Site en prod fonctionnel pour les pages SEO.** Seul risque résiduel : la search SPA peut encore foirer sur certaines queries spécifiques (format Gemini imprévisible) — à surveiller.

**Prochains chantiers envisageables, par ordre de ROI :**

1. **Indexation Google** (passif, 1-4 semaines) : Search Console propriété vérifiée, sitemap soumis. Patienter. Partager le lien sur forums/réseaux pour accélérer le crawl initial.
2. **AdSense** : demander validation compte → récupérer client ID → ajouter en secret GitHub `PUBLIC_ADSENSE_CLIENT`. Emplacements déjà câblés côté code, ils apparaîtront au prochain build.
3. **Promotion payante** : ajouter un champ `promoted: boolean` ou `promotionScore: number` sur chaque établissement. Trier par (promotionScore DESC, sunExposure DESC). Badge "Partenaire" visible.
4. **Phase 3 scoring** : imagerie satellite ou Street View pour détecter orientation réelle (au-delà du polygone OSM).
5. **Bundle SPA 968 kB** → code splitting pour Core Web Vitals.
6. **Expansion à 250-300 pages** : plus de villes (Le Mans, Limoges, Poitiers, Pau, Perpignan, Metz, Nancy, Caen, Brest).

---

## 📍 État du projet — 2026-04-23 fin de journée

Site complet en prod, 173 pages SEO, architecture stable. Le site sert :

- **Landing** `https://terrasse-au-soleil.fr/` : directory des 22 villes + intro + OG card personnalisée
- **~173 pages SEO** générées statiquement par Astro :
  - `/terrasses/[ville]/` (22 pages)
  - `/terrasses/[ville]/[quartier]/` (62 pages)
  - `/bar-ensoleille-[ville]/`, `/cafe-terrasse-[ville]/`, `/restaurant-terrasse-[ville]/`, `/ou-boire-un-verre-au-soleil-[ville]/` (88 pages)
- **SPA** `https://terrasse-au-soleil.fr/app/` : recherche IA temps réel
- **Sitemap** `https://terrasse-au-soleil.fr/sitemap-index.xml`
- **23 OG cards** `https://terrasse-au-soleil.fr/og/{slug}.png` (22 villes + default)

### Features utilisateur des pages SEO

Chaque page quartier/ville/variation propose :
- **Bannière live** (JS client-side) : heure actuelle, couverture nuageuse actuelle, score moyen, "meilleure terrasse maintenant"
- **Par terrasse** :
  - Photo (si taggée `wikimedia_commons` ou `image` dans OSM)
  - Score soleil statique (réf. 21 juin 17h Paris, calculé par suncalc + orientation bâtiment OSM + ombres portées)
  - Badge "Maintenant: X%" (live, réel à l'heure de visite)
  - Mini-graphique horaire 9h→21h (prévision suncalc × cloudcover Open-Meteo)
  - Analyse texte : orientation, élévation solaire, météo, ombre portée si pertinent
  - Lien Google Maps + site web si présent
- **MiniMap Leaflet** avec tous les markers
- **FAQ** (générée par Gemini au build, cachée 180j)
- **Intro narrative** (générée par Gemini au build, cachée 180j)
- **Quartiers liés** pour navigation inter-pages
- **OG card personnalisée ville** (gradient orange + halo soleil + nom ville) pour partages sociaux

### Scoring d'ensoleillement

Remplacement complet des estimations Gemini par un calcul **déterministe** :

- **Position soleil** : `suncalc` (algorithme NOAA) → azimuth + altitude précis pour une date/heure/lat/lng donnée
- **Orientation de la terrasse** : déduite de la géométrie du bâtiment OSM le plus proche (perpendiculaire à l'arête la plus longue, pointant vers la rue). Fallback sud si aucun bâtiment dans un rayon de 80 m.
- **Ombres portées** : projection 2D de l'ombre de chaque bâtiment voisin (height + tan(altitude)) → test point-dans-polygone. Si ombragé → multiplicateur 0.4 pour la lumière diffuse. Le bâtiment de l'établissement lui-même est exclu (distance < 8 m).
- **Couverture nuageuse** (SPA uniquement, pas SEO) : Open-Meteo API à la date/heure de recherche → facteur `(1 - cloud/100)`
- **Formule finale** : `cos(angle_soleil_vs_orientation) × sin(élévation) × (1 - nuages) × [0.4 si ombragé]`
- **Référence SEO** : 21 juin 15:00 UTC (= 17h Paris CEST) — "typique après-midi d'été"

Les pages SEO affichent pour chaque établissement l'orientation détectée, l'élévation du soleil en degrés, et mentionnent les ombres portées quand présentes. Les descriptions sont générées localement (pas d'appel Gemini à l'exécution).

### Gemini reste utilisé pour

- **Build SEO** : `generateIntro` (150-200 mots par page) + `generateFaq` (4 Q/R par page), générés une fois, cachés Firestore (180 j)
- **SPA runtime** : `geminiSearch` → découverte d'établissements dans la zone (avec Google Search grounding). Plus aucune estimation soleil : retourne la liste, puis le client suncalc-alike (côté Cloud Function) calcule le score déterministe avec la météo Open-Meteo.

### Déploiement

**Workflow GitHub Actions** (`.github/workflows/deploy.yml`) :
- Trigger : push sur `main`, workflow_dispatch manuel, OU **cron mensuel** (1er à 3h UTC) pour rafraîchir l'osmCache
- Étapes : checkout → Node 22 → install (racine + app/) → build (app + astro + merge-dist) → deploy FTPS sur Hostinger
- Durée premier build ~15 min (Overpass + Gemini pour 62 quartiers). Builds suivants ~3 min grâce au cache Firestore.

**Secrets GitHub** (configurés dans repo Settings) :
- `GEMINI_BUILD_KEY` — clé Gemini AI Studio pour intros + FAQ
- `FIREBASE_SERVICE_ACCOUNT` — JSON entier du service account
- `VITE_ADMIN_EMAIL` — email admin de la SPA
- `FTP_HOST`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_SERVER_DIR` — credentials FTPS Hostinger (FTP_SERVER_DIR = `./`)

**Hostinger** : sert `dist/` depuis `/home/u221564868/domains/terrasse-au-soleil.fr/public_html/`. Un auto-deploy Hostinger natif coexiste en fallback (build sans creds → landing simple) mais le GHA FTPS écrase ensuite avec le build complet.

**Repo public** : nécessaire pour débloquer les minutes GitHub Actions illimitées. Aucun secret dans le code ni dans l'historique git (SA JSON jamais commit, vérifié).

### Données Firestore

| Collection | Usage | TTL |
|---|---|---|
| `profiles` | Profils user SPA | persistant |
| `ads` | Pubs SPA | persistant |
| `osmCache` | Établissements OSM par page (clé `v2_*`, cap 100, avec imageUrl) | 30 j |
| `osmBuildings` | Bâtiments OSM par page, polygones flat (cap 800, par hauteur desc) | 30 j |
| `sunScores` | Scores déterministes par établissement (clé `d4_*`, avec facingDeg) | 90 j |
| `pageIntros` | Textes Gemini d'intro de page | 180 j |
| `pageFaqs` | FAQ Gemini par page | 180 j |
| `cityGeo` | Bbox géocodées par ville/quartier | ∞ |

**Note technique importante** : Firestore refuse les tableaux imbriqués. Les polygones de bâtiments (`[lng, lat][]`) sont donc stockés "flat" en `number[]` = `[lng1, lat1, lng2, lat2, ...]` et reconstruits au read. Géré par `toCached`/`fromCached` dans `src/lib/buildData.ts`.

---

## 🏗️ Contexte projet

**App :** Terrasses-au-soleil — recherche de terrasses ensoleillées en France via IA, couplée à des pages SEO statiques.

**URL prod :** https://terrasse-au-soleil.fr (Hostinger, FTPS via GitHub Action)

**Stack :**
- Astro 6 + React 19 (SEO statique)
- React 19 + Vite 6 (SPA dans `app/`)
- Firebase Cloud Functions v2, Node 22, europe-west1 (`geminiSearch`, `geminiTts`, `geminiLiveToken`)
- Firestore (7 collections)
- Gemini API (build + SPA runtime découverte)
- Google AI Studio pour keys
- OpenStreetMap Overpass (établissements + bâtiments)
- Open-Meteo (météo SPA)
- Leaflet (cartes)

**Projet Firebase :** `terrassesausoleil`

**Admin :** `sflandrin@outlook.com`

**Repo GitHub :** https://github.com/SteF69Lyon/Terrasses-au-soleil (public)

### Arbre

```
/c/dev/terrasses-au-soleil/
├── astro.config.mjs, package.json, tsconfig.json, vitest.config.ts
├── src/
│   ├── pages/                   (landing + dynamiques : terrasses/, bar-ensoleille-*, etc.)
│   ├── lib/                     (cache, urls, nominatim, overpass, buildings, sun, weather, gemini, jsonld, buildData, firebase)
│   ├── components/              (Layout, Breadcrumb, TerraceCard, AdSlot, FaqList, MiniMap, CityVariationPage, RelatedAreas, LiveSunBanner)
│   ├── scripts/live-sun.ts      (client-side : live banner + hourly chart, Astro bundle auto via <script>)
│   ├── data/cities.ts           (22 villes, 62 quartiers)
│   └── styles/global.css
├── tests/lib/                   (39 tests Vitest)
├── public/
│   ├── robots.txt, og-default.jpg
│   └── og/                      (généré au build, gitignored — 23 PNGs 1200×630)
├── app/                         (SPA Vite React — package.json autonome)
│   ├── App.tsx, components/, services/, index.html, vite.config.ts
│   └── .env.local               (non commité, VITE_ADMIN_EMAIL)
├── functions/                   (Cloud Functions — Node 22, firebase-functions v7)
│   └── src/                     (geminiSearch, geminiTts, geminiLiveToken, sun.ts, weather.ts)
├── scripts/
│   ├── merge-dist.mjs           (combine app/dist + Astro dist)
│   └── generate-og.mjs          (génère les 23 OG PNGs via resvg au build)
├── .github/workflows/deploy.yml (CI/CD + cron mensuel)
├── firebase.json, firestore.rules, firestore.indexes.json, .firebaserc
├── terrassesausoleil-firebase-adminsdk-*.json    (SA JSON local, gitignored)
├── docs/superpowers/{specs,plans}/
└── HANDOFF.md                   (ce fichier)
```

---

## ⏭️ Chantiers restants / idées

- **Task 21 — Search Console** : **FAIT (propriété vérifiée)**. Sitemap soumis à re-actualiser une fois le dernier GHA terminé pour qu'il passe de 1 URL à 170 URLs.
- **AdSense** : une fois du trafic installé, valider le compte AdSense → récupérer le client ID → l'ajouter en secret GitHub `PUBLIC_ADSENSE_CLIENT`. Les emplacements sont déjà câblés, ils apparaîtront au prochain build.
- **Étape Promotion payante** : ajouter un champ `promoted: boolean` ou `promotionScore: number` sur chaque établissement. Trier par (promotionScore DESC, sunExposure DESC) dans les pages et SPA. Badge "Partenaire" visible.
- **Expansion à 200-300 pages** : plus de quartiers par ville, ajouter plus de villes (Le Mans, Limoges, Poitiers, Pau, Perpignan, Metz, Nancy, Caen, Brest…).
- **Phase 3 scoring** : intégrer imagerie satellite ou street view pour détecter l'orientation réelle des terrasses, au-delà du polygone OSM.
- **Bundle SPA 968 kB** : code-splitting via dynamic imports sur `app/services/geminiService.ts` et composants lourds. Warning au build, impacte le Core Web Vitals.
- **firebase-functions v6 → v7** : **FAIT** (session 2026-04-22)
- **Node 20 → 22 Cloud Functions** : **FAIT** (avant deadline 2026-04-30)

---

## 🌐 Workflow cross-PC

- Le repo est la seule source de vérité (pas OneDrive pour le code).
- Fin de session : `git add -A && git commit -m "..." && git push`
- Début de session : `git pull`
- Si WIP : commit `wip: <état>` avant de partir.
- `.env.local` n'est pas commité — à recréer sur chaque PC.
- Le SA JSON Firebase n'est **jamais** commité (gitignored via pattern `*-firebase-adminsdk-*.json`).
- Pour builder localement avec creds, exporter dans le shell :
  ```bash
  export GOOGLE_APPLICATION_CREDENTIALS="/c/dev/terrasses-au-soleil/terrassesausoleil-firebase-adminsdk-fbsvc-198080c6ba.json"
  export GEMINI_BUILD_KEY="ta_cle_gemini"
  npm run build
  ```

## 🔧 Commandes utiles

| Besoin | Commande |
|---|---|
| Dev SPA | `cd app && npm run dev` → http://localhost:3000/app/ |
| Dev Astro | `npm run dev` → http://localhost:4321 |
| Build complet (app + astro + merge) | `npm run build` |
| Build Astro seul | `npm run build:astro` |
| Tests | `npm test` |
| Astro type-check | `npx astro check` |
| Déployer règles Firestore | `firebase deploy --only firestore:rules` |
| Déployer Cloud Functions | `firebase deploy --only functions` |
| Logs Functions | `firebase functions:log` |
| Trigger manuel GHA deploy | `gh workflow run "Build and deploy to Hostinger" --ref main` |
| Voir runs GHA | `gh run list --workflow=deploy.yml --limit 5` |
