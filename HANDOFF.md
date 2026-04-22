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

## 📍 État du projet — 2026-04-22

### Ce qui est terminé ✅

**Sécurisation Gemini/Firebase (Task 9 du premier plan)** — tout est en prod :
- Secret `GEMINI_API_KEY` enregistré dans Firebase
- 3 Cloud Functions déployées en `europe-west1` (`geminiSearch`, `geminiTts`, `geminiLiveToken`)
- Règles Firestore durcies déployées (default-deny + règles sur `profiles`, `ads`, caches SEO)
- Clé Gemini absente du bundle client en prod (vérifié par grep)
- Variable `VITE_ADMIN_EMAIL` en place sur Hostinger
- Branche `claude/musing-cartwright-e84790` mergée sur `main`
- Hostinger a auto-déployé sur `terrasse-au-soleil.fr`

**Upgrades runtime / deps Cloud Functions (2026-04-22)** — prêt à déployer :
- `firebase.json` : runtime passé à `nodejs22` (avant deadline 2026-04-30)
- `functions/package.json` : `engines.node` → `22`, `firebase-functions` → `^7.0.0`
- `firebase-admin` reste en `^13.0.0` (résolu à 13.8.0, Node 22 supporté)
- `functions/package-lock.json` désormais commité pour builds reproductibles cross-PC
- Build TS local OK (`npm run build` dans `functions/`)
- ⚠️ **Reste à déployer** : `firebase deploy --only functions` depuis un PC avec la CLI Firebase connectée, puis vérifier `firebase functions:log` pour absence de régressions sur les 3 endpoints.

### Ce qui reste à tester manuellement (5 min)

- Ouvrir `https://terrasse-au-soleil.fr` dans le navigateur et tester :
  - [ ] Une recherche de terrasse (doit appeler `europe-west1-terrassesausoleil.cloudfunctions.net`, visible dans l'onglet Réseau du devtools)
  - [ ] Le bouton TTS d'une description
  - [ ] L'assistant vocal **connecté** (doit s'ouvrir normalement)
  - [ ] L'assistant vocal **déconnecté** (doit afficher une erreur gérée, pas crash)
- Dans Firebase Console → Firestore → Rules → Rules Playground :
  - [ ] Écriture `ads/test` par un user non-admin → **Denied**
  - [ ] Écriture `ads/test` par user `sflandrin@outlook.com` → **Allowed**

### Prochain chantier : pages SEO statiques pour trafic AdSense

**Objectif métier :** générer du trafic organique sur le site (le business model repose sur AdSense, la SPA actuelle est invisible à Google).

**Documents de référence :**
- Design validé : [`docs/superpowers/specs/2026-04-21-seo-pages-statiques-astro-design.md`](docs/superpowers/specs/2026-04-21-seo-pages-statiques-astro-design.md)
- Plan d'implémentation détaillé (23 tasks) : [`docs/superpowers/plans/2026-04-21-seo-pages-statiques-astro.md`](docs/superpowers/plans/2026-04-21-seo-pages-statiques-astro.md)

**Résumé de l'approche validée :**
- Hybride : Astro statique à la racine pour les pages SEO, SPA Vite existante déplacée dans `app/`. Un seul `dist/` fusionné est déployé.
- Source de données : OpenStreetMap (Overpass) + analyse Gemini au build. Caché dans Firestore avec TTL.
- V1 : ~95 pages au premier déploiement (15 villes × 4 variations lexicales + ~18 quartiers sur les 5 grandes villes), extensible à ~200 après validation Google.
- AdSense : emplacements prévus mais invisibles tant que les IDs AdSense ne sont pas fournis (après validation du compte).

**Exécution recommandée :** demander à Claude Code dans cette session :
> *"Exécute le plan `docs/superpowers/plans/2026-04-21-seo-pages-statiques-astro.md` en subagent-driven (un sub-agent par task, review entre chaque)."*

Ou alternative plus directe :
> *"Exécute le plan en inline execution, avec checkpoint après chaque groupe de 3 tasks."*

Le plan démarre par la Task 1 (déplacement de la SPA dans `app/`) qui est une opération réversible via Git, donc safe.

**Pré-requis avant de lancer l'exécution du plan :**
1. Avoir un service account Firebase pour le build local/CI.
   - Firebase Console → Project settings → Service accounts → Generate new private key
   - Sauvegarder le JSON dans `/c/Users/<user>/terrasses-sa.json` (hors repo)
2. Export dans le shell avant de builder :
   ```bash
   export FIREBASE_SERVICE_ACCOUNT="$(cat /c/Users/<user>/terrasses-sa.json)"
   export GEMINI_BUILD_KEY="ta_cle_gemini"
   ```
3. (Pour que la GitHub Action marche plus tard) ajouter ces 2 secrets sur GitHub :
   - Repo Settings → Secrets and variables → Actions → New repository secret
   - `FIREBASE_SERVICE_ACCOUNT` (contenu du JSON complet)
   - `GEMINI_BUILD_KEY` (la clé Gemini)

---

## 🏗️ Contexte projet

**App :** Terrasses-au-soleil — recherche de terrasses ensoleillées via IA.

**URL prod :** https://terrasse-au-soleil.fr (hébergé Hostinger, auto-deploy sur push `main`)

**Stack actuelle (en cours de migration hybride) :**
- Frontend : React 19 + Vite 6 (dans `app/` après Task 1 du nouveau plan, à la racine avant)
- Backend : Firebase Cloud Functions v2 (Node 20, TypeScript, région `europe-west1`)
- Data : Firestore (collections `profiles`, `ads` + collections SEO à venir)
- IA : Gemini API (`@google/genai`, clé stockée en secret Firebase)
- Auth : Firebase Auth

**Projet Firebase :** `terrassesausoleil` (id) — TerrassesAuSoleil (nom affiché)

**Admin :** `sflandrin@outlook.com` (email utilisé pour les règles Firestore `ads` et la variable `VITE_ADMIN_EMAIL`)

**Repo GitHub :** https://github.com/SteF69Lyon/Terrasses-au-soleil

### Arbre actuel (avant exécution du nouveau plan)

```
/c/dev/terrasses-au-soleil/
├── App.tsx, index.html, index.tsx, vite.config.ts, tsconfig.json  (SPA racine — sera déplacé)
├── components/, services/, types.ts                               (SPA — sera déplacée)
├── functions/                                                     (Cloud Functions — inchangé)
├── firebase.json, firestore.rules, firestore.indexes.json, .firebaserc
├── docs/superpowers/specs/          (design docs)
├── docs/superpowers/plans/          (plans d'impl)
├── HANDOFF.md                       (ce fichier)
├── .env.local                       (non commité)
└── dist/                            (généré au build, non commité)
```

### Après exécution du plan SEO (pour info)

```
/c/dev/terrasses-au-soleil/
├── astro.config.mjs, package.json   (Astro racine)
├── src/pages/, src/lib/, src/components/, src/data/
├── tests/                           (Vitest)
├── public/                          (robots.txt, og-default.jpg)
├── app/                             (SPA Vite déplacée ici)
│   ├── App.tsx, vite.config.ts, package.json, ...
├── functions/                       (inchangé)
├── scripts/merge-dist.mjs           (combine les deux builds)
└── ...
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
