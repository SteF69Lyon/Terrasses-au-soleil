# Handoff — reprise du travail entre PCs

Ce fichier est le point de reprise partagé entre les 3 PCs. Il est mis à jour à la fin de chaque session. Il vit dans le repo donc il suit via `git pull`.

---

## 🚀 Reprise rapide (à lire en premier)

### Sur un PC déjà setup

```bash
cd /c/dev/terrasses-au-soleil
git pull origin main
# Si de nouvelles deps sont arrivées :
npm install
cd app && npm install && cd ..
# Ouvre ton éditeur / Claude Code ici
```

### Sur un PC où le projet n'est pas encore setup

```bash
# 1. Cloner à l'emplacement standard (hors OneDrive — important)
mkdir -p /c/dev
git clone https://github.com/SteF69Lyon/Terrasses-au-soleil.git /c/dev/terrasses-au-soleil
cd /c/dev/terrasses-au-soleil

# 2. Se mettre sur main et tirer la dernière version
git checkout main
git pull

# 3. Installer les dépendances frontend (SPA actuelle)
npm install

# 4. Installer les dépendances des Cloud Functions
cd functions && npm install && cd ..

# 5. Recréer le fichier .env.local (non commité, spécifique à chaque PC)
echo "VITE_ADMIN_EMAIL=sflandrin@outlook.com" > .env.local

# 6. Vérifier que la CLI Firebase est connectée
firebase projects:list
# Si pas connecté :
firebase login
firebase use terrassesausoleil

# 7. Vérifier que tout compile
npm run build

# 8. (Optionnel, test complet) lancer le dev server
npm run dev
# Puis ouvrir http://localhost:3000
```

Une fois ces étapes passées, ouvrir Claude Code dans ce dossier et taper :
> *"Reprends le travail, lis HANDOFF.md"*

Claude lira ce fichier et enchaînera sur la tâche en cours.

---

## 📍 État du projet — 2026-04-22 fin de journée

### Ce qui est terminé ✅ et en prod

**Sécurisation Gemini/Firebase** (sessions précédentes) — Cloud Functions en `europe-west1`, règles Firestore durcies, secret Gemini hors bundle client.

**Upgrades runtime** — Node 22 + firebase-functions v7 déployés (avant deadline Node 20 du 2026-04-30).

**Assistant vocal amélioré** — reçoit désormais la liste des terrasses affichées en `systemInstruction` + tool `search_terraces` (function calling Gemini Live) pour déclencher une recherche depuis la voix.

