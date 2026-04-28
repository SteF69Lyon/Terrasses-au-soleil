# Handoff — Terrasses au soleil

Source de vérité partagée entre PCs. Vit dans le repo et suit `git pull`.

---

## 🌅 Reprise — à lire en premier

**Dernière session : 2026-04-28.** Triple chantier livré en une journée + hardening pipeline :

1. 🧠 **Blog SEO** : 6 articles longue traîne (PR #50), routes `/blog/` + `/blog/[slug]/`
2. ⚡ **SPA code-split** : bundle initial 968 kB → 428 kB raw / 126 kB gzip soit **−56 %** (PR #51)
3. 🌍 **Expansion villes** : 22 → 52 villes, ~173 → ~340 pages SEO (PR #52)
4. 🛡️ **Hardening pipeline** : retry FTP 3-tentatives, AI router resilient (concurrence + retry 429 + fast-fallback multi-provider)

Tout est **live en prod** sur `https://terrasse-au-soleil.fr/`. Build vert, sitemap auto-régénéré, 4 nouvelles pages testées 200 OK.

### À faire dès l'arrivée demain (5-10 min)

1. **Sur la nouvelle machine, mettre à jour le code** :
   ```bash
   cd /c/dev/terrasses-au-soleil
   git checkout main
   git pull origin main
   npm install         # racine (Astro)
   cd app && npm install && cd ..
   ```
   Si c'est une machine vierge, voir [section "Setup d'un nouveau PC"](#-setup-machine) plus bas. Note : `app/package.json` ne contient plus `firebase` (supprimé en PR #51 car migré vers Supabase). Si tu vois encore `node_modules/firebase` quelque part, c'est résiduel et sera nettoyé au prochain `npm ci`.

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
   - https://terrasse-au-soleil.fr/ → landing avec footer riche + section "Conseils & guides" pointant vers les 4 derniers articles
   - https://terrasse-au-soleil.fr/blog/ → liste des 6 articles
   - https://terrasse-au-soleil.fr/blog/orientation-terrasse-soleil/ → article complet, breadcrumb, JSON-LD `Article`
   - https://terrasse-au-soleil.fr/terrasses/saint-tropez/ → nouvelle ville expansion v2 (était 404 avant 2026-04-28)
   - https://terrasse-au-soleil.fr/bar-ensoleille-cannes/ → variation bar nouvelle ville
   - https://terrasse-au-soleil.fr/cafe-terrasse-avignon/ → variation café avec quartier intra-muros listé
   - https://terrasse-au-soleil.fr/app/ → SPA, recherche live OK, devtools Network → bundle initial visible (`react-vendor`, `supabase`, `index-...`), `@google/genai` chunk **absent** tant que tu ne cliques pas sur le mic vocal (lazy-load réussi).

4. **Vérifier le dernier GHA build** :
   ```powershell
   gh run list --workflow=deploy.yml --limit 3
   ```
   Le dernier `success` doit être sur le commit `d774da3` (PR #55) ou postérieur.

5. **Search Console** (https://search.google.com/search-console) :
   - Onglet **Sitemaps** → "Pages découvertes" devrait être à ~340 (vs 173 hier).
   - Onglet **Pages** → guetter sur 7-14 j la décrue des "détectées non indexées" (167 → 0 espéré). Le combo blog + linking + 30 villes touristiques devrait débloquer Google.
   - Onglet **Pages indexées** → guetter la disparition du flag "page en double" sur `/` (effet `.htaccess` PR #49 + redirection `www → apex` confirmée 301).

### Phrase magique à dire à Claude pour reprendre

> *"Reprends, lis HANDOFF.md. On est sur main, stack Supabase 100%, dernière session a livré blog SEO + SPA code-split + expansion 30 villes + hardening AI router/FTP. Que veux-tu attaquer maintenant ? J'ai en tête C (Bing+IndexNow), E (filtres avancés OSM), G (push notifications), I (multi-langue), J (user reviews)."*

---

## 📍 État du projet — 2026-04-28

### Architecture en prod

- **Frontend** servi sur `https://terrasse-au-soleil.fr/` (Hostinger, FTPS via GitHub Action) :
  - **~340 pages SEO statiques** générées par Astro 6 + React 19 (vs 173 hier)
  - **Blog** Astro Content Collections + MDX (`/blog/`, 6 articles)
  - **SPA Vite + React 19** sur `/app/` pour la recherche live, **bundle initial 428 kB raw / 126 kB gzip** (−56 % vs hier)
  - **53 OG cards** PNG personnalisées (52 villes + default)
- **Backend** sur `https://api.terrasse-au-soleil.fr/` (VPS Hostinger 195.35.29.52) :
  - Stack Supabase self-hosted (Postgres + GoTrue + PostgREST + Realtime + Storage + Edge Runtime + Studio + Kong + Vector + Analytics + Meta + ImgProxy + Pooler)
  - 2 Edge Functions Deno : `search-terraces` (recherche live) et `live-token`
- **CI/CD** : GitHub Actions sur push main → build Astro + SPA + merge dist + upload FTPS Hostinger avec **retry 3-tentatives** (PR #54). Cron mensuel le 1er à 03h UTC pour rafraîchir le cache OSM. Timeout du job bumpé à **180 min** (PR #52, pour les cold-cache builds des futures expansions).
- **Aucune dépendance Firebase** dans le code. `firebase` retiré de `app/package.json` en PR #51 (zéro import) → −82 packages, bundle SPA dégonflé.

### Pages SEO (~340 URLs au sitemap)

| URL pattern | Nombre | Source |
|---|---|---|
| `/` (landing) | 1 | `src/pages/index.astro` |
| `/blog/` (index) | 1 | `src/pages/blog/index.astro` |
| `/blog/[slug]/` (articles) | 6 | `src/pages/blog/[...slug].astro` + `src/content/blog/*.mdx` |
| `/terrasses/[ville]/` | 52 | `src/pages/terrasses/[ville]/index.astro` |
| `/terrasses/[ville]/[quartier]/` | ~70 | `src/pages/terrasses/[ville]/[quartier].astro` |
| `/bar-ensoleille-[ville]/` | 52 | via `CityVariationPage.astro` |
| `/cafe-terrasse-[ville]/` | 52 | idem |
| `/restaurant-terrasse-[ville]/` | 52 | idem |
| `/ou-boire-un-verre-au-soleil-[ville]/` | 52 | idem |

Configuration : `src/data/cities.ts` (52 villes, ~70 quartiers).

### Blog (NOUVEAU 2026-04-28)

6 articles longue traîne en MDX, ciblant des requêtes concrètes que les pages ville/variation ne couvrent pas. Chaque article cross-link 4-6 pages ville/variation pour pousser l'autorité du domaine.

| Slug | Cible SEO | Variation liée |
|------|-----------|----------------|
| `orientation-terrasse-soleil` | "orientation terrasse soleil" | toutes |
| `heure-soleil-terrasse-ete` | "à quelle heure soleil terrasse" | verre |
| `terrasse-chauffee-vs-ensoleillee` | "terrasse chauffée terrasse mi-saison" | restaurant |
| `verre-soleil-apero-dore` | "boire un verre soleil 18h" | verre |
| `brunch-terrasse-soleil-checklist` | "brunch terrasse soleil dimanche" | cafe |
| `comment-on-calcule-ensoleillement` | technique / autorité | — |

**Architecture** :
- Astro 6 Content Collections via `src/content.config.ts` (loader `glob` MDX).
- Schema Zod : `title`, `description`, `pubDate`, `keywords`, `relatedCities`, `relatedVariation`.
- JSON-LD `Article` + `BreadcrumbList` + `WebPage` sur chaque article.
- Page index liste les articles par date desc.
- Page article rend le MDX, affiche les villes liées sous forme de cards, propose 4 autres articles ("Continuer la lecture"), CTA vers `/app/`.
- Sitemap auto inclut tout le `/blog/` (intégration `@astrojs/sitemap` capte les nouvelles routes).

**Pour ajouter un article** : créer `src/content/blog/<slug>.mdx` avec frontmatter conforme au schema, puis push. Pas de regénération AI nécessaire — le contenu MDX est statique.

### Features par page SEO

- Bannière live (heure, météo, score moyen, meilleure terrasse maintenant)
- Cartes établissement avec photo OSM (si `wikimedia_commons` ou `image` présent), score soleil statique (réf. 21 juin 17h Paris), badge "Maintenant: X%" live, mini-graphique horaire 9h→21h, badge "Ouvert/Fermé" depuis OSM `opening_hours`, bouton "Partager"
- Carte Leaflet avec markers colorés par score soleil
- FAQ et intro narrative (générées par routeur AI au build, **distinctes par variation** depuis PR #47)
- Footer global avec 22+ villes + recherches populaires (PR #46)
- Sur les pages variation : section "Voir aussi à {ville}" pointant vers les 3 autres variations + 4 quartiers + page ville
- Sur les pages quartier : sections "Autres quartiers de {ville}" + "Découvrir d'autres villes" (cross-city)
- **Sur la home** : section "Conseils & guides" avec les 4 derniers articles du blog (PR #50)
- **Header + footer** : lien `Blog` ajouté en nav et footer (PR #50)
- Données structurées JSON-LD : BreadcrumbList, ItemList (avec LocalBusiness type-mappé), FAQPage, WebPage, **Article** (sur les pages blog)
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

### IA (routeur multi-provider — DURCI 2026-04-28)

- **Côté Astro Node** (build SEO) : `src/lib/ai-router.ts` avec fallback Anthropic Claude Sonnet 4.5 → OpenAI GPT-4o-mini → Google Gemini 2.5 Flash. Skip silencieusement les providers sans clé.
- **Côté Edge Functions Deno** (SPA runtime) : `terrasses-supabase-stack/supabase/functions/_shared/ai-router.ts`, même chaîne de fallback (à synchroniser manuellement si le router Node évolue — le code Deno reste sur l'ancienne logique simple pour l'instant).
- **Usages au build** : `generateIntro` (~150-200 mots par page) et `generateFaq` (4 Q/R). **Depuis PR #47** : intros et FAQs sont **différenciées par variation** — angle apéro pour `bar-ensoleille-*`, pause café/brunch pour `cafe-terrasse-*`, gastronomie pour `restaurant-terrasse-*`, heures dorées pour `ou-boire-un-verre-au-soleil-*`. Cache key : `seo_cache.pageIntros["{pageId}-{variation}"]`.
- **Usages runtime** : `search-terraces` Edge Function appelle le router pour la découverte d'établissements (extracteur JSON bracket-balanced + retry 1× sur réponse vide, depuis PR #32 du repo infra).

#### Resilience du router (PRs #53, #55)

- **Concurrency cap** (`CONCURRENCY = 3`) : sémaphore FIFO qui limite les appels IA simultanés. Évite que les 200+ appels parallèles d'Astro n'explosent les quotas tokens-per-minute des providers.
- **Retry 5xx** : sur erreur serveur transient (500-599 hors 529), retry une fois sur le **même provider** avec pause 2 s.
- **Fast-fallback 429 / 529** (PR #55) : sur rate-limit, **bascule immédiate** au provider suivant sans retry sur le même. Bénéfice énorme quand plusieurs clés sont configurées : un 429 Anthropic ne bloque plus 60-120 s avant de passer à OpenAI.
- **2e passe** : si tous les providers ont 429'd dans la 1re passe, le router attend le `retry-after-ms` le plus long indiqué et fait une 2e passe complète. Si un provider a échoué pour une autre raison (auth, bad request), pas de 2e passe — un retry n'aiderait pas.
- **Erreurs portent le statut HTTP + `retryAfterMs`** parsé depuis les headers `retry-after-ms` (Anthropic) et `Retry-After` (HTTP standard).

#### Cold-cache build performance

Référence : avant PR #55, un build cold-cache de 30 nouvelles villes prenait ~50 min (retry-backoff Anthropic gaspillait du temps même avec OpenAI dispo). Après PR #55, attendu ~10-15 min. Builds chauds (cache rempli) : pas d'impact, zéro AI call.

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

### SPA — bundle décomposé (PR #51)

| Chunk | Raw | Gzip | Quand chargé |
|-------|-----|------|--------------|
| `index` (entry) | 210 kB | 68 kB | first paint |
| `supabase` | 206 kB | 53 kB | first paint (auth) |
| `react-vendor` | 12 kB | 4 kB | first paint (cached long-term) |
| **Total initial** | **428 kB** | **126 kB** | — |
| `ProfileModal` | 16 kB | 4.5 kB | sur ouverture du profil |
| `SearchAssistant` | 3 kB | 1.5 kB | sur clic mic vocal |
| `@google/genai` | 256 kB | 51 kB | sur activation mic vocal |

**Mécanique** :
- `firebase` retiré de `app/package.json` (zéro import — déjà migré vers Supabase). −82 packages au `npm ci`.
- `@google/genai` est dynamic-importé dans `geminiService.connectLiveAssistant` — n'apparaît dans le bundle qu'à la première activation du mic.
- `SearchAssistant` et `ProfileModal` sont en `React.lazy()` avec `<Suspense fallback={null}>`.
- `vite.config.ts` configure `manualChunks` pour isoler `react-vendor` et `supabase` (cache long-terme : changement du code app n'invalide plus ces deux chunks).

### Indexation Google (suivi en cours)

- Sitemap soumis, **propriété GSC vérifiée**.
- État au matin du 2026-04-28 (avant l'expansion) : 173 découvertes, 4 indexées, 167 "détectées non indexées", 1 "page en double" sur `/`.
- Actions correctives livrées :
  - **PR #46-47** : maillage interne + différenciation variations (effet sur 167 non indexées attendu sur 1-4 semaines).
  - **PR #49** : `.htaccess` redirection www → apex 301 + force HTTPS (vérifiée par curl, retourne 301 vers apex). Devrait tuer le "page en double" sous 7 j.
  - **Indexation manuelle** demandée sur `/bar-ensoleille-strasbourg/` (la page "introuvable" était un cache obsolète Google, la page répond bien 200).
- **Post-2026-04-28** : sitemap auto-régénéré contient ~340 URLs (vs 173). Le combo blog (autorité) + 30 villes touristiques (Cannes, Saint-Tropez, Saint-Malo… requêtes terrasses fortes) + linking interne renforcé devrait débloquer Google sur les 2-4 semaines.
- **Bing Webmaster Tools** : pas encore configuré (chantier C ouvert).

### Chantiers historiques (FAIT)

- Migration Firebase → Supabase complète (Phase 7+8) : code, infra, tables, secrets
- 4 quick wins "star de l'été" : badge ouvert maintenant, hourly chart SPA, markers colorés, bouton partager
- Routeur AI build-time multi-provider (port du Deno côté Node)
- Bracket-balanced JSON extractor pour parser les réponses Gemini/Claude truncated
- Fix Open-Meteo 429 (cache lat/lng arrondis)
- Maillage interne enrichi : footer global, cross-links variations, landing avec quartiers populaires, cross-city sur quartier
- Différenciation éditoriale variations vs ville (anti-duplicate)
- **Redirection www → apex via `.htaccess`** (PR #49) — résout "page en double" GSC
- **Blog SEO 6 articles longue traîne** (PR #50) — autorité de domaine + linking interne
- **SPA bundle 968 → 428 kB** (PR #51) — code-split + Firebase removal + dynamic Gemini SDK
- **Expansion 22 → 52 villes / 173 → ~340 pages** (PR #52) — métropoles + hubs touristiques
- **AI router resilient** (PR #53 + #55) — concurrency cap + retry 5xx + fast-fallback 429
- **FTP retry 3-tentatives** (PR #54) — résilience contre les 550 transients Hostinger

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
npm run build:astro    # produit dist/ avec landing + blog (skip pages dynamiques sans creds Supabase)
cd app
npm run build         # produit app/dist/ complet (~1.6s, 7 chunks)
cd ..
```

Puis ouvrir Claude Code dans le repo et dire la phrase magique de la § Reprise.

⚠️ **Le build complet local nécessite les creds Supabase + au moins une clé AI** (cf. § Build local complet plus bas). Sans ces creds, le build skip les pages dynamiques. C'est OK pour vérifier que ça compile, mais pour reproduire la prod il faut les exports d'env.

### Build local complet (avec creds, optionnel)

Si besoin de tester localement le pipeline de build complet (les ~340 pages avec contenu réel) :

```bash
export SUPABASE_URL="https://api.terrasse-au-soleil.fr"
export SUPABASE_SERVICE_ROLE_KEY="..."  # ssh root@195.35.29.52 'grep ^SERVICE_ROLE_KEY= /opt/terrasses-supabase/upstream-supabase/docker/.env'
export ANTHROPIC_API_KEY="..."          # idem grep ^ANTHROPIC_API_KEY=
export OPENAI_API_KEY="..."             # idem
export GEMINI_API_KEY="..."             # AIStudio (fallback)
export VITE_ADMIN_EMAIL="sflandrin@outlook.com"
export VITE_SUPABASE_URL="https://api.terrasse-au-soleil.fr"
export VITE_SUPABASE_ANON_KEY="..."

npm run build
```

⚠️ **Cold-cache build local** : la 1re compilation sans cache dans Supabase peut prendre 15-20 min même avec les 3 clés AI (concurrency cap + Nominatim rate-limit). Les builds suivants tirent du cache et sont rapides (~3-5 min).

---

## ⏭️ Chantiers ouverts (priorisés)

### Quick wins SEO (1-2h chacun)

- **C — Bing Webmaster Tools + IndexNow** *(à faire côté ops, ~10 min)* : ajouter le site sur https://www.bing.com/webmasters, vérifier la propriété (méta tag dans Layout ou fichier), soumettre `https://terrasse-au-soleil.fr/sitemap-index.xml`, activer IndexNow. Bing crawle agressivement, parfois déclenche un re-crawl Google.
- **Améliorer méta-descriptions** : actuellement génériques sur les pages variation. Les enrichir avec des chiffres et hooks. ~30 min.
- **Préload critical assets** : ajouter `<link rel="preload">` sur la police principale et l'OG card de la page courante. Gain LCP marginal mais propre.
- **More articles blog** : viser 15-20 articles à terme. Déclinaisons : *"Top 10 terrasses ensoleillées Lyon mai 2026"*, *"Où boire un verre au soleil le dimanche à Paris"*, *"Quels arrondissements parisiens ont le plus de soleil"*, *"Brunch terrasse Marseille bord de mer"*. Pour ajouter : créer un fichier `.mdx` dans `src/content/blog/` avec frontmatter conforme.

### Moyen terme (gros levier trafic, 3-6h chacun)

- **E — Filtres avancés OSM** : tags OSM "terrasse avec vue" (`view`), "bord de l'eau" (`waterway` proximité), "enfants acceptés" (`child_friendly`), "chien accepté" (`dog`). Multiplie les pages utiles. Utilisable comme générateur de pages secondaires *"Bars chiens acceptés à Lyon"*.
- **Quartiers manquants** : sur les 30 nouvelles villes de la PR #52, seules ~12 ont des quartiers. Compléter avec 2-4 quartiers par ville touristique restante (Brest, Nantes-mer, Vannes, Quimper, Pau, etc.) augmenterait à ~400 pages.

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
- **`GEMINI_BUILD_KEY` invalide** : la clé `GEMINI_BUILD_KEY` dans les secrets GitHub est rejected par Google ("API key not valid"). Le router fallback automatiquement sur `GEMINI_API_KEY` (PR #56 du workflow) qui elle est valide. À nettoyer un jour : soit régénérer une clé valide pour `GEMINI_BUILD_KEY`, soit retirer le secret et ne garder que `GEMINI_API_KEY`. Aucune urgence — le router gère les deux.

---

## 🏗️ Contexte technique

### Repos

- **Frontend** : https://github.com/SteF69Lyon/Terrasses-au-soleil (`main`)
- **Infra Supabase** : https://github.com/SteF69Lyon/terrasses-supabase-stack (`main`) — Edge Functions Deno + migrations SQL + scripts ops VPS

### Stack

- **Build SEO** : Astro 6 + React 19 islands, statique, sortie `dist/`
- **Blog** : Astro Content Collections + MDX (`@astrojs/mdx` 5.x, déjà dans deps)
- **SPA** : Vite 6 + React 19, sortie `app/dist/` mergée dans `dist/app/` au build, code-splitting par chunk vendor + lazy-load composants modaux
- **Backend** : Supabase self-hosted sur VPS, Edge Runtime Deno
- **DB** : Postgres 15 (Supabase)
- **AI router** : Claude Sonnet 4.5 → GPT-4o-mini → Gemini 2.5 Flash. Concurrency cap 3, fast-fallback 429, retry 5xx.
- **Cartes** : Leaflet + react-leaflet, tiles OSM
- **Données** : OpenStreetMap Overpass + Nominatim (gratuits, throttled 1 req/s), Open-Meteo (gratuit)
- **OG generation** : SVG → PNG via `@resvg/resvg-js` au build
- **Deploy** : SamKirkland/FTP-Deploy-Action v4.3.5 wrapped en retry 3-tentatives manuel (continue-on-error + step outcome guards)

### URLs et accès

- **Prod web** : https://terrasse-au-soleil.fr
- **Prod blog** : https://terrasse-au-soleil.fr/blog/
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

| Secret | Usage | État |
|---|---|---|
| `ANTHROPIC_API_KEY` | Build SEO (router AI primary) | ✅ |
| `OPENAI_API_KEY` | Build SEO (router AI fallback) | ✅ ajouté 2026-04-28 |
| `GEMINI_BUILD_KEY` | Build SEO (router AI last resort) | ⚠️ clé invalide côté Google, ignorée par le router |
| `GEMINI_API_KEY` | Build SEO (router AI fallback Gemini) | ✅ ajouté 2026-04-28, valide |
| `SUPABASE_URL` | Build SEO (cache Postgres) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Build SEO (cache Postgres, admin) | ✅ |
| `VITE_SUPABASE_ANON_KEY` | SPA build (client public) | ✅ |
| `VITE_ADMIN_EMAIL` | SPA build (contrôles admin UI) | ✅ |
| `PUBLIC_ADSENSE_CLIENT` | Optionnel, vide aujourd'hui | ❌ vide (en attente Google) |
| `FTP_HOST`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_SERVER_DIR` | Deploy FTPS Hostinger | ✅ |

### Arbre

```
/c/dev/terrasses-au-soleil/
├── astro.config.mjs, package.json, tsconfig.json, vitest.config.ts
├── src/
│   ├── content.config.ts            (NOUVEAU — schema collection blog)
│   ├── content/blog/                (NOUVEAU — 6 articles MDX)
│   │   ├── orientation-terrasse-soleil.mdx
│   │   ├── heure-soleil-terrasse-ete.mdx
│   │   ├── terrasse-chauffee-vs-ensoleillee.mdx
│   │   ├── verre-soleil-apero-dore.mdx
│   │   ├── brunch-terrasse-soleil-checklist.mdx
│   │   └── comment-on-calcule-ensoleillement.mdx
│   ├── pages/                       (landing + dynamiques + blog)
│   │   ├── index.astro              (avec section blog teaser)
│   │   ├── blog/                    (NOUVEAU)
│   │   │   ├── index.astro          (liste articles)
│   │   │   └── [...slug].astro      (article rendu)
│   │   ├── terrasses/[ville]/index.astro
│   │   ├── terrasses/[ville]/[quartier].astro
│   │   ├── bar-ensoleille-[ville].astro
│   │   ├── cafe-terrasse-[ville].astro
│   │   ├── restaurant-terrasse-[ville].astro
│   │   └── ou-boire-un-verre-au-soleil-[ville].astro
│   ├── lib/
│   │   ├── ai-router.ts             (concurrency cap + fast-fallback 429 + retry 5xx)
│   │   ├── supabase-admin.ts, cache.ts, buildData.ts
│   │   ├── nominatim.ts, overpass.ts, buildings.ts, sun.ts, weather.ts
│   │   ├── gemini.ts                (generateIntro/generateFaq, accepte variation)
│   │   ├── jsonld.ts, urls.ts, openingHours.ts
│   ├── components/
│   │   ├── Layout.astro             (footer global enrichi + lien blog nav/footer)
│   │   ├── CityVariationPage.astro  (template variations + cross-links)
│   │   ├── TerraceCard.astro, MiniMap.tsx, LiveSunBanner.astro
│   │   ├── Breadcrumb.astro, FaqList.astro, RelatedAreas.astro, AdSlot.astro
│   ├── scripts/
│   │   ├── live-sun.ts              (client-side : badge live + hourly chart + open status)
│   │   └── share.ts                 (Web Share API + clipboard fallback)
│   ├── data/cities.ts               (52 villes, ~70 quartiers — vs 22/62 hier)
│   └── styles/global.css            (+ blog styles)
├── tests/lib/                       (49 tests Vitest, 100% verts)
├── public/
│   ├── robots.txt, og-default.jpg, googleb0f5b7a0901e81f3.html (GSC verif)
│   ├── .htaccess                    (NOUVEAU PR #49 — redirect www→apex + force HTTPS + cache assets)
│   └── og/                          (généré au build via resvg, gitignored)
├── app/                             (SPA Vite + React)
│   ├── App.tsx                      (lazy-load SearchAssistant + ProfileModal)
│   ├── components/, services/
│   │   └── geminiService.ts         (dynamic import @google/genai)
│   ├── lib/liveSun.ts
│   ├── package.json                 (firebase RETIRÉ, supabase ajouté explicite)
│   ├── vite.config.ts               (manualChunks: react-vendor + supabase)
│   └── .env.local                   (NON commité, à recréer par PC, UTF-8 no-BOM)
├── scripts/
│   ├── merge-dist.mjs               (combine app/dist + Astro dist)
│   └── generate-og.mjs              (53 OG PNGs via resvg)
├── docs/superpowers/{specs,plans}/  (specs et plans historiques)
├── .github/workflows/deploy.yml     (CI/CD GHA — timeout 180min + FTP retry 3 + GEMINI_API_KEY env)
└── HANDOFF.md                       (ce fichier)
```

Pas de `firebase.json`, `.firebaserc`, `firestore.rules`, `functions/`, `firebase-admin`. `firebase` retiré aussi de `app/package.json`. Tout est mort côté Firebase.

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
| Astro sync (regénère types content collections) | `npx astro sync` |
| Build SPA seul | `cd app && npm run build` (~1.6 s, 7 chunks) |
| Build complet local (sans creds → skip pages dynamiques) | `npm run build:astro` |
| Trigger manuel GHA deploy | `gh workflow run "Build and deploy to Hostinger" --ref main` |
| Voir runs GHA | `gh run list --workflow=deploy.yml --limit 5` |
| Voir log d'un run failed | `gh run view <id> --log-failed` |
| Cancel un run en cours | `gh run cancel <id>` |
| Lister secrets GHA | `gh secret list` |
| Set un secret GHA | `gh secret set NAME --body "valeur"` |
| Logs Edge Function `search-terraces` | `ssh root@195.35.29.52 'docker logs --tail=80 terrasses-supabase-functions \| grep search-terraces'` |
| Redéployer Edge Functions (après commit sur infra repo) | `ssh root@195.35.29.52 'cd /opt/terrasses-supabase && git pull && docker restart terrasses-supabase-functions'` |
| Appliquer une migration SQL | `ssh root@195.35.29.52 'cd /opt/terrasses-supabase && git pull && docker cp db/migrations/NNN_xxx.sql terrasses-supabase-db:/tmp/m.sql && docker exec terrasses-supabase-db psql -U supabase_admin -d postgres -f /tmp/m.sql'` |
| Studio (tunnel) | `ssh -L 3010:127.0.0.1:3010 root@195.35.29.52` puis http://127.0.0.1:3010 |
| Récupérer une valeur d'env VPS | `ssh root@195.35.29.52 'grep ^XXX_KEY= /opt/terrasses-supabase/upstream-supabase/docker/.env'` |
| Tester redirection www→apex | `curl -sI https://www.terrasse-au-soleil.fr/` (doit retourner 301 vers apex) |
| Tester nouvelles villes | `curl -sI https://terrasse-au-soleil.fr/terrasses/saint-tropez/` (doit retourner 200) |

---

## 📚 Historique des sessions importantes

- **2026-04-22 (J1)** : Plan SEO Astro Tasks 1-23 + scoring déterministe (suncalc + ombres bâtiments) + GHA + 173 pages déployées.
- **2026-04-23 (J2)** : 4 quick wins "star de l'été" (badge ouvert maintenant, hourly chart, photos OSM, OG cards). Search Console vérifié. Sitemap soumis.
- **2026-04-27 matin** : Migration Firebase → Supabase Phases 0-7 (SPA backend basculé sur Edge Functions, dbService refactor, sunExposure null bug fix).
- **2026-04-27 après-midi** : Phases 8 (cleanup Firebase complet) + chantier SEO PRs #46-47 (maillage interne + différenciation variations).
- **2026-04-28 matin** : `.htaccess` redirection www→apex + force HTTPS (PR #49) — pour résoudre le "page en double" GSC. Indexation manuelle demandée sur `/bar-ensoleille-strasbourg/`.
- **2026-04-28 journée — Triple chantier + hardening** :
  - **PR #50** : Blog SEO 6 articles MDX longue traîne, routes `/blog/` + `/blog/[slug]/`, JSON-LD `Article`, cross-links blog ↔ ville/variation, lien blog dans nav/footer/home.
  - **PR #51** : SPA bundle 968 kB → 428 kB (−56 %). `firebase` retiré (zéro import). `@google/genai` dynamic-importé (chargé seulement à l'activation du mic). `SearchAssistant` + `ProfileModal` en `React.lazy`. Vite `manualChunks` : `react-vendor` + `supabase` isolés.
  - **PR #52** : Expansion 22 → 52 villes (+30 dont 13 métropoles régionales restantes + 17 hubs touristiques : Cannes, Saint-Tropez, Saint-Malo, Avignon, Honfleur, Chamonix, etc.) + 12 nouveaux quartiers. Bump GHA timeout 120 → 180 min pour cold-cache.
  - **PR #53** : AI router `concurrency cap = 3` + retry-with-backoff sur 429/5xx (1re version). Permet aux cold-cache builds de ne pas planter sous rate-limit Anthropic.
  - **PR #54** : FTP deploy retry 3-tentatives (continue-on-error + step outcome guards). Résout les 550 transients Hostinger observés sur 1 build sur 3.
  - **PR #55** : AI router fast-fallback — sur 429, bascule **immédiate** au provider suivant au lieu de retry-backoff sur le même. Cold-cache build attendu ~10-15 min vs ~50 min avant.
  - **Secrets ajoutés** : `OPENAI_API_KEY` + `GEMINI_API_KEY` (en complément de `ANTHROPIC_API_KEY` et `GEMINI_BUILD_KEY`). Le router skip `GEMINI_BUILD_KEY` (clé invalide côté Google) et utilise `GEMINI_API_KEY` à la place.
  - **Bilan métriques** :
    - Pages SEO : 173 → ~340 (+97 %)
    - Bundle SPA initial : 968 kB → 428 kB raw / 126 kB gzip (−56 %)
    - Articles blog : 0 → 6
    - Build resilience : aucune → retry 429 + retry FTP + fast-fallback multi-provider
    - Cold-cache build perf attendu : ~10-15 min (vs >50 min)
