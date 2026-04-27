# Handoff — Terrasses au soleil

Source de vérité partagée entre PCs. Vit dans le repo et suit `git pull`.

---

## 🌅 Reprise — à lire en premier

**Dernière session : 2026-04-27 (soir).** Migration Firebase → Supabase **terminée à 100%**, puis premier sprint SEO offensif (maillage + différenciation des variations).

### À faire dès l'arrivée demain (5-10 min)

1. **Sur la nouvelle machine, mettre à jour le code** :
   ```bash
   cd /c/dev/terrasses-au-soleil
   git checkout main
   git pull origin main
   npm install         # racine (Astro)
   cd app && npm install && cd ..
   ```
   Si c'est une machine vierge, voir [section "Setup d'un nouveau PC"](#-setup-machine) plus bas.

2. **Recréer le fichier `app/.env.local`** (non commité, par PC) en **UTF-8 sans BOM** :
   ```powershell
   [System.IO.File]::WriteAllLines(
     "C:\dev\terrasses-au-soleil\app\.env.local",
     @(
       "VITE_ADMIN_EMAIL=sflandrin@outlook.com",
       "VITE_SUPABASE_URL=https://api.terrasse-au-soleil.fr",
       "VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc3MjgxMTQwLCJleHAiOjIwOTI2NDExNDB9.3EcrcApo_E4UhTGwr_JsFn9k-pp4Ei88reTOPIszURU"
     ),
     (New-Object System.Text.UTF8Encoding $false)
   )
   ```
   ⚠️ **N'utilise pas** `Set-Content` ou `Out-File` standard PowerShell — ils écrivent en UTF-16 ou UTF-8 BOM, ce qui casse le parsing Vite.

3. **Vérifier en prod** :
   - https://terrasse-au-soleil.fr/ → landing avec footer riche (22 villes + 18 recherches populaires)
   - https://terrasse-au-soleil.fr/terrasses/lyon/vieux-lyon/ → page complète avec live-sun banner, mini-graphique, photos
   - https://terrasse-au-soleil.fr/bar-ensoleille-lyon/ → intro SPÉCIFIQUE bars (pas la même que `/terrasses/lyon/`)
   - https://terrasse-au-soleil.fr/app/ → recherche live, pas d'erreur "Erreur IA"