**Plan SEO Astro — Tasks 1 à 19 mergées sur `main`** (PR #4, #5, #6) :
- Architecture hybride : Astro à la racine, SPA dans `app/` servie sur `/app/`
- Build unifié : `npm run build` → `app/dist` + Astro `dist/` → merge via `scripts/merge-dist.mjs`
- Hostinger : commande `npm run build` inchangée (install chaîné dans le script)
- Règles Firestore cache déployées (`osmCache`, `sunScores`, `pageIntros`, `pageFaqs`, `cityGeo`)
- Couche lib/ complète : `cache`, `urls`, `nominatim`, `overpass`, `gemini`, `jsonld`, `buildData`, `firebase` — **22 tests Vitest OK**
- 15 villes seedées (5 avec quartiers détaillés = 18 quartiers)
- Pages dynamiques : `/terrasses/[ville]/`, `/terrasses/[ville]/[quartier]/`, `/bar-ensoleille-[ville]/`, `/cafe-terrasse-[ville]/`, `/restaurant-terrasse-[ville]/`, `/ou-boire-un-verre-au-soleil-[ville]/` → ~150 pages générables
- Landing `/` remplacée (directory des 15 villes, CTA vers `/app/`)
- Sitemap configuré avec exclusion de `/app/`
- Composants partagés + MiniMap React Leaflet
- **Dégradation gracieuse** : sans env vars Firebase+Gemini au build, `getStaticPaths` retourne `[]` et les pages dynamiques ne sont pas générées. Pas de casse de build.

### 🔜 Task 20 — Premier déploiement SEO complet (ACTION REQUISE CÔTÉ UTILISATEUR)

Tant que les env vars du build ne sont pas fournies, **seule la landing est déployée** (pas les 150 pages SEO). Hostinger rebuilde actuellement avec la nouvelle landing mais pas de contenu dynamique.

**Deux options pour activer le build complet :**

**Option A — Variables d'env sur Hostinger** (si supporté par le panneau)
1. Ajouter dans Hostinger → Git deploy → Variables d'environnement :
   - `GEMINI_BUILD_KEY` = clé Gemini (peut réutiliser celle du `.env.local`)
   - `FIREBASE_SERVICE_ACCOUNT` = contenu JSON du service account (une ligne, tout sur la même)
2. Relancer un deploy (nouveau commit ou bouton "redeploy")

**Option B — Build local + push `dist/`** (fallback si Hostinger ne supporte pas les env vars)
1. Le SA JSON est déjà à `/c/dev/terrasses-au-soleil/terrassesausoleil-firebase-adminsdk-fbsvc-198080c6ba.json`
2. Ajouter `GEMINI_BUILD_KEY` dans le shell :
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/c/dev/terrasses-au-soleil/terrassesausoleil-firebase-adminsdk-fbsvc-198080c6ba.json"
   export GEMINI_BUILD_KEY="xxx"  # même valeur que GEMINI_API_KEY côté app
   cd /c/dev/terrasses-au-soleil && npm run build
   ```
3. Premier run : ~5-10 min (1 req/s Nominatim sur 15 villes + Overpass + Gemini par batch).
4. Vérifier `dist/bar-ensoleille-lyon/index.html`, `dist/terrasses/paris/11e/index.html`, etc.
5. Pousser le `dist/` sur Hostinger manuellement (FTP/SFTP) OU commit+push vers une branche `deploy` si Hostinger peut lire une branche différente.

**Option C — GitHub Action** (Task 22 du plan, pas encore implémentée) : déploiement automatisé avec secrets GitHub. À faire en session séparée si Hostinger ne fait pas l'affaire.

### Tâches restantes du plan SEO (post Task 20)

- **Task 21** — Soumission Search Console, vérif indexation
- **Task 22** — GitHub Action rebuild mensuel (pour que le cache ne se périme pas)
- **Task 23** — Étendre le scope à ~200 pages une fois la V1 indexée et validée

---

## 🏗️ Contexte projet

**App :** Terrasses-au-soleil — recherche de terrasses ensoleillées via IA.

**URL prod :** https://terrasse-au-soleil.fr (hébergé Hostinger, auto-deploy sur push `main`)

**Stack actuelle (hybride Astro + SPA) :**
- Frontend statique SEO : Astro 6 + React 19 (racine, servi sur `/`, `/terrasses/...`, `/bar-ensoleille-...`, etc.)
- SPA : React 19 + Vite 6 (dans `app/`, servie sur `/app/`)
- Backend : Firebase Cloud Functions v2 (Node 22, TypeScript, région `europe-west1`)
- Data : Firestore (`profiles`, `ads`, + caches SEO `osmCache`/`sunScores`/`pageIntros`/`pageFaqs`/`cityGeo`)
- IA runtime : Gemini via Cloud Functions (clé en secret Firebase)
- IA build : Gemini direct via `GEMINI_BUILD_KEY` (scoring soleil + intros + FAQ des pages SEO)
- Auth : Firebase Auth

**Projet Firebase :** `terrassesausoleil` (id) — TerrassesAuSoleil (nom affiché)

**Admin :** `sflandrin@outlook.com` (email utilisé pour les règles Firestore `ads` et la variable `VITE_ADMIN_EMAIL`)

**Repo GitHub :** https://github.com/SteF69Lyon/Terrasses-au-soleil

### Arbre actuel

```
/c/dev/terrasses-au-soleil/
├── astro.config.mjs, package.json   (Astro racine)
├── src/pages/                       (landing / + pages dynamiques SEO)
├── src/lib/                         (cache, urls, nominatim, overpass, gemini, jsonld, buildData, firebase)
├── src/components/                  (Layout, Breadcrumb, TerraceCard, AdSlot, FaqList, MiniMap, CityVariationPage, RelatedAreas)
├── src/data/cities.ts               (seed 15 villes)
├── src/styles/global.css
├── tests/lib/                       (22 tests Vitest)
├── public/                          (robots.txt, og-default.jpg)
├── app/                             (SPA Vite — React 19)
│   ├── App.tsx, vite.config.ts, package.json, .env.local (non commité)
│   ├── components/, services/, types.ts
├── functions/                       (Cloud Functions — Node 22)
├── scripts/merge-dist.mjs           (combine les deux builds)
├── firebase.json, firestore.rules, firestore.indexes.json, .firebaserc
├── terrassesausoleil-firebase-adminsdk-*.json (SA JSON pour build local, gitignored)
├── docs/superpowers/{specs,plans}/
└── HANDOFF.md
```

---

## ⚠️ À prévoir prochainement (post-SEO)

Ces points ne sont pas bloquants aujourd'hui mais à traiter bientôt :

- **Déployer l'upgrade Node 22 / firebase-functions v7** — fait en local, non encore poussé en prod. Commande : `firebase deploy --only functions`. À faire avant le 2026-04-30.
- **Bundle Vite SPA à 964 kB** — warning au build, nuit au Core Web Vitals et donc au SEO. Code-splitting via dynamic imports sur `services/geminiService.ts` et les composants lourds. Chantier séparé post-SEO.

---

## 🌐 Workflow cross-PC

- Le repo est la seule source de vérité (pas OneDrive pour le code — ça corrompt les objets git).
- Fin de session : `git add -A && git commit -m "..." && git push`
- Début de session : `git pull`
- Si travail en cours non commité : **commit wip** avant de partir, même si le code ne fonctionne pas, avec un message `wip: <état>`. On rebase/squash au prochain bon moment.
- Les fichiers mémoire Claude (`~/.claude/projects/…/memory/`) **ne sont pas synchronisés** entre PCs. Ce fichier HANDOFF.md est le vrai handoff partagé.
- `.env.local` n'est jamais commité → à recréer manuellement sur chaque PC (voir section Reprise rapide).

## 🔧 Commandes utiles

| Besoin | Commande |
|---|---|
| Dev local (SPA actuelle) | `npm run dev` puis `http://localhost:3000` |
| Build de prod | `npm run build` |
| Déployer règles Firestore | `firebase deploy --only firestore:rules` |
| Déployer Cloud Functions | `firebase deploy --only functions` |
| Voir les logs Functions | `firebase functions:log` |
| Lister les secrets Firebase | `firebase functions:secrets:access <NOM>` (⚠️ affiche la valeur en clair) |
| Projet Firebase courant | `firebase use` |
