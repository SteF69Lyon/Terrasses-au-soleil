# Handoff — Terrasses au soleil

Source de vérité partagée entre PCs. Vit dans le repo et suit `git pull`.

---

## 🌅 Reprise — à lire en premier

**Dernière session : 2026-05-03.** Session **firefighting + SEO hub** : 3 bugs prod découverts et corrigés en chaîne, plus une page hub `/terrasses/` ajoutée. Demande de re-indexation Google initiée pour 10 URLs prioritaires. Tout est **live en prod** et stable.

### TL;DR de la session

1. 🚒 **Bug A — SPA cassée** (PR #61) : `/app/` affichait *« Erreur IA : Supabase env vars manquantes »* depuis 24h. Le bundle Vite était compilé sans `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` car le commit `473eb28` (PR #59 du 2026-05-02) avait écrit `app/.env` avec **uniquement** `PUBLIC_ADSENSE_CLIENT`, ce qui shadowait `process.env.VITE_*` côté Vite 6.2.
2. 🚒 **Bug B — 52 pages SEO en 404** (même PR #61) : toutes les pages `/terrasses/<ville>/`, `/bar-ensoleille-*`, `/cafe-terrasse-*`, `/restaurant-terrasse-*`, `/ou-boire-un-verre-au-soleil-*` répondaient 404. Les dossiers étaient simplement **absents du serveur Hostinger** — confirmé par le diagnostic lftp ajouté au workflow (`creating folder "bar-ensoleille-paris/"` lors du redéploiement = preuve de l'absence). Le redéploiement a recréé **342 dossiers + 764 fichiers**.
3. 🆕 **Bug C — `/terrasses/` en 403** (PR #62) : cliquer sur "Terrasses" dans le breadcrumb des pages ville/quartier menait à une page 403 (Hostinger refuse le directory listing sur un dossier sans index.html). Fix : page hub statique `src/pages/terrasses/index.astro` listant les 52 villes par région. **53e page indexable**, sitemap à 339 URLs.
4. 🔍 **Indexation Google** : tu as demandé la re-indexation manuelle pour 10 URLs prioritaires via *URL Inspection* dans GSC. Les autres ~330 URLs seront re-crawlées progressivement via le sitemap.

### À faire dès l'arrivée prochaine session (5-10 min)

1. **Mettre à jour le code** :
   ```bash
   cd /c/dev/terrasses-au-soleil
   git checkout main
   git pull origin main
   npm install         # racine (Astro)
   cd app && npm install && cd ..
   ```
   Note : `app/package.json` ne contient plus `firebase`. `app/.env.local` reste à recréer par PC en **UTF-8 sans BOM** (snippet ci-dessous).

2. **Recréer `app/.env.local`** (non commité) en **UTF-8 sans BOM** :
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
   ⚠️ **N'utilise pas** `Set-Content` ou `Out-File` standard — ils écrivent en UTF-16 ou UTF-8 BOM, ce qui casse Vite.

3. **Vérifier en prod (smoke test post-incidents)** :
   ```bash
   for url in "/" "/terrasses/" "/terrasses/paris/" "/bar-ensoleille-paris/" \
              "/cafe-terrasse-lyon/" "/restaurant-terrasse-marseille/" \
              "/blog/" "/sitemap-0.xml" "/app/"; do
     printf "%-45s -> " "$url"
     curl -s -o /dev/null -w "HTTP %{http_code}\n" "https://terrasse-au-soleil.fr$url"
   done
   ```
   Tout doit retourner **HTTP 200**. Vérifier aussi que `/app/` ne montre pas le toast *« Erreur IA »* (taper sur la SPA → recherche fonctionnelle).

4. **Vérifier le dernier GHA build** :
   ```powershell
   gh run list --workflow=deploy.yml --limit 5
   ```
   Le dernier `success` doit être ≥ commit `37e9d4a` (PR #62).

5. **Search Console — suivi indexation** (https://search.google.com/search-console) :
   - Onglet **Sitemaps** → confirmer le sitemap `sitemap-index.xml` est listé, "Pages découvertes" doit être ≥ 339.
   - Onglet **Pages > Indexées** → noter le compteur du jour pour suivre la progression d'indexation des URLs récemment passées 404→200.
   - Onglet **Pages > Détectées, actuellement non indexées** → noter le compteur (gros chiffre attendu après l'incident, devrait redescendre dans les 2-4 semaines).
   - **Demander 10 nouvelles indexations** via URL Inspection (limite ~10/jour/propriété). Cibler chaque jour différentes pages (cf. roadmap indexation plus bas).
   - **Vérifier la rapidité de re-indexation** des 10 URLs déjà soumises : devraient toutes basculer en *"Indexée"* sous 48h.

### Phrase magique à dire à Claude pour reprendre

> *"Reprends, lis HANDOFF.md. On est sur main, prod stable depuis l'incident triple bug du 2026-05-03 (SPA env, 404 SEO, breadcrumb 403). 10 URLs envoyées en re-indexation chez Google. Que veux-tu attaquer maintenant ? Priorités SEO : Bing/IndexNow, méta-descriptions, more articles blog. Priorités produit : filtres avancés OSM, AdSense slots, multi-langue."*

---

## 🔥 Post-mortem incident du 2026-05-03

Trois bugs prod en cascade découverts simultanément le matin du 2026-05-03. Tous trois ont une racine commune dans le pipeline de déploiement (workflow `deploy.yml` + spécificités Hostinger) et sont apparus comme effets de bord cumulés des PRs adsense (#57-#60) du 2026-05-02.

### Timeline

| Date / heure UTC | Événement |
|---|---|
| 2026-05-02 ~07:00 | PR #57 (docs adsense), PR #58 (autoads noop) — déploys verts |
| 2026-05-02 ~07:55 | PR #59 (`473eb28`) écrit `app/.env` avec **uniquement** `PUBLIC_ADSENSE_CLIENT` → casse le SPA en silence (Astro reste OK) |
| 2026-05-02 ~08:00 | PR #60 (ads.txt) déclenche un deploy qui plante au FTP (`Error: Timeout (control socket)` × 3) → **prod reste sur PR #59 = SPA cassée**. Au passage, l'état FTP devient incohérent (theory : sync state file corrompu ou upload partiel non détecté) → ~340 dossiers SEO disparaissent du serveur Hostinger. |
| 2026-05-03 ~07:30 | Premier signalement utilisateur : "Tous les liens de la home page sont en 404 et /app/ indique Erreur IA : supabase env vars manquantes" |
| 2026-05-03 09:18 | PR #61 mergée (fix VITE_* + diagnostic FTP) → bundle SPA réparé, **342 dossiers SEO recréés** sur Hostinger, **764 fichiers** uploadés |
| 2026-05-03 09:35 | Re-deploy auto sur main → 200 OK partout, sitemap 8 → 338 URLs |
| 2026-05-03 11:00 | Découverte d'un 3e bug : breadcrumb "Terrasses" → 403 sur `/terrasses/` (root sans index) |
| 2026-05-03 12:34 | PR #62 mergée (page hub `/terrasses/`) → premier deploy fail FTP timeout |
| 2026-05-03 12:44 | Retry workflow_dispatch → vert. Sitemap 339 URLs. |
| 2026-05-03 ~13:00 | URL Inspection chez Google sur 10 URLs prioritaires |

### Bug A — `/app/` "Erreur IA : Supabase env vars manquantes"

**Symptôme** : la SPA affichait un toast d'erreur dès le premier appel à Supabase. Le bundle JS prod (`index-DURU1Bvr.js`) contenait `throw new Error("Supabase env vars manquantes.")` figé en dur, et **0 occurrence** de `https://api.terrasse-au-soleil.fr` ou du JWT anon.

**Cause racine** : commit `473eb28` (PR #59) a écrit `app/.env` avec **uniquement** `PUBLIC_ADSENSE_CLIENT` pour résoudre un autre bug AdSense côté Astro. Avec **Vite 6.2**, la présence d'un `.env` dans le dossier de build **shadowe `process.env.VITE_*`** lors du build de la SPA. Conséquence : `import.meta.env.VITE_SUPABASE_URL` et `_ANON_KEY` ont été remplacés par `undefined` à la compilation, et le tree-shaking n'a gardé que la branche d'erreur. Côté Astro, indemne (Astro ne consomme pas ces variables, seulement les `PUBLIC_*`). La régression est donc passée inaperçue aux PRs suivantes (la home Astro restait fonctionnelle).

**Fix appliqué** (PR #61, commit `c2c1725`) : écrire **toutes** les `VITE_*` (et `PUBLIC_*`) dans `app/.env` côté workflow `deploy.yml`, dans le step *"Build (OG + Astro + SPA + merge)"* :
```bash
cat > app/.env <<EOF
PUBLIC_ADSENSE_CLIENT=${PUBLIC_ADSENSE_CLIENT}
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
VITE_ADMIN_EMAIL=${VITE_ADMIN_EMAIL}
EOF
```
Plus un `grep -oE '^[A-Z_]+=' app/.env` après l'écriture pour logger les noms de keys (sans valeurs) → futur regression alarme dans les logs CI.

**Vérif post-fix** :
- Bundle prod passé de `index-DURU1Bvr.js` (208 918 B, 0 occurrence Supabase) → `index-BTmX6G98.js` (210 187 B, 1 occurrence URL + 1 occurrence JWT, 0 occurrence "Supabase env vars manquantes")
- `/app/` charge sans erreur, recherche live opérationnelle

**Leçon retenue** : avec Vite 6.x, **ne pas mélanger** la propagation des env vars via `process.env` (workflow `env:` block) ET via `.env` file (heredoc). Tout passer dans le fichier `.env` de manière cohérente. Ne **jamais** écrire un `.env` qui ne contient qu'une partie des keys attendues.

### Bug B — 52 pages SEO en 404

**Symptôme** : la home référençait 60 URLs internes, dont 52 (`/terrasses/<ville>/`, `/bar-ensoleille-*`, `/cafe-terrasse-*`, `/restaurant-terrasse-*`, `/ou-boire-un-verre-au-soleil-*`) renvoyaient **HTTP 404**. Le sitemap `sitemap-0.xml` n'avait que **8 URLs** (home + blog index + 6 articles), et **0 page de ville**. Pourtant le build CI de PR #59 avait clairement généré **340 .html** dans `dist/` (visible dans le log `find dist/ -name '*.html' | wc -l → 340`).

**Cause racine** : les dossiers SEO étaient **physiquement absents** du filesystem Hostinger. Confirmé par le step de diagnostic lftp ajouté en PR #61 : lors du redéploiement, le log FTP-Deploy-Action a affiché `creating folder "bar-ensoleille-paris/"` — preuve que le dossier n'existait pas avant. Hypothèse de la perte initiale : une combinaison probable de
1. Le upload partiel/timeout de PR #60 (3 attempts FTP timeout) a corrompu le sync state file de FTP-Deploy-Action côté serveur
2. Le state file corrompu, lu par les déploys suivants, leur a fait sauter ces uploads en pensant que les fichiers étaient déjà à jour
3. Hostinger a **possiblement** un comportement de cleanup automatique (à confirmer) qui a supprimé les dossiers vides ou anciens

**Fix appliqué** (PR #61) : le redéploiement a recréé les dossiers et uploadé tous les fichiers (`342 folders + 764 files` en 6m58s).

**Vérif post-fix** : sitemap-0.xml passé de 8 → 338 URLs. 13/13 URLs SEO échantillonnées en 200.

**Leçon retenue** : `gh run list` afficher `✓ success` pour un run **ne garantit pas** que tous les fichiers attendus sont en prod. Avec FTP-Deploy-Action en mode incremental + state file, un run "réussi" peut être un quasi no-op qui ne corrige rien si le state file est inconsistant. Le step diagnostic lftp (gardé dans `deploy.yml`) sert maintenant de filet de sécurité pour future incidents — il liste les dossiers sentinels et l'état du fichier de sync à chaque deploy.

### Bug C — `/terrasses/` en 403 sur le breadcrumb

**Symptôme** : sur n'importe quelle page ville (`/terrasses/lyon/`) ou quartier (`/terrasses/lyon/vieux-lyon/`), le breadcrumb affichait `Accueil > Terrasses > Lyon` avec "Terrasses" cliquable. Cliquer dessus → `https://terrasse-au-soleil.fr/terrasses/` → **HTTP 403 Forbidden** (Hostinger refuse le directory listing). Le JSON-LD `BreadcrumbList` envoyait **également** les crawlers Google vers cette URL morte.

**Cause racine** : le code du breadcrumb (dans `src/pages/terrasses/[ville]/index.astro:36` et `src/pages/terrasses/[ville]/[quartier].astro:43`) inclut `{ name: 'Terrasses', url: SITE + '/terrasses/' }`, mais il n'existait **aucun** `src/pages/terrasses/index.astro` à la racine. Astro ne génère donc rien à `/terrasses/`, Hostinger renvoie 403 sur le dossier sans `index.html`.

**Fix appliqué** (PR #62, commit `37e9d4a`) : création de `src/pages/terrasses/index.astro` — page hub **statique** (pas besoin de Supabase au build) qui liste les 52 villes **groupées par région** (Île-de-France, Auvergne-Rhône-Alpes, etc.) avec un H1 distinct, une meta description différente de la home, son canonical et son `BreadcrumbList`.

**Choix : hub vs redirect** : on aurait pu rediriger `/terrasses/` → `/`. On a préféré la page hub car :
- 53e page indexable distincte de la home (cadrage différent : annuaire de villes par région)
- Aucun signal négatif Google (pas de redirect 301 inutile)
- Maillage interne renforcé pour les crawlers

**Vérif post-fix** : `/terrasses/` → 200 avec contenu hub, sitemap 338 → 339 URLs.

**Leçon retenue** : à chaque fois qu'on ajoute un breadcrumb item avec une URL, **vérifier que cette URL existe et retourne 200**. Mieux : ajouter un test (Vitest ou Playwright) qui crawl chaque breadcrumb item et vérifie le status, à exécuter en CI.

### Mesures préventives ajoutées au workflow

- **Sanity check des keys SPA** dans le step de build : `grep -oE '^[A-Z_]+=' app/.env` log les noms de keys présents, sans valeurs. Permet de voir d'un coup d'œil dans le log GHA si on a 4 keys (PUBLIC_ADSENSE_CLIENT, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_ADMIN_EMAIL) ou moins.
- **Step de diagnostic lftp** avant le déploiement : timeout 90 s, `continue-on-error`, liste le contenu du root FTP et de 2 dossiers sentinels (`terrasses/`, `bar-ensoleille-paris/`) + le sync state file. Ne déploie rien, juste observe — utile pour future incidents type "build vert mais prod cassée".
- **Hostinger FTPS instable** : on a eu **2 timeouts sur 5 runs** dans la journée du 2026-05-03 (PR #60 + premier deploy de PR #62). Le retry 3-tentatives existant a sauvé une partie mais pas tout. Pas de fix structurel pour l'instant ; à monitorer. Options futures :
  - Bumper le timeout interne du FTP-Deploy-Action (param `timeout`)
  - Switcher sur lftp direct dans le workflow (plus contrôlable)
  - Ajouter un 4e retry avec délai plus long
  - Migrer vers un autre hébergement statique (Cloudflare Pages, Vercel, Netlify)

---

## 📍 État du projet — 2026-05-03

### Architecture en prod

- **Frontend** servi sur `https://terrasse-au-soleil.fr/` (Hostinger, FTPS via GitHub Action) :
  - **~341 pages SEO statiques** générées par Astro 6 + React 19 (sitemap : 339 URLs après ajout du hub `/terrasses/`)
  - **Blog** Astro Content Collections + MDX (`/blog/`, 6 articles)
  - **SPA Vite + React 19** sur `/app/` pour la recherche live, **bundle initial 428 kB raw / 126 kB gzip**
  - **53 OG cards** PNG personnalisées (52 villes + default)
  - **Page hub `/terrasses/`** (NOUVEAU 2026-05-03) : liste des 52 villes groupées par région — fix breadcrumb 403 et 53e page indexable
- **Backend** sur `https://api.terrasse-au-soleil.fr/` (VPS Hostinger 195.35.29.52) :
  - Stack Supabase self-hosted (Postgres + GoTrue + PostgREST + Realtime + Storage + Edge Runtime + Studio + Kong + Vector + Analytics + Meta + ImgProxy + Pooler)
  - 2 Edge Functions Deno : `search-terraces` (recherche live) et `live-token`
- **CI/CD** : GitHub Actions sur push main → build Astro + SPA + merge dist + upload FTPS Hostinger avec **retry 3-tentatives** (PR #54). Cron mensuel le 1er à 03h UTC pour rafraîchir le cache OSM. Timeout du job bumpé à **180 min** (PR #52, pour les cold-cache builds des futures expansions).
- **Aucune dépendance Firebase** dans le code. `firebase` retiré de `app/package.json` en PR #51 (zéro import) → −82 packages, bundle SPA dégonflé.

### Pages SEO (339 URLs au sitemap)

| URL pattern | Nombre | Source |
|---|---|---|
| `/` (landing) | 1 | `src/pages/index.astro` |
| `/terrasses/` (hub villes par région) | 1 | `src/pages/terrasses/index.astro` (NOUVEAU 2026-05-03) |
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

### Indexation Google et Ranking — état + roadmap (2026-05-03)

**État actuel** : sitemap soumis (339 URLs), GSC vérifié. **Gros twist découvert le 2026-05-03** : les 167 pages "Détectées non indexées" qui résistaient depuis 2026-04-23 étaient en fait **physiquement 404 sur Hostinger** depuis l'incident PR #60 (cf. post-mortem). Google a donc raison de ne pas les indexer — il les crawl, prend du 404, et les met dans la file *"Détectée mais non indexée"*. Avant le fix d'aujourd'hui, **aucune optimisation de contenu, de maillage ou de méta** n'aurait pu débloquer la situation.

Aujourd'hui (2026-05-03), toutes les 339 URLs répondent 200. Le travail SEO peut **enfin** porter ses fruits.

#### Actions immédiates (J0 = 2026-05-03)

- ✅ **Re-indexation manuelle de 10 URLs** via *URL Inspection* dans GSC. À continuer chaque jour (limite ~10/jour/propriété) sur d'autres pages prioritaires.
- ⏳ **Re-soumettre le sitemap** dans GSC → *Sitemaps* → cliquer les `…` à côté de `sitemap-index.xml` → *Re-soumettre*. Force Google à re-prendre la liste des 339 URLs avec leur état actuel (200).
- ⏳ **Vérifier dans 48h** que les 10 URLs basculent de *"Détectée non indexée"* → *"Indexée"* dans GSC.

#### Plan de bataille indexation (J+1 → J+30)

**J+1 à J+7 — Re-indexation manuelle quotidienne (10 URLs/jour)**

Cibler par priorité descendante :
1. **Top métropoles ville pages** : `/terrasses/paris/`, `/terrasses/lyon/`, `/terrasses/marseille/`, `/terrasses/bordeaux/`, `/terrasses/toulouse/`, `/terrasses/nice/`, `/terrasses/nantes/`, `/terrasses/strasbourg/`, `/terrasses/lille/`, `/terrasses/montpellier/`
2. **Top métropoles variation pages** (par requêtes Google les plus fréquentes) :
   - `bar-ensoleille-paris`, `cafe-terrasse-paris`, `restaurant-terrasse-paris`
   - `bar-ensoleille-lyon`, `cafe-terrasse-lyon`, `restaurant-terrasse-lyon`
   - `bar-ensoleille-bordeaux`, `cafe-terrasse-bordeaux`
3. **Hubs touristiques** (intent fort été) : `/terrasses/saint-tropez/`, `/terrasses/cannes/`, `/terrasses/biarritz/`, `/terrasses/la-rochelle/`, `/terrasses/honfleur/`, `/terrasses/chamonix/`, `/terrasses/avignon/`, `/terrasses/aix-en-provence/`
4. **Pages quartiers à fort volume** : `/terrasses/paris/marais/`, `/terrasses/paris/montmartre/`, `/terrasses/paris/saint-germain/`, `/terrasses/lyon/vieux-lyon/`, `/terrasses/marseille/vieux-port/`, `/terrasses/bordeaux/chartrons/`, `/terrasses/strasbourg/petite-france/`
5. **Articles blog** (autorité de domaine) : `/blog/`, `/blog/orientation-terrasse-soleil/`, `/blog/comment-on-calcule-ensoleillement/`

Note : la page hub **`/terrasses/`** est aussi à inspecter — c'est une nouvelle URL qui n'est dans aucun cache Google.

**J+1 — Bing Webmaster Tools + IndexNow (gros levier, 30 min)**
- Aller sur https://www.bing.com/webmasters → ajouter le site → vérifier la propriété (méta tag dans `Layout.astro` ou fichier dans `public/`)
- Soumettre `https://terrasse-au-soleil.fr/sitemap-index.xml`
- Activer **IndexNow** : générer une clé, la déposer dans `public/<key>.txt`, configurer un endpoint d'envoi automatique. Bonus : Yandex et autres moteurs respectent IndexNow → push notification de toutes les URLs nouvelles ou modifiées.
- Pourquoi : Bing crawle plus agressivement que Google. Quand Bing indexe vite, Google a tendance à re-crawler en parallèle (signal de fraîcheur). C'est le hack le plus rentable du moment.

**J+1 — Resoumettre le sitemap dans GSC**
- Onglet *Sitemaps* → action *…* à côté de `sitemap-index.xml` → *Re-soumettre*
- Permet à Google de re-découvrir les 339 URLs avec leur état actuel 200

**J+3 à J+14 — Surveillance + 2e vague d'inspections**
- Suivre dans GSC *Pages > Indexées* la progression jour après jour (devrait grimper de 4 → 50-100+ en 1-2 semaines)
- Quand le compteur stagne, refaire 10 inspections sur les pages restées non indexées
- Si certaines URLs reviennent en 404 dans GSC alors qu'elles répondent 200 par curl → suspecter un cache Google obsolète. Une nouvelle *URL Inspection* + *Demander une indexation* force Google à re-fetcher

**J+14 → J+30 — Indexation passive**
- Le combo sitemap re-soumis + maillage interne + Bing/IndexNow + recrawl naturel devrait amener 90%+ des 339 URLs en *"Indexée"* sous 1 mois
- Les ~10-20% restantes sont les pages "thin content" (peu de texte, faible singularité). À enrichir cas par cas (cf. plan ranking ci-dessous).

#### Plan de bataille ranking (J+30 → J+90+)

Une fois les pages indexées, le travail commence vraiment. **Indexation = être trouvable. Ranking = être trouvé.**

**Quick wins ranking (1-2h chacun, gros impact sur LCP / CLS / engagement)**

1. **Améliorer méta-descriptions** (~30 min) : actuellement génériques sur les pages variation (template "Les meilleurs bars ensoleillés à <ville>"). Les enrichir avec des chiffres et des hooks ("12 bars analysés", "score moyen 78%", "ouverts en terrasse de 11h à 22h"). Influence le CTR depuis les SERP, pas le ranking direct, mais Google utilise le CTR comme signal.
2. **Préload critical assets** (15 min) : ajouter `<link rel="preload" as="image">` sur l'OG card de la page courante et `<link rel="preload" as="font">` sur Inter dans `Layout.astro`. Gain LCP marginal mais propre. Code à ajouter dans le `<head>` :
   ```astro
   <link rel="preload" href={ogImage} as="image" />
   <link rel="preload" href="https://fonts.gstatic.com/s/inter/..." as="font" type="font/woff2" crossorigin />
   ```
3. **Tester Core Web Vitals** : `npx lighthouse https://terrasse-au-soleil.fr/terrasses/paris/ --view` ou via PageSpeed Insights. Cible : LCP < 2.5s, CLS < 0.1, FID < 100ms. Le LCP est probablement le plus serré (carte Leaflet avec markers + photos OSM).
4. **Sitemap priority/changefreq** par type de page (~30 min) : actuellement uniforme à 0.7. Augmenter `priority` à 1.0 sur la home, 0.9 sur les pages métropoles, 0.8 sur les variations métropoles, 0.7 sur les autres villes, 0.5 sur les quartiers. Modifier `astro.config.mjs` :
   ```js
   sitemap({
     filter: (page) => !page.includes('/app/'),
     serialize(item) {
       if (item.url === SITE + '/') return { ...item, priority: 1.0 };
       if (/\/terrasses\/(paris|lyon|marseille|bordeaux|toulouse|nice|nantes|strasbourg)\/$/.test(item.url)) return { ...item, priority: 0.9 };
       // etc.
     },
   })
   ```

**Moyen terme ranking (3-6h chacun)**

5. **More articles blog** : viser 15-20 articles à terme (vs 6 actuellement). Pour chaque article, viser une requête longue traîne précise + 4-6 cross-links vers des pages ville/variation. Idées validées :
   - "Top 10 terrasses ensoleillées à Lyon en mai 2026" (très commercial)
   - "Où boire un verre au soleil le dimanche à Paris" (intent local précis)
   - "Quels arrondissements parisiens ont le plus de soleil" (intent géographique)
   - "Brunch terrasse Marseille bord de mer" (long tail tourisme)
   - "Terrasses chauffées vs terrasses ensoleillées : quand choisir quoi" (déjà partiellement traité, à reprendre en mode *"vs"* clair pour Google snippets)
   - Pour ajouter : créer un fichier `.mdx` dans `src/content/blog/` avec frontmatter conforme au schema (`title`, `description`, `pubDate`, `keywords`, `relatedCities`, `relatedVariation`)
6. **Schema.org Restaurant/BarOrPub avec aggregateRating** (3h) : ajouter des `aggregateRating` au JSON-LD `ItemList` de chaque page ville → étoiles dans les SERP. Nécessite une source de notes (User reviews futures, ou import depuis une API tierce avec attribution).
7. **Filtres avancés OSM** (chantier E ouvert) : générer 100-200 pages secondaires type "Bars chiens acceptés à Lyon" en croisant les tags OSM `dog`, `view`, `waterway`, `child_friendly`. Multiplie les pages utiles à fort intent.

**Long terme ranking (1+ semaine)**

8. **Multi-langue EN/IT/DE** (chantier I) : Astro i18n. Cible touristes l'été — "sunny terrace Paris", "terrazza al sole Roma" (pour les sites équivalents en Italie), etc. Multiplie le potentiel par 3-4.
9. **User reviews** (chantier J) : crowdsourcing scores soleil + commentaires + photos. Auth Supabase + table `reviews` + UI moderation admin. Génère du contenu unique → différenciation forte vs sites concurrents.
10. **Promotion payante** : champ `promotionScore` dans Postgres, tri pondéré `(promotionScore DESC, sunExposure DESC)`, badge "Partenaire". À conditionner après validation AdSense + premier trafic mesuré (3-6 mois après les efforts ci-dessus).

#### Métriques à suivre

| Métrique | Source | Fréquence | Objectif J+30 | Objectif J+90 |
|---|---|---|---|---|
| Pages indexées | GSC > Indexées | hebdo | 50+ (vs 4 au 2026-04-28) | 300+ |
| Détectées non indexées | GSC > Détectées non indexées | hebdo | < 100 | < 30 |
| Impressions / Clics | GSC > Performance | hebdo | 500/sem / 20 | 5000/sem / 200 |
| Position moyenne top requêtes | GSC > Performance | hebdo | < 30 | < 15 |
| Pages dans Bing | Bing Webmaster | hebdo | 200+ (post setup IndexNow) | 300+ |
| LCP / CLS | PageSpeed Insights | mensuel | LCP < 3s | LCP < 2.5s |
| Trafic AdSense (CPM, RPM) | dashboard AdSense | hebdo | seuil de paiement (~80€) | 200€/mois |

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
- **AdSense activé 2026-05-02** (PR #57-#60) — `PUBLIC_ADSENSE_CLIENT=ca-pub-2931993647559356`, tag injecté dans Layout, ads.txt à la racine
- **Fix triple incident 2026-05-03** (PR #61) — `VITE_*` propagés via `app/.env` (fix SPA "Erreur IA"), diagnostic lftp ajouté au workflow, redéploiement complet a recréé 342 dossiers SEO et uploadé 764 fichiers absents
- **Page hub `/terrasses/` par région** (PR #62) — fix breadcrumb 403, 53e page indexable, sitemap 338 → 339 URLs

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

### Priorité 1 — Indexation Google (post-incident 2026-05-03)

Cf. § *"Indexation Google et Ranking — état + roadmap"* plus haut pour le détail.

- ⏳ **Resoumettre le sitemap** dans GSC (1 min, à faire avant tout)
- ⏳ **URL Inspection quotidienne** : 10 nouvelles URLs/jour pendant 1-2 semaines pour pousser l'indexation manuelle. Cibler : top métropoles, variations, hubs touristiques, articles blog.
- ⏳ **Bing Webmaster Tools + IndexNow** : ajout du site (~30 min). Plus gros levier hors GSC.
- ⏳ **Vérifier dans 48h** que les 10 URLs déjà soumises (envoyées le 2026-05-03 ~13h UTC) sont bien indexées.

### Priorité 2 — Quick wins SEO/Ranking (1-2h chacun, après indexation stabilisée)

- **Améliorer méta-descriptions** : actuellement génériques sur les pages variation (template "Les meilleurs bars ensoleillés à <ville>"). Les enrichir avec des chiffres et hooks ("12 bars analysés", "score moyen 78%"). ~30 min. Influence le CTR depuis SERP, pas le ranking direct mais signal pour Google.
- **Préload critical assets** : ajouter `<link rel="preload" as="image">` sur l'OG card et `<link rel="preload" as="font">` sur Inter dans `Layout.astro`. Gain LCP.
- **Sitemap priority/changefreq différenciés** par type de page : modifier `astro.config.mjs` pour mettre `priority: 1.0` sur la home, `0.9` sur les top métropoles, dégradé selon type. Aide Google à prioriser le crawl budget.
- **More articles blog** : viser 15-20 articles à terme (vs 6). Pour chaque, requête longue traîne précise + 4-6 cross-links vers pages ville/variation. Idées validées dans la roadmap.

### Priorité 3 — Moyen terme (gros levier trafic, 3-6h chacun)

- **E — Filtres avancés OSM** : tags OSM "terrasse avec vue" (`view`), "bord de l'eau" (`waterway` proximité), "enfants acceptés" (`child_friendly`), "chien accepté" (`dog`). Génère 100-200 pages secondaires *"Bars chiens acceptés à Lyon"*. Multiplie les requêtes adressées.
- **Quartiers manquants** : sur les 30 nouvelles villes de la PR #52, seules ~12 ont des quartiers. Compléter avec 2-4 quartiers par ville touristique restante (Brest, Nantes-mer, Vannes, Quimper, Pau, etc.) → ~400 pages au sitemap.
- **Schema.org `aggregateRating`** : ajouter dans le JSON-LD `ItemList` de chaque page ville → étoiles dans les SERP. Nécessite source de notes (User reviews futures, ou import API tierce avec attribution).
- **Mapper les vrais AdSense slotId** : remplacer les placeholders `1111111111`, `2222222222`, `3333333333` dans `CityVariationPage.astro` par les vrais IDs des unités d'annonce du dashboard AdSense.

### Priorité 4 — Long terme (gros chantiers, 1+ semaine)

- **I — Multi-langue EN/IT/DE** : Astro i18n. Cible touristes l'été — multiplie le potentiel par 3-4. Le plus gros levier trafic à long terme.
- **G — Push notifications web** : "Demain 26°C ensoleillé, ta terrasse favorite à Lyon : 85%". Service worker + abonnement. Booste fidélisation et signal d'engagement Google.
- **H — PWA installable** : manifest + cache offline.
- **J — User reviews** : crowdsourcing scores soleil + commentaires + photos. Auth Supabase + table `reviews` + UI moderation admin. Génère du contenu unique → différenciation forte.
- **Phase 3 scoring** : imagerie satellite ou Street View pour orientation réelle (vs déduction polygone OSM actuelle).

### Business / monétisation

- **AdSense** : ✅ **activé 2026-05-02**. Compte validé Google, `PUBLIC_ADSENSE_CLIENT=ca-pub-2931993647559356` set en secret GitHub. Le tag `adsbygoogle.js` est injecté automatiquement dans le `<head>` des 339 pages via `Layout.astro`. **Reste à** : configurer les unités d'annonce dans le dashboard AdSense, mapper les `slotId` des composants `<AdSlot>` vers les vrais slot IDs.
- **Promotion payante** : champ `promotionScore` dans Postgres, tri pondéré `(promotionScore DESC, sunExposure DESC)`, badge "Partenaire". À conditionner après validation AdSense + premier trafic mesuré (3-6 mois).

### Hardening / dette technique

- **Hostinger FTPS instable** (NOUVEAU post-incident 2026-05-03) : 2 timeouts sur 5 runs en 1 journée. Le retry 3-tentatives existant a sauvé une partie mais pas tout. Options à considérer :
  - Bumper le `timeout` interne du FTP-Deploy-Action
  - Switcher sur `lftp` direct dans le workflow (plus contrôlable)
  - Migrer vers Cloudflare Pages, Vercel ou Netlify (vraie solution structurelle, mais perd le `.htaccess` et la simplicité d'un FTP)
- **Test e2e du breadcrumb** : ajouter un test Playwright (ou Vitest + node-fetch) qui crawl chaque breadcrumb item d'une page ville/quartier et vérifie le statut 200. Aurait évité le bug `/terrasses/` 403.
- **WebSocket Realtime** (`wss://api.terrasse-au-soleil.fr/realtime/v1/websocket`) — Traefik n'upgrade pas WS. Symptôme : warnings dans la console SPA admin. Pas d'impact fonctionnel sur la recherche ni le SEO. Fix dans la config Traefik VPS.
- **`GEMINI_BUILD_KEY` invalide** : la clé `GEMINI_BUILD_KEY` dans les secrets GitHub est rejected par Google ("API key not valid"). Le router fallback sur `GEMINI_API_KEY` qui elle est valide. À nettoyer un jour. Aucune urgence.
- **Step diagnostic lftp dans `deploy.yml`** : ajouté le 2026-05-03 pour debugger l'incident. Toujours présent (utile filet de sécurité), `continue-on-error: true` + `timeout 90s` donc inoffensif. Ajoute ~30 s par run. Peut être retiré si jamais on veut accélérer le pipeline.

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
| `PUBLIC_ADSENSE_CLIENT` | Tag AdSense injecté dans Layout.astro | ✅ `ca-pub-2931993647559356` (2026-05-02) |
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
│   │   ├── index.astro              (home avec section blog teaser)
│   │   ├── blog/
│   │   │   ├── index.astro          (liste articles)
│   │   │   └── [...slug].astro      (article rendu)
│   │   ├── terrasses/
│   │   │   ├── index.astro          (NOUVEAU 2026-05-03 — page hub par région, fix breadcrumb 403)
│   │   │   └── [ville]/
│   │   │       ├── index.astro
│   │   │       └── [quartier].astro
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
- **2026-05-02 — Activation AdSense (PR #57-#60, fond de cale incident en germe)** :
  - **PR #57** (`90e1acd`) : docs HANDOFF — note d'activation AdSense 2026-05-02.
  - **PR #58** (`181ca26`) : `fix(adsense)` — render no `<ins>` when slotId is a placeholder, évite les erreurs AutoAds.
  - **PR #59** (`473eb28`) : `fix(adsense)` — write transient `.env` so Astro/Vite picks up `PUBLIC_ADSENSE_CLIENT`. **Régression silencieuse** : ce commit a écrit `app/.env` avec **uniquement** `PUBLIC_ADSENSE_CLIENT`, ce qui a shadow `process.env.VITE_*` côté Vite et cassé la SPA. Pas détecté ce jour-là car personne n'a testé `/app/`.
  - **PR #60** (`714921c`) : `chore(adsense)` — add `ads.txt` at site root. Le deploy associé a planté 3× au FTP timeout, état de prod resté incohérent (sync state corrompu, ~340 dossiers SEO disparus). Pas détecté ce jour-là non plus.
- **2026-05-03 — Triple incident + page hub `/terrasses/`** *(détail complet dans § "Post-mortem incident du 2026-05-03" plus haut)* :
  - **Bug A découvert** : `/app/` affichait *« Erreur IA : Supabase env vars manquantes »* depuis ~24h, conséquence du commit `473eb28`.
  - **Bug B découvert** : 52 pages SEO en 404 (Paris, Lyon, etc.) car les dossiers étaient absents du FTP Hostinger depuis l'incident PR #60.
  - **Bug C découvert** : `/terrasses/` (lien breadcrumb) en 403 car pas de `index.astro` à la racine du dossier.
  - **PR #61** (`c2c1725`) : fix(ci) — passe `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + `VITE_ADMIN_EMAIL` via `app/.env` (pas seulement `process.env`). Ajoute un sanity check `grep -oE '^[A-Z_]+=' app/.env` dans le log build, et un step de diagnostic lftp transient avant le déploiement (liste sentinels + sync state file). Le redéploiement a recréé **342 dossiers + 764 fichiers** sur Hostinger.
  - **PR #62** (`37e9d4a`) : feat(seo) — ajout de `src/pages/terrasses/index.astro`, page hub statique listant les 52 villes groupées par région. Sitemap 338 → 339 URLs.
  - **Indexation Google** : URL Inspection lancée sur 10 URLs prioritaires. Roadmap d'indexation détaillée ajoutée au HANDOFF (cf. § "Indexation Google et Ranking").
  - **Bilan incidents** : prod stable post-15h UTC. 13/13 URLs SEO échantillonnées en 200, sitemap à 339 URLs, bundle SPA contient bien les valeurs Supabase, breadcrumb fonctionnel. Hostinger FTPS reste instable (2 timeouts sur 5 runs ce jour-là), à surveiller.