4. **Vérifier le dernier GHA build** :
   ```powershell
   gh run list --workflow=deploy.yml --limit 3
   ```
   Le run le plus récent (PR #47) doit être en `success`.

5. **Search Console** (https://search.google.com/search-console) :
   - Onglet **Sitemaps** → "Pages découvertes" devrait être à 173
   - Onglet **Pages** → laisser quelques jours pour voir l'effet du maillage enrichi (PR #46)

### Phrase magique à dire à Claude pour reprendre

> *"Reprends, lis HANDOFF.md. On est sur main, stack Supabase 100%, dernier chantier était SEO maillage interne + différenciation variations (PRs #46-47). Que veux-tu attaquer maintenant ? J'ai en tête E (filtres avancés), F (blog SEO), 5 (Core Web Vitals)."*

---

## 📍 État du projet — 2026-04-27

### Architecture en prod

- **Frontend** servi sur `https://terrasse-au-soleil.fr/` (Hostinger, FTPS via GitHub Action) :
  - **173 pages SEO statiques** générées par Astro 6 + React 19
  - **SPA Vite + React 19** sur `/app/` pour la recherche live
  - **23 OG cards** PNG personnalisées par ville (`/og/{slug}.png`)
- **Backend** sur `https://api.terrasse-au-soleil.fr/` (VPS Hostinger 195.35.29.52) :
  - Stack Supabase self-hosted (Postgres + GoTrue + PostgREST + Realtime + Storage + Edge Runtime + Studio + Kong + Vector + Analytics + Meta + ImgProxy + Pooler)
  - 2 Edge Functions Deno : `search-terraces` (recherche live) et `live-token`
- **CI/CD** : GitHub Actions sur push main → build Astro + SPA + merge dist + upload FTPS Hostinger. Cron mensuel le 1er à 03h UTC pour rafraîchir le cache OSM.
- **Aucune dépendance Firebase** dans le code, aucun deploy Firebase, aucune Cloud Function. Tout est sur Supabase.

### Pages SEO (173 URLs au sitemap)

| URL pattern | Nombre | Source |
|---|---|---|
| `/` (landing) | 1 | `src/pages/index.astro` |
| `/terrasses/[ville]/` | 22 | `src/pages/terrasses/[ville]/index.astro` |
| `/terrasses/[ville]/[quartier]/` | 62 | `src/pages/terrasses/[ville]/[quartier].astro` |
| `/bar-ensoleille-[ville]/` | 22 | via `CityVariationPage.astro` |
| `/cafe-terrasse-[ville]/` | 22 | idem |
| `/restaurant-terrasse-[ville]/` | 22 | idem |
| `/ou-boire-un-verre-au-soleil-[ville]/` | 22 | idem |

Configuration : `src/data/cities.ts` (22 villes, 62 quartiers).

### Features par page SEO

- Bannière live (heure, météo, score moyen, meilleure terrasse maintenant)
- Cartes établissement avec photo OSM (si `wikimedia_commons` ou `image` présent), score soleil statique (réf. 21 juin 17h Paris), badge "Maintenant: X%" live, mini-graphique horaire 9h→21h, badge "Ouvert/Fermé" depuis OSM `opening_hours`, bouton "Partager"
- Carte Leaflet avec markers colorés par score soleil
- FAQ et intro narrative (générées par routeur AI au build, **distinctes par variation** depuis PR #47)
- Footer global avec 22 villes + 18 recherches populaires (PR #46)
- Sur les pages variation : section "Voir aussi à {ville}" pointant vers les 3 autres variations + 4 quartiers + page ville
- Sur les pages quartier : sections "Autres quartiers de {ville}" + "Découvrir d'autres villes" (cross-city)
- Données structurées JSON-LD : BreadcrumbList, ItemList (avec LocalBusiness type-mappé), FAQPage, WebPage
- OG card personnalisée par ville pour partages sociaux (gradient orange + halo soleil + nom ville)
- Sitemap auto avec exclusion `/app/`

### Scoring soleil (déterministe, sans LLM à l'exécution)

- **Position soleil** : `suncalc` (algorithme NOAA) → azimuth + altitude pour lat/lng/date/heure exacts
- **Orientation terrasse** : déduite du polygone OSM du bâtiment le plus proche (perpendiculaire à l'arête la plus longue, pointant vers la rue). Fallback sud si rien dans 80 m.
- **Ombres portées** : projection 2D des bâtiments OSM (height + tan(altitude)). Si terrasse dans une ombre → multiplicateur 0.4. Le bâtiment hôte (< 8 m) est exclu pour éviter de s'auto-ombrer.
- **Météo** (SPA uniquement, pas SEO statique) : Open-Meteo API → facteur `(1 - cloud_cover/100)`. Cache module-level lat/lng arrondis à 1 décimale (~10 km) pour éviter les 429.
- **Formule** : `cos(angle_soleil_vs_orientation) × sin(élévation) × (1 − nuages) × [0.4 si ombragé]`
- **Référence SEO statique** : 21 juin 15:00 UTC (= 17h Paris CEST), seed déterministe.
- **SPA live** : utilise la date/heure choisies par l'utilisateur + météo réelle.

### IA (routeur multi-provider)

- **Côté Astro Node** (build SEO) : `src/lib/ai-router.ts` avec fallback Anthropic Claude Sonnet 4.5 → OpenAI GPT-4o-mini → Google Gemini 2.5 Flash. Skip silencieusement les providers sans clé.
- **Côté Edge Functions Deno** (SPA runtime) : `terrasses-supabase-stack/supabase/functions/_shared/ai-router.ts`, même chaîne de fallback.
- **Usages au build** : `generateIntro` (~150-200 mots par page) et `generateFaq` (4 Q/R). **Depuis PR #47** : intros et FAQs sont **différenciées par variation** — angle apéro pour `bar-ensoleille-*`, pause café/brunch pour `cafe-terrasse-*`, gastronomie pour `restaurant-terrasse-*`, heures dorées pour `ou-boire-un-verre-au-soleil-*`. Cache key : `seo_cache.pageIntros["{pageId}-{variation}"]`.
- **Usages runtime** : `search-terraces` Edge Function appelle le router pour la découverte d'établissements (extracteur JSON bracket-balanced + retry 1× sur réponse vide, depuis PR #32 du repo infra).

### Tables Supabase (Postgres)

| Table | Usage | TTL applicatif |
|---|---|---|
| `profiles` | Profils user SPA | persistant |
| `ads` | Pubs admin SPA | persistant |
| `osm_cache` | Établissements OSM (Edge Functions runtime) | 7 j |
| `seo_cache` | Cache générique build (collection, id, jsonb data) | variable selon collection |

`seo_cache` remplace 6 collections Firestore historiques. Sous-clés (collection) :
- `cityGeo` : bbox géocodées par ville/quartier (∞)
- `osmCache` : établissements par page (clé `v3_*`, cap 100, TTL 30 j)
- `osmBuildings` : bâtiments par page (cap 800 par hauteur desc, polygones flat lng/lat séquentiel pour Firestore-compat héritée, TTL 30 j)
- `sunScores` : scores déterministes par établissement (clé `d4_*`, TTL 90 j)
- `pageIntros` : intros AI (clé `{pageId}-{variation?}`, TTL 180 j)
- `pageFaqs` : FAQs AI (idem, TTL 180 j)

RLS activée sans policies publiques sur `seo_cache` → seul le service role (build) peut écrire/lire.

### Indexation Google (suivi en cours)

- Sitemap soumis à 173 URLs, **propriété GSC vérifiée**.
- État au 2026-04-27 : 173 découvertes, ~4 indexées, 167 "détectées non indexées", 1 "page en double".
- **PR #46** (maillage interne) et **PR #47** (différenciation variations) viennent juste d'être déployées pour tuer la duplication et booster le crawl. Effet attendu : visible dans GSC d'ici 3-7 jours.
- Indexation manuelle demandée pour les 5 plus grosses villes (quota GSC ~10/jour).

### Chantiers historiques (FAIT)

- Migration Firebase → Supabase complète (Phase 7+8) : code, infra, tables, secrets
- 4 quick wins "star de l'été" : badge ouvert maintenant, hourly chart SPA, markers colorés, bouton partager
- Routeur AI build-time multi-provider (port du Deno côté Node)
- Bracket-balanced JSON extractor pour parser les réponses Gemini/Claude truncated
- Fix Open-Meteo 429 (cache lat/lng arrondis)
- Maillage interne enrichi : footer global, cross-links variations, landing avec quartiers populaires, cross-city sur quartier
- Différenciation éditoriale variations vs ville (anti-duplicate)

---

## 🚀 Setup machine

### Sur un PC déjà setup

```bash
cd /c/dev/terrasses-au-soleil
git checkout main
git pull origin main
npm install
cd app && npm install && cd ..
```

Puis recréer `app/.env.local` (voir [§ Reprise](#-reprise--à-lire-en-premier) point 2).

### Sur un nouveau PC (setup complet, ~10 min)

```powershell
# 1. Cloner hors OneDrive
mkdir -p C:\dev
git clone https://github.com/SteF69Lyon/Terrasses-au-soleil.git C:\dev\terrasses-au-soleil
cd C:\dev\terrasses-au-soleil

# 2. Installer les deux jeux de deps (root Astro + app/ SPA)
npm install
cd app
npm install
cd ..

# 3. Recréer app/.env.local en UTF-8 no-BOM (voir Reprise pour le snippet)

# 4. Vérifier que ça compile
npm run build:astro    # produit dist/ avec landing seule (skip pages dynamiques sans creds Supabase)
cd app
npm run build         # produit app/dist/ complet
cd ..
```

Puis ouvrir Claude Code dans le repo et dire la phrase magique de la § Reprise.

⚠️ **Le build complet local nécessite les creds Supabase + au moins une clé AI** (cf. § Build local complet plus bas). Sans ces creds, le build skip les pages dynamiques. C'est OK pour vérifier que ça compile, mais pour reproduire la prod il faut les exports d'env.

### Build local complet (avec creds, optionnel)

Si besoin de tester localement le pipeline de build complet (les 173 pages avec contenu réel) :

```bash
export SUPABASE_URL="https://api.terrasse-au-soleil.fr"
export SUPABASE_SERVICE_ROLE_KEY="..."  # ssh root@195.35.29.52 'grep ^SERVICE_ROLE_KEY= /opt/terrasses-supabase/upstream-supabase/docker/.env'
export ANTHROPIC_API_KEY="..."          # idem grep ^ANTHROPIC_API_KEY=
export GEMINI_BUILD_KEY="..."           # AIStudio
export VITE_ADMIN_EMAIL="sflandrin@outlook.com"
export VITE_SUPABASE_URL="https://api.terrasse-au-soleil.fr"
export VITE_SUPABASE_ANON_KEY="..."

npm run build
```

---

## ⏭️ Chantiers ouverts (priorisés)

### Quick wins SEO (1-2h chacun)

- **C — Bing Webmaster Tools + IndexNow** *(à faire côté ops, ~10 min)* : ajouter le site sur https://www.bing.com/webmasters, vérifier la propriété (méta tag dans Layout ou fichier), soumettre `https://terrasse-au-soleil.fr/sitemap-index.xml`, activer IndexNow. Bing crawle agressivement, parfois déclenche un re-crawl Google.
- **5 — Core Web Vitals SPA** : le bundle SPA fait 968 kB, ça pénalise mobile. Code-splitting via dynamic imports sur `app/services/geminiService.ts` et les composants lourds (Leaflet notamment). Estimation 2-4h. Impact direct LCP, CLS, et signal SEO.
- **Améliorer méta-descriptions** : actuellement génériques. Les enrichir avec des chiffres et hooks. ~30 min.

### Moyen terme (gros levier trafic, 3-6h chacun)

- **F — Section blog SEO** : 5-10 articles longue traîne saisonniers (*"Top 10 terrasses ensoleillées Lyon mai 2026"*, *"Où boire un verre au soleil le dimanche à Paris"*, etc.). À générer via le router AI au build, cacher dans `seo_cache`. Énorme levier sur les requêtes conversationnelles.
- **E — Filtres avancés OSM** : tags OSM "terrasse avec vue" (`view`), "bord de l'eau" (`waterway` proximité), "enfants acceptés" (`child_friendly`), "chien accepté" (`dog`). Multiplie les pages utiles. Utilisable comme générateur de pages secondaires *"Bars chiens acceptés à Lyon"*.
- **Expansion 250-300 pages** : Le Mans, Limoges, Poitiers, Pau, Perpignan, Metz, Nancy, Caen, Brest, Saint-Étienne, Le Havre, Nîmes, Caen. Édition simple de `src/data/cities.ts` puis rebuild.

### Long terme (gros chantiers, 1+ semaine)

- **G — Push notifications web** : "Demain 26°C ensoleillé, ta terrasse favorite à Lyon : 85%". Service worker + abonnement.
- **H — PWA installable** : manifest + cache offline.
- **I — Multi-langue EN/IT/DE** : Astro i18n. Cible touristes l'été.
- **J — User reviews** : crowdsourcing scores soleil + commentaires + photos. Auth Supabase + table `reviews` + UI moderation admin.
- **Phase 3 scoring** : imagerie satellite ou Street View pour orientation réelle.

### Business / monétisation

- **AdSense** : en attente du courrier de validation Google. Une fois reçu : ajouter `PUBLIC_ADSENSE_CLIENT` en secret GitHub → rebuild → pubs partout (emplacements `<AdSlot>` déjà câblés).
- **Promotion payante** : champ `promotionScore` dans Postgres, tri pondéré `(promotionScore DESC, sunExposure DESC)`, badge "Partenaire". À conditionner après validation AdSense + premier trafic mesuré.

### Fix non bloquant

- **WebSocket Realtime** (`wss://api.terrasse-au-soleil.fr/realtime/v1/websocket`) — Traefik n'upgrade pas WS. Symptôme : warnings dans la console SPA admin. Pas d'impact fonctionnel sur la recherche ni le SEO. Fix dans la config Traefik VPS.

---

## 🏗️ Contexte technique

### Repos

- **Frontend** : https://github.com/SteF69Lyon/Terrasses-au-soleil (`main`)
- **Infra Supabase** : https://github.com/SteF69Lyon/terrasses-supabase-stack (`main`) — Edge Functions Deno + migrations SQL + scripts ops VPS

### Stack

- **Build SEO** : Astro 6 + React 19 islands, statique, sortie `dist/`
- **SPA** : Vite 6 + React 19, sortie `app/dist/` mergée dans `dist/app/` au build
- **Backend** : Supabase self-hosted sur VPS, Edge Runtime Deno
- **DB** : Postgres 15 (Supabase)
- **AI router** : Claude Sonnet 4.5 → GPT-4o-mini → Gemini 2.5 Flash
- **Cartes** : Leaflet + react-leaflet, tiles OSM
- **Données** : OpenStreetMap Overpass + Nominatim (gratuits, throttled), Open-Meteo (gratuit)
- **OG generation** : SVG → PNG via `@resvg/resvg-js` au build

### URLs et accès

- **Prod web** : https://terrasse-au-soleil.fr
- **API Supabase** : https://api.terrasse-au-soleil.fr
- **VPS** : `ssh root@195.35.29.52`
- **Supabase Studio** (via tunnel) :
  ```bash
  ssh -L 3010:127.0.0.1:3010 root@195.35.29.52
  # puis ouvrir http://127.0.0.1:3010
  ```
  Login = `admin` + `DASHBOARD_PASSWORD` du `.env` VPS
- **Supabase config VPS** : `/opt/terrasses-supabase/upstream-supabase/docker/.env`
- **Anon key publique** (côté front) :
  ```
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc3MjgxMTQwLCJleHAiOjIwOTI2NDExNDB9.3EcrcApo_E4UhTGwr_JsFn9k-pp4Ei88reTOPIszURU
  ```

### Secrets GitHub Actions (configurés sur le repo Frontend)

| Secret | Usage |
|---|---|
| `ANTHROPIC_API_KEY` | Build SEO (router AI primary) |
| `OPENAI_API_KEY` | Build SEO (router AI fallback) |
| `GEMINI_BUILD_KEY` | Build SEO (router AI last resort) |
| `SUPABASE_URL` | Build SEO (cache Postgres) |
| `SUPABASE_SERVICE_ROLE_KEY` | Build SEO (cache Postgres, admin) |
| `VITE_SUPABASE_ANON_KEY` | SPA build (client public) |
| `VITE_ADMIN_EMAIL` | SPA build (contrôles admin UI) |
| `PUBLIC_ADSENSE_CLIENT` | Optionnel, vide aujourd'hui |
| `FTP_HOST`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_SERVER_DIR` | Deploy FTPS Hostinger |

### Arbre

```
/c/dev/terrasses-au-soleil/
├── astro.config.mjs, package.json, tsconfig.json, vitest.config.ts
├── src/
│   ├── pages/                       (landing + dynamiques)
│   │   ├── index.astro
│   │   ├── terrasses/[ville]/index.astro
│   │   ├── terrasses/[ville]/[quartier].astro
│   │   ├── bar-ensoleille-[ville].astro
│   │   ├── cafe-terrasse-[ville].astro
│   │   ├── restaurant-terrasse-[ville].astro
│   │   └── ou-boire-un-verre-au-soleil-[ville].astro
│   ├── lib/
│   │   ├── ai-router.ts            (Claude → GPT → Gemini avec fallback)
│   │   ├── supabase-admin.ts       (client admin pour cache build)
│   │   ├── cache.ts                (getCached/setCached vers seo_cache)
│   │   ├── buildData.ts            (orchestrateur build : geocode + overpass + AI)
│   │   ├── nominatim.ts, overpass.ts, buildings.ts, sun.ts, weather.ts
│   │   ├── gemini.ts               (generateIntro/generateFaq, accepte variation)
│   │   ├── jsonld.ts, urls.ts, openingHours.ts
│   ├── components/
│   │   ├── Layout.astro            (footer global enrichi)
│   │   ├── CityVariationPage.astro (template variations + cross-links)
│   │   ├── TerraceCard.astro, MiniMap.tsx, LiveSunBanner.astro
│   │   ├── Breadcrumb.astro, FaqList.astro, RelatedAreas.astro, AdSlot.astro
│   ├── scripts/
│   │   ├── live-sun.ts             (client-side : badge live + hourly chart + open status)
│   │   └── share.ts                (Web Share API + clipboard fallback)
│   ├── data/cities.ts              (22 villes, 62 quartiers)
│   └── styles/global.css
├── tests/lib/                      (49 tests Vitest, 100% verts)
├── public/
│   ├── robots.txt, og-default.jpg, googleb0f5b7a0901e81f3.html (GSC verif)
│   └── og/                         (généré au build via resvg, gitignored)
├── app/                            (SPA Vite + React)
│   ├── App.tsx, components/, services/, lib/liveSun.ts
│   ├── package.json, vite.config.ts (base: '/app/')
│   └── .env.local                  (NON commité, à recréer par PC, UTF-8 no-BOM)
├── scripts/
│   ├── merge-dist.mjs              (combine app/dist + Astro dist)
│   └── generate-og.mjs             (23 OG PNGs via resvg)
├── docs/superpowers/{specs,plans}/ (specs et plans historiques)
├── .github/workflows/deploy.yml    (CI/CD GHA)
└── HANDOFF.md                      (ce fichier)
```

Pas de `firebase.json`, `.firebaserc`, `firestore.rules`, `functions/`, `firebase-admin`. Tout est mort.

---

## 🌐 Workflow cross-PC

- Le repo est la seule source de vérité (pas OneDrive pour le code, ça corrompt).
- Fin de session : `git add -A && git commit -m "..." && git push`
- Début de session : `git pull origin main`
- Si WIP : commit `wip: <état>` avant de partir.
- `app/.env.local` n'est jamais commité — à recréer sur chaque PC en UTF-8 no-BOM (cf. § Reprise).
- Tu n'as **plus aucun fichier sensible** dans le repo (le SA JSON Firebase a été retiré, plus aucune clé sensible dans le filesystem).

---

## 🔧 Commandes utiles

| Besoin | Commande |
|---|---|
| Dev SPA | `cd app && npm run dev` → http://localhost:3000/app/ |
| Dev Astro | `npm run dev` → http://localhost:4321 |
| Tests | `npm test` (49 tests Vitest) |
| Astro type-check | `npx astro check` |
| Build complet local (sans creds → skip pages dynamiques) | `npm run build:astro` |
| Trigger manuel GHA deploy | `gh workflow run "Build and deploy to Hostinger" --ref main` |
| Voir runs GHA | `gh run list --workflow=deploy.yml --limit 5` |
| Logs Edge Function `search-terraces` | `ssh root@195.35.29.52 'docker logs --tail=80 terrasses-supabase-functions \| grep search-terraces'` |
| Redéployer Edge Functions (après commit sur infra repo) | `ssh root@195.35.29.52 'cd /opt/terrasses-supabase && git pull && docker restart terrasses-supabase-functions'` |
| Appliquer une migration SQL | `ssh root@195.35.29.52 'cd /opt/terrasses-supabase && git pull && docker cp db/migrations/NNN_xxx.sql terrasses-supabase-db:/tmp/m.sql && docker exec terrasses-supabase-db psql -U supabase_admin -d postgres -f /tmp/m.sql'` |
| Studio (tunnel) | `ssh -L 3010:127.0.0.1:3010 root@195.35.29.52` puis http://127.0.0.1:3010 |
| Récupérer une valeur d'env VPS | `ssh root@195.35.29.52 'grep ^XXX_KEY= /opt/terrasses-supabase/upstream-supabase/docker/.env'` |

---

## 📚 Historique des sessions importantes

- **2026-04-22 (J1)** : Plan SEO Astro Tasks 1-23 + scoring déterministe (suncalc + ombres bâtiments) + GHA + 173 pages déployées.
- **2026-04-23 (J2)** : 4 quick wins "star de l'été" (badge ouvert maintenant, hourly chart, photos OSM, OG cards). Search Console vérifié. Sitemap soumis.
- **2026-04-27 matin** : Migration Firebase → Supabase Phases 0-7 (SPA backend basculé sur Edge Functions, dbService refactor, sunExposure null bug fix).
- **2026-04-27 après-midi** : Phases 8 (cleanup Firebase complet) + chantier SEO PRs #46-47 (maillage interne + différenciation variations).
