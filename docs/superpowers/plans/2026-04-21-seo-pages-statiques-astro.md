# Pages SEO statiques Astro — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un site Astro statique (hybride avec la SPA existante) qui génère ~200 pages SEO indexables pour Terrasses-au-soleil, alimentées par OpenStreetMap et enrichies par Gemini.

**Architecture:** Repo mono-dépôt : Astro à la racine pour les pages statiques, SPA Vite existante déplacée dans `app/`. Un build unifié produit un `dist/` qui contient le site statique à la racine et la SPA dans `dist/app/`. Les données OSM et les analyses Gemini sont cachées dans Firestore pour permettre des rebuilds rapides.

**Tech Stack:** Astro 4 + `@astrojs/react` + `@astrojs/sitemap` + `@astrojs/mdx` + React 19 (SPA existante) + Firebase (Firestore cache) + Overpass API (OSM) + Gemini API (via Cloud Functions ou appel direct au build) + Leaflet (cartes).

**Contexte de référence :** voir [`docs/superpowers/specs/2026-04-21-seo-pages-statiques-astro-design.md`](../specs/2026-04-21-seo-pages-statiques-astro-design.md) pour le design validé.

---

## Structure des fichiers

**Structure cible après Task 3 :**

```
terrasses-au-soleil/
├── astro.config.mjs              (NEW — config Astro)
├── package.json                  (MODIFIED — devient Astro root, scripts unifiés)
├── tsconfig.json                 (MODIFIED — pour Astro)
├── src/                          (NEW — tout le site Astro)
│   ├── pages/
│   │   ├── index.astro
│   │   ├── terrasses/
│   │   │   └── [ville]/
│   │   │       ├── index.astro
│   │   │       └── [quartier].astro
│   │   ├── bar-ensoleille-[ville].astro
│   │   ├── cafe-terrasse-[ville].astro
│   │   ├── restaurant-terrasse-[ville].astro
│   │   └── ou-boire-un-verre-au-soleil-[ville].astro
│   ├── data/
│   │   └── cities.ts
│   ├── lib/
│   │   ├── cache.ts              (wrapper Firestore avec TTL)
│   │   ├── nominatim.ts          (client geocoding OSM)
│   │   ├── overpass.ts           (client Overpass OSM)
│   │   ├── gemini.ts             (appels Gemini au build)
│   │   ├── urls.ts               (builders URL, slugify)
│   │   └── jsonld.ts             (helpers schema.org)
│   ├── components/
│   │   ├── Layout.astro          (layout partagé + head/meta)
│   │   ├── Breadcrumb.astro
│   │   ├── TerraceCard.astro
│   │   ├── MiniMap.astro         (React island avec Leaflet)
│   │   ├── AdSlot.astro          (emplacement AdSense)
│   │   ├── RelatedAreas.astro
│   │   └── FaqList.astro
│   └── styles/
│       └── global.css
├── public/
│   ├── robots.txt
│   └── og-default.jpg
├── tests/                        (NEW — tests Vitest)
│   ├── lib/
│   │   ├── cache.test.ts
│   │   ├── nominatim.test.ts
│   │   ├── overpass.test.ts
│   │   ├── gemini.test.ts
│   │   └── urls.test.ts
├── scripts/
│   └── merge-dist.mjs            (NEW — merge app/dist dans dist/app)
├── app/                          (NEW — SPA Vite existante déplacée ici)
│   ├── App.tsx
│   ├── components/
│   ├── services/
│   ├── index.html
│   ├── index.tsx
│   ├── types.ts
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json              (package.json Vite isolé)
│   └── .env.local                (non commité)
├── functions/                    (inchangé — Cloud Functions Firebase)
├── docs/                         (inchangé)
├── firebase.json                 (inchangé)
├── firestore.rules               (MODIFIED — nouvelles collections cache)
├── firestore.indexes.json        (inchangé)
├── .firebaserc                   (inchangé)
├── .gitignore                    (MODIFIED — ajouter astro cache, etc.)
└── HANDOFF.md                    (MODIFIED — documenter la nouvelle structure)
```

**Conventions :**
- Tests en Vitest (co-existent avec Astro nativement).
- Tous les slugs de villes/quartiers sont kebab-case ASCII (`vieux-lyon`, `11e`, `saint-michel`).
- Firestore collections nouvelles : `osmCache`, `sunScores`, `pageIntros`, `pageFaqs`, `cityGeo`.

---

## Task 1 : Déplacer la SPA dans `app/`

**Files:**
- Move: `App.tsx` → `app/App.tsx`
- Move: `index.html` → `app/index.html`
- Move: `index.tsx` → `app/index.tsx`
- Move: `types.ts` → `app/types.ts`
- Move: `vite.config.ts` → `app/vite.config.ts`
- Move: `tsconfig.json` → `app/tsconfig.json`
- Move: `metadata.json` → `app/metadata.json`
- Move: `components/` → `app/components/`
- Move: `services/` → `app/services/`
- Move: `package.json` → `app/package.json`
- Move: `package-lock.json` → `app/package-lock.json`
- Move: `.env.local` → `app/.env.local` (manuellement sur chaque PC, non commité)
- Create: `.gitignore` à la racine et `app/.gitignore`

- [ ] **Step 1 : Créer la branche de feature**

```bash
cd /c/dev/terrasses-au-soleil
git checkout main
git pull
git checkout -b feat/seo-astro
```

- [ ] **Step 2 : Créer le dossier `app/` et y déplacer les fichiers Vite**

```bash
mkdir -p app
git mv App.tsx app/App.tsx
git mv index.html app/index.html
git mv index.tsx app/index.tsx
git mv types.ts app/types.ts
git mv vite.config.ts app/vite.config.ts
git mv tsconfig.json app/tsconfig.json
git mv metadata.json app/metadata.json
git mv components app/components
git mv services app/services
git mv package.json app/package.json
git mv package-lock.json app/package-lock.json
mv node_modules app/node_modules
```

- [ ] **Step 3 : Déplacer `.env.local` (non commité)**

```bash
mv .env.local app/.env.local
```

- [ ] **Step 4 : Modifier `app/vite.config.ts`** pour que le build produise `app/dist/` avec `base: '/app/'`

Remplacer le contenu de `app/vite.config.ts` :

```ts
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/app/',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 5 : Vérifier que la SPA builde toujours**

```bash
cd app && npm run build
```

Résultat attendu : `app/dist/index.html` existe et référence `/app/assets/...`.

- [ ] **Step 6 : Tester que la SPA tourne en dev depuis `app/`**

```bash
cd app && npm run dev
```

Ouvrir `http://localhost:3000/app/` — l'app doit charger. Tester une recherche de terrasse. Arrêter le serveur (`Ctrl+C`).

- [ ] **Step 7 : Créer `.gitignore` à la racine**

```
# Dependencies
node_modules
app/node_modules
functions/node_modules

# Build output
dist
app/dist
functions/lib

# Astro
.astro
.cache

# Env
.env.local
app/.env.local
*.local

# Editor
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
```

- [ ] **Step 8 : Commit**

```bash
git add -A
git commit -m "refactor: move SPA into app/ subdirectory for hybrid Astro setup"
```

---

## Task 2 : Initialiser Astro à la racine

**Files:**
- Create: `package.json` (racine, Astro)
- Create: `astro.config.mjs`
- Create: `tsconfig.json` (racine)
- Create: `src/pages/index.astro` (placeholder)
- Create: `public/robots.txt`
- Create: `public/og-default.jpg` (image 1200x630 générique, placeholder pour l'instant)

- [ ] **Step 1 : Créer `package.json` à la racine**

```json
{
  "name": "terrasses-au-soleil",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build:astro": "astro build",
    "build:app": "cd app && npm ci && npm run build",
    "build:merge": "node scripts/merge-dist.mjs",
    "build": "npm run build:app && npm run build:astro && npm run build:merge",
    "preview": "astro preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "astro": "^4.16.0",
    "@astrojs/react": "^3.6.0",
    "@astrojs/sitemap": "^3.2.0",
    "@astrojs/mdx": "^3.1.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "firebase-admin": "^13.0.0"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.12",
    "@types/node": "^22.14.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "~5.8.2",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2 : Installer les dépendances**

```bash
npm install
```

Résultat attendu : `added N packages`, zéro erreur.

- [ ] **Step 3 : Créer `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://terrasse-au-soleil.fr',
  integrations: [react(), sitemap(), mdx()],
  output: 'static',
  build: {
    format: 'directory',
  },
  vite: {
    ssr: {
      noExternal: ['react-leaflet'],
    },
  },
});
```

- [ ] **Step 4 : Créer `tsconfig.json` à la racine**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["app", "functions", "dist"]
}
```

- [ ] **Step 5 : Créer `src/pages/index.astro` (placeholder)**

```astro
---
---
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Terrasses au soleil</title>
  </head>
  <body>
    <h1>Terrasses au soleil</h1>
    <p>Site en cours de migration. <a href="/app/">Ouvrir la recherche</a></p>
  </body>
</html>
```

- [ ] **Step 6 : Créer `public/robots.txt`**

```
User-agent: *
Allow: /
Disallow: /app/

Sitemap: https://terrasse-au-soleil.fr/sitemap-index.xml
```

- [ ] **Step 7 : Créer `public/og-default.jpg`**

Générer ou télécharger une image 1200x630 avec le logo et le texte "Terrasses au soleil". Placeholder acceptable : fond dégradé + titre. Déposer le fichier dans `public/og-default.jpg`.

- [ ] **Step 8 : Tester le build Astro seul**

```bash
npm run build:astro
```

Résultat attendu : `dist/index.html` existe et contient le `<h1>`.

- [ ] **Step 9 : Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json src/pages/index.astro public/robots.txt public/og-default.jpg
git commit -m "feat(astro): initialize Astro project at repo root"
```

---

## Task 3 : Script de merge et build unifié

**Files:**
- Create: `scripts/merge-dist.mjs`

- [ ] **Step 1 : Créer `scripts/merge-dist.mjs`**

```js
import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP_DIST = path.join(ROOT, 'app', 'dist');
const ROOT_DIST = path.join(ROOT, 'dist');
const TARGET_APP = path.join(ROOT_DIST, 'app');

async function main() {
  if (!existsSync(APP_DIST)) {
    throw new Error(`app/dist not found. Run "npm run build:app" first.`);
  }
  if (!existsSync(ROOT_DIST)) {
    throw new Error(`dist/ not found. Run "npm run build:astro" first.`);
  }
  if (existsSync(TARGET_APP)) {
    await rm(TARGET_APP, { recursive: true, force: true });
  }
  await mkdir(TARGET_APP, { recursive: true });
  await cp(APP_DIST, TARGET_APP, { recursive: true });
  console.log(`✓ Merged ${APP_DIST} -> ${TARGET_APP}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2 : Tester le build complet**

```bash
npm run build
```

Résultat attendu :
1. `app/dist/` créé
2. `dist/index.html` (Astro) créé
3. `dist/app/index.html` copié depuis `app/dist/`
4. Accès à `file://…/dist/app/index.html` dans un navigateur montre la SPA.

- [ ] **Step 3 : Vérifier que Hostinger peut consommer ce `dist/`**

Inspecter `dist/` : la structure doit être compatible avec un hébergement statique pur — uniquement des fichiers HTML/JS/CSS/images, pas de Node requis au runtime.

```bash
ls dist/
ls dist/app/
```

Résultat attendu : `index.html` à la racine de `dist/`, `index.html` dans `dist/app/`, assets dans les deux.

- [ ] **Step 4 : Commit**

```bash
git add scripts/merge-dist.mjs
git commit -m "build: add merge script to combine Astro and Vite SPA into single dist/"
```

---

## Task 4 : Vérifier le déploiement Hostinger hybride

**Files:** aucun (vérification opérationnelle)

- [ ] **Step 1 : Push de la branche et création d'une PR**

```bash
git push -u origin feat/seo-astro
```

- [ ] **Step 2 : Vérifier manuellement sur Hostinger la configuration du build**

Dans le panneau Hostinger → Git deploy, confirmer que :
- La commande de build est `npm install && npm run build` (ou équivalent qui exécute `npm run build` à la racine).
- Le dossier publié est `dist/`.

Si la config actuelle pointait vers l'ancien setup (build Vite seul), l'adapter manuellement. Documenter les changements effectués dans le commit message du step suivant.

- [ ] **Step 3 : Merger sur `main` via fast-forward**

Option simple (sans PR GitHub, rollback assumé) :

```bash
git checkout main
git merge --no-ff feat/seo-astro -m "feat(seo): add Astro hybrid setup for static SEO pages"
git push origin main
```

- [ ] **Step 4 : Vérifier le déploiement Hostinger**

Attendre 2-5 min. Puis :

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://terrasse-au-soleil.fr/
curl -s -o /dev/null -w "%{http_code}\n" https://terrasse-au-soleil.fr/app/
```

Résultat attendu : deux `200`.

```bash
curl -s https://terrasse-au-soleil.fr/ | grep -o "<h1>[^<]*</h1>"
```

Résultat attendu : `<h1>Terrasses au soleil</h1>`.

- [ ] **Step 5 : Tester la SPA en production**

Ouvrir `https://terrasse-au-soleil.fr/app/` dans un navigateur. Tester :
- Recherche d'une terrasse (doit appeler `europe-west1-terrassesausoleil.cloudfunctions.net/geminiSearch`)
- TTS sur un résultat
- Live assistant (connecté / déconnecté)

Si KO sur un de ces tests, investiguer et corriger avant de continuer.

---

## Task 5 : Firestore — nouvelles collections et règles

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1 : Modifier `firestore.rules`**

Remplacer le fichier entier :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /profiles/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /ads/{adId} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.email == "sflandrin@outlook.com";
    }

    // Caches d'enrichissement SEO — écriture uniquement via Admin SDK au build
    match /osmCache/{cacheId} {
      allow read: if true;
      allow write: if false;
    }
    match /sunScores/{osmId} {
      allow read: if true;
      allow write: if false;
    }
    match /pageIntros/{pageId} {
      allow read: if true;
      allow write: if false;
    }
    match /pageFaqs/{pageId} {
      allow read: if true;
      allow write: if false;
    }
    match /cityGeo/{cityQuartierId} {
      allow read: if true;
      allow write: if false;
    }

    // Default-deny catch-all
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2 : Déployer les règles**

```bash
firebase deploy --only firestore:rules
```

Résultat attendu :
```
✔  cloud.firestore: rules file firestore.rules compiled successfully
✔  firestore: released rules firestore.rules to cloud.firestore
```

- [ ] **Step 3 : Commit**

```bash
git add firestore.rules
git commit -m "feat(firestore): add rules for SEO cache collections"
```

---

## Task 6 : `src/lib/cache.ts` — wrapper Firestore avec TTL

**Files:**
- Create: `src/lib/cache.ts`
- Test: `tests/lib/cache.test.ts`

- [ ] **Step 1 : Écrire le test**

```ts
// tests/lib/cache.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCached, setCached, type CacheEntry } from '@/lib/cache';

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDoc = vi.fn(() => ({ get: mockGet, set: mockSet }));
const mockCollection = vi.fn(() => ({ doc: mockDoc }));
const mockDb = { collection: mockCollection } as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cache', () => {
  it('returns cached data when fresh', async () => {
    const now = Date.now();
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ data: { foo: 'bar' }, fetchedAt: now }),
    });
    const res = await getCached(mockDb, 'osmCache', 'lyon-vieux', 1000 * 60 * 60);
    expect(res).toEqual({ foo: 'bar' });
  });

  it('returns null when stale', async () => {
    const stale = Date.now() - 1000 * 60 * 60 * 24 * 100;
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ data: { foo: 'bar' }, fetchedAt: stale }),
    });
    const res = await getCached(mockDb, 'osmCache', 'lyon-vieux', 1000 * 60 * 60);
    expect(res).toBeNull();
  });

  it('returns null when missing', async () => {
    mockGet.mockResolvedValue({ exists: false });
    const res = await getCached(mockDb, 'osmCache', 'lyon-vieux', 1000);
    expect(res).toBeNull();
  });

  it('writes with fetchedAt timestamp', async () => {
    await setCached(mockDb, 'osmCache', 'lyon-vieux', { foo: 'bar' });
    expect(mockSet).toHaveBeenCalledTimes(1);
    const arg = mockSet.mock.calls[0][0] as CacheEntry<any>;
    expect(arg.data).toEqual({ foo: 'bar' });
    expect(typeof arg.fetchedAt).toBe('number');
    expect(arg.fetchedAt).toBeLessThanOrEqual(Date.now());
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

```bash
npm test -- tests/lib/cache.test.ts
```

Résultat attendu : FAIL, `Cannot find module '@/lib/cache'`.

- [ ] **Step 3 : Implémenter `src/lib/cache.ts`**

```ts
import type { Firestore } from 'firebase-admin/firestore';

export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

export async function getCached<T>(
  db: Firestore,
  collection: string,
  id: string,
  ttlMs: number,
): Promise<T | null> {
  const snap = await db.collection(collection).doc(id).get();
  if (!snap.exists) return null;
  const entry = snap.data() as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > ttlMs) return null;
  return entry.data;
}

export async function setCached<T>(
  db: Firestore,
  collection: string,
  id: string,
  data: T,
): Promise<void> {
  const entry: CacheEntry<T> = { data, fetchedAt: Date.now() };
  await db.collection(collection).doc(id).set(entry);
}

export const TTL = {
  OSM: 1000 * 60 * 60 * 24 * 30,        // 30 jours
  SUN_SCORE: 1000 * 60 * 60 * 24 * 90,  // 90 jours
  INTRO: 1000 * 60 * 60 * 24 * 180,     // 180 jours
  FAQ: 1000 * 60 * 60 * 24 * 180,       // 180 jours
  CITY_GEO: Number.MAX_SAFE_INTEGER,    // jamais expiré
} as const;
```

- [ ] **Step 4 : Relancer le test**

```bash
npm test -- tests/lib/cache.test.ts
```

Résultat attendu : `4 passed`.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/cache.ts tests/lib/cache.test.ts
git commit -m "feat(lib): add Firestore cache wrapper with TTL"
```

---

## Task 7 : `src/lib/urls.ts` — slugs et builders URL

**Files:**
- Create: `src/lib/urls.ts`
- Test: `tests/lib/urls.test.ts`

- [ ] **Step 1 : Écrire le test**

```ts
// tests/lib/urls.test.ts
import { describe, it, expect } from 'vitest';
import { slugify, villeUrl, quartierUrl, variationUrl, absoluteUrl } from '@/lib/urls';

describe('slugify', () => {
  it('normalizes accents and spaces', () => {
    expect(slugify('Vieux-Lyon')).toBe('vieux-lyon');
    expect(slugify('11e arrondissement')).toBe('11e-arrondissement');
    expect(slugify('Saint-Michel')).toBe('saint-michel');
    expect(slugify('Aix-en-Provence')).toBe('aix-en-provence');
    expect(slugify('Côte d\'Azur')).toBe('cote-d-azur');
  });

  it('strips non-alphanumeric', () => {
    expect(slugify('Bar & Café !!')).toBe('bar-cafe');
  });
});

describe('url builders', () => {
  it('builds ville URL', () => {
    expect(villeUrl('lyon')).toBe('/terrasses/lyon/');
  });
  it('builds quartier URL', () => {
    expect(quartierUrl('lyon', 'vieux-lyon')).toBe('/terrasses/lyon/vieux-lyon/');
  });
  it('builds variation URL', () => {
    expect(variationUrl('bar', 'lyon')).toBe('/bar-ensoleille-lyon/');
    expect(variationUrl('cafe', 'paris')).toBe('/cafe-terrasse-paris/');
    expect(variationUrl('restaurant', 'marseille')).toBe('/restaurant-terrasse-marseille/');
    expect(variationUrl('verre', 'bordeaux')).toBe('/ou-boire-un-verre-au-soleil-bordeaux/');
  });
  it('builds absolute URL with site', () => {
    expect(absoluteUrl('/terrasses/lyon/')).toBe('https://terrasse-au-soleil.fr/terrasses/lyon/');
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

```bash
npm test -- tests/lib/urls.test.ts
```

Résultat attendu : FAIL.

- [ ] **Step 3 : Implémenter `src/lib/urls.ts`**

```ts
export const SITE = 'https://terrasse-au-soleil.fr';

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function villeUrl(villeSlug: string): string {
  return `/terrasses/${villeSlug}/`;
}

export function quartierUrl(villeSlug: string, quartierSlug: string): string {
  return `/terrasses/${villeSlug}/${quartierSlug}/`;
}

export type VariationType = 'bar' | 'cafe' | 'restaurant' | 'verre';

export function variationUrl(type: VariationType, villeSlug: string): string {
  switch (type) {
    case 'bar': return `/bar-ensoleille-${villeSlug}/`;
    case 'cafe': return `/cafe-terrasse-${villeSlug}/`;
    case 'restaurant': return `/restaurant-terrasse-${villeSlug}/`;
    case 'verre': return `/ou-boire-un-verre-au-soleil-${villeSlug}/`;
  }
}

export function absoluteUrl(relative: string): string {
  return `${SITE}${relative}`;
}
```

- [ ] **Step 4 : Relancer les tests**

```bash
npm test -- tests/lib/urls.test.ts
```

Résultat attendu : tous les tests passent.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/urls.ts tests/lib/urls.test.ts
git commit -m "feat(lib): add URL builders and slugify helper"
```

---

## Task 8 : `src/data/cities.ts` — seed villes et quartiers

**Files:**
- Create: `src/data/cities.ts`

- [ ] **Step 1 : Créer `src/data/cities.ts`**

```ts
export interface Quartier {
  slug: string;
  name: string;
  searchHint: string; // label utilisé pour Nominatim (p.ex. "Croix-Rousse, Lyon")
}

export interface City {
  slug: string;
  name: string;
  region: string;
  quartiers: Quartier[];
}

export const CITIES: City[] = [
  {
    slug: 'paris',
    name: 'Paris',
    region: 'Île-de-France',
    quartiers: [
      { slug: 'marais', name: 'Marais', searchHint: 'Le Marais, Paris' },
      { slug: '11e', name: '11e arrondissement', searchHint: '11e arrondissement, Paris' },
      { slug: 'montmartre', name: 'Montmartre', searchHint: 'Montmartre, Paris' },
      { slug: 'canal-saint-martin', name: 'Canal Saint-Martin', searchHint: 'Canal Saint-Martin, Paris' },
      { slug: 'batignolles', name: 'Batignolles', searchHint: 'Batignolles, Paris' },
    ],
  },
  {
    slug: 'lyon',
    name: 'Lyon',
    region: 'Auvergne-Rhône-Alpes',
    quartiers: [
      { slug: 'vieux-lyon', name: 'Vieux-Lyon', searchHint: 'Vieux Lyon, Lyon' },
      { slug: 'croix-rousse', name: 'Croix-Rousse', searchHint: 'Croix-Rousse, Lyon' },
      { slug: 'confluence', name: 'Confluence', searchHint: 'Lyon Confluence' },
      { slug: 'part-dieu', name: 'Part-Dieu', searchHint: 'Part-Dieu, Lyon' },
    ],
  },
  {
    slug: 'marseille',
    name: 'Marseille',
    region: 'Provence-Alpes-Côte d\'Azur',
    quartiers: [
      { slug: 'vieux-port', name: 'Vieux-Port', searchHint: 'Vieux-Port, Marseille' },
      { slug: 'panier', name: 'Le Panier', searchHint: 'Le Panier, Marseille' },
      { slug: 'cours-julien', name: 'Cours Julien', searchHint: 'Cours Julien, Marseille' },
      { slug: 'joliette', name: 'Joliette', searchHint: 'Joliette, Marseille' },
    ],
  },
  {
    slug: 'bordeaux',
    name: 'Bordeaux',
    region: 'Nouvelle-Aquitaine',
    quartiers: [
      { slug: 'chartrons', name: 'Chartrons', searchHint: 'Chartrons, Bordeaux' },
      { slug: 'saint-michel', name: 'Saint-Michel', searchHint: 'Saint-Michel, Bordeaux' },
      { slug: 'saint-pierre', name: 'Saint-Pierre', searchHint: 'Saint-Pierre, Bordeaux' },
    ],
  },
  {
    slug: 'toulouse',
    name: 'Toulouse',
    region: 'Occitanie',
    quartiers: [
      { slug: 'capitole', name: 'Capitole', searchHint: 'Capitole, Toulouse' },
      { slug: 'carmes', name: 'Carmes', searchHint: 'Carmes, Toulouse' },
      { slug: 'saint-cyprien', name: 'Saint-Cyprien', searchHint: 'Saint-Cyprien, Toulouse' },
    ],
  },
  { slug: 'nice', name: 'Nice', region: 'Provence-Alpes-Côte d\'Azur', quartiers: [] },
  { slug: 'nantes', name: 'Nantes', region: 'Pays de la Loire', quartiers: [] },
  { slug: 'strasbourg', name: 'Strasbourg', region: 'Grand Est', quartiers: [] },
  { slug: 'lille', name: 'Lille', region: 'Hauts-de-France', quartiers: [] },
  { slug: 'montpellier', name: 'Montpellier', region: 'Occitanie', quartiers: [] },
  { slug: 'rennes', name: 'Rennes', region: 'Bretagne', quartiers: [] },
  { slug: 'annecy', name: 'Annecy', region: 'Auvergne-Rhône-Alpes', quartiers: [] },
  { slug: 'aix-en-provence', name: 'Aix-en-Provence', region: 'Provence-Alpes-Côte d\'Azur', quartiers: [] },
  { slug: 'biarritz', name: 'Biarritz', region: 'Nouvelle-Aquitaine', quartiers: [] },
  { slug: 'la-rochelle', name: 'La Rochelle', region: 'Nouvelle-Aquitaine', quartiers: [] },
];

export function findCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

export function findQuartier(citySlug: string, quartierSlug: string): Quartier | undefined {
  return findCity(citySlug)?.quartiers.find((q) => q.slug === quartierSlug);
}

export function allCities(): City[] {
  return CITIES;
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/data/cities.ts
git commit -m "feat(data): seed 15 cities with quartiers for SEO pages"
```

---

## Task 9 : `src/lib/nominatim.ts` — client geocoding

**Files:**
- Create: `src/lib/nominatim.ts`
- Test: `tests/lib/nominatim.test.ts`

- [ ] **Step 1 : Écrire le test**

```ts
// tests/lib/nominatim.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geocode, type BBox } from '@/lib/nominatim';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('nominatim.geocode', () => {
  it('returns bbox from first result', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          boundingbox: ['45.76', '45.78', '4.82', '4.85'],
          display_name: 'Croix-Rousse, Lyon',
        },
      ],
    });
    vi.stubGlobal('fetch', mockFetch);

    const bbox = await geocode('Croix-Rousse, Lyon');
    expect(bbox).toEqual<BBox>({ south: 45.76, north: 45.78, west: 4.82, east: 4.85 });
    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('nominatim.openstreetmap.org');
    expect(url).toContain(encodeURIComponent('Croix-Rousse, Lyon'));
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(geocode('x')).rejects.toThrow(/Nominatim HTTP 503/);
  });

  it('throws when no result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    await expect(geocode('nowhere')).rejects.toThrow(/No Nominatim result/);
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

```bash
npm test -- tests/lib/nominatim.test.ts
```

Résultat attendu : FAIL.

- [ ] **Step 3 : Implémenter `src/lib/nominatim.ts`**

```ts
export interface BBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

const USER_AGENT = 'terrasse-au-soleil.fr/1.0 (contact: sflandrin@outlook.com)';

export async function geocode(query: string): Promise<BBox> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ boundingbox: [string, string, string, string] }>;
  if (!data.length) throw new Error(`No Nominatim result for "${query}"`);
  const [south, north, west, east] = data[0].boundingbox.map(Number);
  return { south, north, west, east };
}

export async function geocodeThrottled(query: string): Promise<BBox> {
  const res = await geocode(query);
  await new Promise((r) => setTimeout(r, 1100)); // 1 req/s Nominatim policy
  return res;
}
```

- [ ] **Step 4 : Relancer les tests**

```bash
npm test -- tests/lib/nominatim.test.ts
```

Résultat attendu : tous les tests passent.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/nominatim.ts tests/lib/nominatim.test.ts
git commit -m "feat(lib): add Nominatim geocoding client"
```

---

## Task 10 : `src/lib/overpass.ts` — client Overpass

**Files:**
- Create: `src/lib/overpass.ts`
- Test: `tests/lib/overpass.test.ts`

- [ ] **Step 1 : Écrire le test**

```ts
// tests/lib/overpass.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchEstablishments, type Establishment } from '@/lib/overpass';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('overpass.fetchEstablishments', () => {
  it('parses nodes and ways into Establishment[]', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 1,
            lat: 45.77,
            lon: 4.83,
            tags: { name: 'Le Petit Bar', amenity: 'bar', 'addr:street': 'rue X', 'outdoor_seating': 'yes' },
          },
          {
            type: 'way',
            id: 2,
            center: { lat: 45.771, lon: 4.831 },
            tags: { name: 'Café Soleil', amenity: 'cafe', 'outdoor_seating': 'yes' },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const list = await fetchEstablishments({ south: 45, north: 46, west: 4, east: 5 });
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject<Partial<Establishment>>({
      osmId: 'node/1',
      name: 'Le Petit Bar',
      type: 'bar',
      lat: 45.77,
      lng: 4.83,
    });
    expect(list[1].osmId).toBe('way/2');
    expect(list[1].type).toBe('cafe');
  });

  it('skips elements without name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          { type: 'node', id: 3, lat: 1, lon: 2, tags: { amenity: 'bar' } }, // no name
        ],
      }),
    }));
    const list = await fetchEstablishments({ south: 0, north: 1, west: 0, east: 1 });
    expect(list).toHaveLength(0);
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

```bash
npm test -- tests/lib/overpass.test.ts
```

Résultat attendu : FAIL.

- [ ] **Step 3 : Implémenter `src/lib/overpass.ts`**

```ts
import type { BBox } from './nominatim';

export type EstablishmentType = 'bar' | 'cafe' | 'restaurant';

export interface Establishment {
  osmId: string;
  name: string;
  type: EstablishmentType;
  lat: number;
  lng: number;
  address: string | null;
  website: string | null;
  outdoorSeating: boolean;
}

const ENDPOINT = 'https://overpass-api.de/api/interpreter';

function buildQuery(bbox: BBox): string {
  const { south, west, north, east } = bbox;
  return `
[out:json][timeout:25];
(
  node["amenity"~"^(cafe|bar|restaurant)$"](${south},${west},${north},${east});
  way["amenity"~"^(cafe|bar|restaurant)$"](${south},${west},${north},${east});
);
out center tags;
`;
}

interface RawElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function coordsOf(el: RawElement): { lat: number; lng: number } | null {
  if (el.type === 'node' && el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  if (el.type === 'way' && el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function addressOf(tags: Record<string, string>): string | null {
  const street = tags['addr:street'];
  const housenumber = tags['addr:housenumber'];
  const city = tags['addr:city'];
  if (!street) return null;
  return [housenumber, street, city].filter(Boolean).join(' ');
}

export async function fetchEstablishments(bbox: BBox): Promise<Establishment[]> {
  const query = buildQuery(bbox);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = (await res.json()) as { elements: RawElement[] };
  const list: Establishment[] = [];
  for (const el of json.elements) {
    const tags = el.tags ?? {};
    const name = tags.name;
    if (!name) continue;
    const coords = coordsOf(el);
    if (!coords) continue;
    const amenity = tags.amenity;
    if (amenity !== 'cafe' && amenity !== 'bar' && amenity !== 'restaurant') continue;
    list.push({
      osmId: `${el.type}/${el.id}`,
      name,
      type: amenity,
      lat: coords.lat,
      lng: coords.lng,
      address: addressOf(tags),
      website: tags.website ?? tags['contact:website'] ?? null,
      outdoorSeating: tags.outdoor_seating === 'yes',
    });
  }
  return list;
}
```

- [ ] **Step 4 : Relancer les tests**

```bash
npm test -- tests/lib/overpass.test.ts
```

Résultat attendu : tous les tests passent.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/overpass.ts tests/lib/overpass.test.ts
git commit -m "feat(lib): add Overpass API client for establishments"
```

---

## Task 11 : `src/lib/gemini.ts` — wrappers Gemini au build

**Files:**
- Create: `src/lib/gemini.ts`
- Test: `tests/lib/gemini.test.ts`

Gemini est appelé au build avec la clé en variable d'env `GEMINI_BUILD_KEY` (fournie localement et via le secret CI pour la GitHub Action — voir Task 22). Jamais dans le bundle client.

- [ ] **Step 1 : Écrire le test**

```ts
// tests/lib/gemini.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreSunExposure, generateIntro, generateFaq } from '@/lib/gemini';
import type { Establishment } from '@/lib/overpass';

const mockGenerate = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerate },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_BUILD_KEY = 'test-key';
});

const makeEst = (i: number): Establishment => ({
  osmId: `node/${i}`,
  name: `Bar ${i}`,
  type: 'bar',
  lat: 45,
  lng: 4,
  address: 'rue X',
  website: null,
  outdoorSeating: true,
});

describe('scoreSunExposure', () => {
  it('returns scores from Gemini JSON response', async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify([
        { osmId: 'node/1', sunPercent: 80, orientation: 'S', analysis: 'Ensoleillée toute l\'après-midi.' },
        { osmId: 'node/2', sunPercent: 30, orientation: 'N', analysis: 'Ombragée.' },
      ]),
    });
    const res = await scoreSunExposure([makeEst(1), makeEst(2)]);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ osmId: 'node/1', sunPercent: 80 });
    expect(res[1]).toMatchObject({ osmId: 'node/2', sunPercent: 30 });
  });
});

describe('generateIntro', () => {
  it('returns intro text', async () => {
    mockGenerate.mockResolvedValue({ text: 'Croix-Rousse est un quartier perché...' });
    const intro = await generateIntro({
      ville: 'Lyon',
      quartier: 'Croix-Rousse',
      lat: 45.77,
      lng: 4.83,
    });
    expect(intro).toContain('Croix-Rousse');
    expect(intro.length).toBeGreaterThan(50);
  });
});

describe('generateFaq', () => {
  it('returns array of Q/A', async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify([
        { question: 'Où aller le dimanche ?', answer: 'Essayez...' },
      ]),
    });
    const faq = await generateFaq({ ville: 'Lyon', quartier: 'Croix-Rousse' });
    expect(faq).toHaveLength(1);
    expect(faq[0]).toMatchObject({ question: 'Où aller le dimanche ?' });
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

```bash
npm test -- tests/lib/gemini.test.ts
```

Résultat attendu : FAIL.

- [ ] **Step 3 : Installer `@google/genai`**

```bash
npm install @google/genai@^1.34.0
```

- [ ] **Step 4 : Implémenter `src/lib/gemini.ts`**

```ts
import { GoogleGenAI } from '@google/genai';
import type { Establishment } from './overpass';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_BUILD_KEY;
  if (!apiKey) throw new Error('GEMINI_BUILD_KEY env var missing at build time.');
  return new GoogleGenAI({ apiKey });
}

export interface SunScore {
  osmId: string;
  sunPercent: number;
  orientation: string;
  analysis: string;
}

export async function scoreSunExposure(batch: Establishment[]): Promise<SunScore[]> {
  if (batch.length === 0) return [];
  const ai = getClient();
  const list = batch
    .map((e) => `- osmId: ${e.osmId}, nom: ${e.name}, adresse: ${e.address ?? 'inconnue'}, coord: ${e.lat},${e.lng}`)
    .join('\n');
  const prompt = `Pour chacun des établissements ci-dessous, estime le pourcentage d'ensoleillement de la terrasse à 17h un jour d'été (mai à août), l'orientation probable, et une analyse en 1-2 phrases. Base-toi sur l'orientation probable de la rue et l'exposition solaire à cette heure à cette latitude.

${list}

Réponds EXCLUSIVEMENT avec un tableau JSON, un objet par établissement, dans le même ordre, au format :
[{"osmId":"...","sunPercent":80,"orientation":"S","analysis":"..."}, ...]`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });
  const text = response.text ?? '[]';
  const match = text.match(/\[[\s\S]*\]/);
  return match ? (JSON.parse(match[0]) as SunScore[]) : [];
}

export interface IntroInput {
  ville: string;
  quartier: string | null;
  lat: number;
  lng: number;
}

export async function generateIntro(input: IntroInput): Promise<string> {
  const ai = getClient();
  const target = input.quartier ? `le quartier ${input.quartier} à ${input.ville}` : `la ville de ${input.ville}`;
  const prompt = `Rédige une introduction de 150 à 200 mots pour une page web intitulée "Terrasses ensoleillées à ${input.quartier ?? input.ville}". Cible : ${target}, coordonnées ${input.lat},${input.lng}. Évoque l'ambiance du quartier, l'orientation typique des rues, les heures de la journée où le soleil est le mieux. Ton chaleureux, factuel, sans superlatifs creux. Pas d'introduction méta ("Voici un texte..."), pas de conclusion qui commence par "En somme". Démarre directement dans le sujet.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });
  return (response.text ?? '').trim();
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface FaqInput {
  ville: string;
  quartier: string | null;
}

export async function generateFaq(input: FaqInput): Promise<FaqEntry[]> {
  const ai = getClient();
  const target = input.quartier ? `${input.quartier}, ${input.ville}` : input.ville;
  const prompt = `Rédige 4 questions-réponses fréquentes sur les terrasses ensoleillées à ${target}. Questions concrètes qu'un visiteur se poserait (meilleurs créneaux, ouvertures dimanche, bons plans apéro, etc.). Réponses en 1-2 phrases, pratiques.

Réponds EXCLUSIVEMENT avec un tableau JSON au format :
[{"question":"...","answer":"..."}, ...]`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });
  const text = response.text ?? '[]';
  const match = text.match(/\[[\s\S]*\]/);
  return match ? (JSON.parse(match[0]) as FaqEntry[]) : [];
}
```

- [ ] **Step 5 : Relancer les tests**

```bash
npm test -- tests/lib/gemini.test.ts
```

Résultat attendu : tous les tests passent.

- [ ] **Step 6 : Commit**

```bash
git add package.json package-lock.json src/lib/gemini.ts tests/lib/gemini.test.ts
git commit -m "feat(lib): add Gemini wrappers for sun scoring, intros, FAQ"
```

---

## Task 12 : `src/lib/jsonld.ts` — helpers schema.org

**Files:**
- Create: `src/lib/jsonld.ts`
- Test: `tests/lib/jsonld.test.ts`

- [ ] **Step 1 : Écrire le test**

```ts
// tests/lib/jsonld.test.ts
import { describe, it, expect } from 'vitest';
import { breadcrumbList, itemList, faqPage, webPage } from '@/lib/jsonld';

describe('breadcrumbList', () => {
  it('builds breadcrumb JSON-LD', () => {
    const ld = breadcrumbList([
      { name: 'Accueil', url: 'https://terrasse-au-soleil.fr/' },
      { name: 'Terrasses', url: 'https://terrasse-au-soleil.fr/terrasses/' },
      { name: 'Lyon', url: 'https://terrasse-au-soleil.fr/terrasses/lyon/' },
    ]);
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement).toHaveLength(3);
    expect(ld.itemListElement[0]).toMatchObject({
      '@type': 'ListItem',
      position: 1,
      name: 'Accueil',
    });
  });
});

describe('itemList', () => {
  it('builds ItemList of LocalBusiness', () => {
    const ld = itemList([
      { name: 'Le Bar', type: 'bar', address: '1 rue X', lat: 45, lng: 4 },
      { name: 'Café Soleil', type: 'cafe', address: null, lat: 45.1, lng: 4.1 },
    ]);
    expect(ld['@type']).toBe('ItemList');
    expect(ld.itemListElement).toHaveLength(2);
    expect(ld.itemListElement[0].item['@type']).toBe('BarOrPub');
    expect(ld.itemListElement[1].item['@type']).toBe('CafeOrCoffeeShop');
  });
});

describe('faqPage', () => {
  it('builds FAQPage', () => {
    const ld = faqPage([
      { question: 'Q1 ?', answer: 'R1.' },
      { question: 'Q2 ?', answer: 'R2.' },
    ]);
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity).toHaveLength(2);
    expect(ld.mainEntity[0]).toMatchObject({
      '@type': 'Question',
      name: 'Q1 ?',
      acceptedAnswer: { '@type': 'Answer', text: 'R1.' },
    });
  });
});

describe('webPage', () => {
  it('builds WebPage with about', () => {
    const ld = webPage({
      name: 'Terrasses Lyon',
      description: 'desc',
      url: 'https://terrasse-au-soleil.fr/terrasses/lyon/',
      aboutPlaceName: 'Lyon',
    });
    expect(ld['@type']).toBe('WebPage');
    expect(ld.about).toMatchObject({ '@type': 'Place', name: 'Lyon' });
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

```bash
npm test -- tests/lib/jsonld.test.ts
```

Résultat attendu : FAIL.

- [ ] **Step 3 : Implémenter `src/lib/jsonld.ts`**

```ts
export interface BreadcrumbItem { name: string; url: string }

export function breadcrumbList(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export interface ListEstablishment {
  name: string;
  type: 'bar' | 'cafe' | 'restaurant';
  address: string | null;
  lat: number;
  lng: number;
}

const TYPE_MAP = {
  bar: 'BarOrPub',
  cafe: 'CafeOrCoffeeShop',
  restaurant: 'Restaurant',
} as const;

export function itemList(items: ListEstablishment[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': TYPE_MAP[e.type],
        name: e.name,
        ...(e.address ? { address: e.address } : {}),
        geo: { '@type': 'GeoCoordinates', latitude: e.lat, longitude: e.lng },
      },
    })),
  };
}

export interface FaqPair { question: string; answer: string }

export function faqPage(pairs: FaqPair[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map((p) => ({
      '@type': 'Question',
      name: p.question,
      acceptedAnswer: { '@type': 'Answer', text: p.answer },
    })),
  };
}

export interface WebPageInput {
  name: string;
  description: string;
  url: string;
  aboutPlaceName?: string;
}

export function webPage(input: WebPageInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.name,
    description: input.description,
    url: input.url,
    ...(input.aboutPlaceName ? { about: { '@type': 'Place', name: input.aboutPlaceName } } : {}),
  };
}
```

- [ ] **Step 4 : Relancer les tests**

```bash
npm test -- tests/lib/jsonld.test.ts
```

Résultat attendu : tous les tests passent.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/jsonld.ts tests/lib/jsonld.test.ts
git commit -m "feat(lib): add schema.org JSON-LD helpers"
```

---

## Task 13 : Orchestrateur de données au build — `src/lib/buildData.ts`

**Files:**
- Create: `src/lib/buildData.ts`
- Create: `src/lib/firebase.ts` (init Firestore Admin au build)

- [ ] **Step 1 : Créer `src/lib/firebase.ts`**

```ts
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let cachedDb: Firestore | null = null;

export function getDb(): Firestore {
  if (cachedDb) return cachedDb;
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing at build time.');
    const creds = JSON.parse(raw);
    initializeApp({ credential: cert(creds) });
  }
  cachedDb = getFirestore();
  return cachedDb;
}
```

- [ ] **Step 2 : Créer `src/lib/buildData.ts`**

```ts
import { getDb } from './firebase';
import { getCached, setCached, TTL } from './cache';
import { geocodeThrottled } from './nominatim';
import { fetchEstablishments, type Establishment } from './overpass';
import { scoreSunExposure, generateIntro, generateFaq, type SunScore, type FaqEntry } from './gemini';
import type { BBox } from './nominatim';
import type { City, Quartier } from '../data/cities';

export interface PageData {
  bbox: BBox;
  establishments: (Establishment & { sun: SunScore | null })[];
  intro: string;
  faq: FaqEntry[];
}

async function getOrFetchBBox(city: City, quartier: Quartier | null): Promise<BBox> {
  const db = getDb();
  const id = quartier ? `${city.slug}-${quartier.slug}` : city.slug;
  const cached = await getCached<BBox>(db, 'cityGeo', id, TTL.CITY_GEO);
  if (cached) return cached;
  const query = quartier ? quartier.searchHint : city.name;
  const bbox = await geocodeThrottled(query);
  await setCached(db, 'cityGeo', id, bbox);
  return bbox;
}

async function getOrFetchEstablishments(pageId: string, bbox: BBox): Promise<Establishment[]> {
  const db = getDb();
  const cached = await getCached<Establishment[]>(db, 'osmCache', pageId, TTL.OSM);
  if (cached) return cached;
  const list = await fetchEstablishments(bbox);
  await setCached(db, 'osmCache', pageId, list);
  return list;
}

async function getOrComputeSunScore(est: Establishment, batchFallback: Map<string, SunScore>): Promise<SunScore | null> {
  const db = getDb();
  const cached = await getCached<SunScore>(db, 'sunScores', encodeURIComponent(est.osmId), TTL.SUN_SCORE);
  if (cached) return cached;
  const fromBatch = batchFallback.get(est.osmId);
  if (fromBatch) {
    await setCached(db, 'sunScores', encodeURIComponent(est.osmId), fromBatch);
    return fromBatch;
  }
  return null;
}

async function getOrGenerateIntro(pageId: string, city: City, quartier: Quartier | null, bbox: BBox): Promise<string> {
  const db = getDb();
  const cached = await getCached<string>(db, 'pageIntros', pageId, TTL.INTRO);
  if (cached) return cached;
  const centerLat = (bbox.north + bbox.south) / 2;
  const centerLng = (bbox.east + bbox.west) / 2;
  const intro = await generateIntro({
    ville: city.name,
    quartier: quartier?.name ?? null,
    lat: centerLat,
    lng: centerLng,
  });
  await setCached(db, 'pageIntros', pageId, intro);
  return intro;
}

async function getOrGenerateFaq(pageId: string, city: City, quartier: Quartier | null): Promise<FaqEntry[]> {
  const db = getDb();
  const cached = await getCached<FaqEntry[]>(db, 'pageFaqs', pageId, TTL.FAQ);
  if (cached) return cached;
  const faq = await generateFaq({ ville: city.name, quartier: quartier?.name ?? null });
  await setCached(db, 'pageFaqs', pageId, faq);
  return faq;
}

export async function buildPageData(city: City, quartier: Quartier | null): Promise<PageData> {
  const pageId = quartier ? `${city.slug}-${quartier.slug}` : city.slug;
  const bbox = await getOrFetchBBox(city, quartier);
  const all = await getOrFetchEstablishments(pageId, bbox);

  // Filtrer : on garde ceux avec outdoorSeating=yes d'abord, sinon on garde tous
  const withSeating = all.filter((e) => e.outdoorSeating);
  const pool = withSeating.length >= 10 ? withSeating : all;
  const top = pool.slice(0, 15);

  // Sun scores : batch Gemini pour les manquants
  const missing: Establishment[] = [];
  const batchFallback = new Map<string, SunScore>();
  const db = getDb();
  for (const e of top) {
    const cached = await getCached<SunScore>(db, 'sunScores', encodeURIComponent(e.osmId), TTL.SUN_SCORE);
    if (!cached) missing.push(e);
  }
  if (missing.length > 0) {
    const scores = await scoreSunExposure(missing);
    for (const s of scores) batchFallback.set(s.osmId, s);
  }

  const enriched = await Promise.all(
    top.map(async (e) => ({ ...e, sun: await getOrComputeSunScore(e, batchFallback) })),
  );

  const intro = await getOrGenerateIntro(pageId, city, quartier, bbox);
  const faq = await getOrGenerateFaq(pageId, city, quartier);

  return { bbox, establishments: enriched, intro, faq };
}
```

- [ ] **Step 3 : Installer `firebase-admin` si absent**

```bash
npm install firebase-admin@^13.0.0
```

(Déjà dans le package.json de Task 2 — cette étape est juste une vérif.)

- [ ] **Step 4 : Compiler (pas de tests unitaires ici — testé en intégration via les pages)**

```bash
npx astro check
```

Résultat attendu : pas d'erreur TypeScript.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/firebase.ts src/lib/buildData.ts package.json package-lock.json
git commit -m "feat(lib): add build-time data orchestrator"
```

---

## Task 14 : Composants partagés

**Files:**
- Create: `src/components/Layout.astro`
- Create: `src/components/Breadcrumb.astro`
- Create: `src/components/TerraceCard.astro`
- Create: `src/components/AdSlot.astro`
- Create: `src/components/RelatedAreas.astro`
- Create: `src/components/FaqList.astro`
- Create: `src/components/MiniMap.tsx` (React island)
- Create: `src/styles/global.css`

- [ ] **Step 1 : Créer `src/styles/global.css`**

```css
:root {
  --color-sun: #f5a623;
  --color-text: #222;
  --color-muted: #666;
  --color-bg: #fffaf2;
  --color-card: #fff;
  --color-border: #e6d9c1;
  --max-width: 960px;
  --radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--color-bg); color: var(--color-text); line-height: 1.6; }
a { color: var(--color-sun); text-decoration: none; }
a:hover { text-decoration: underline; }

.container { max-width: var(--max-width); margin: 0 auto; padding: 1.5rem 1rem; }

h1 { font-size: 2rem; margin: 1rem 0 1.5rem; }
h2 { font-size: 1.35rem; margin: 1.5rem 0 0.5rem; }

.header { background: #fff; border-bottom: 1px solid var(--color-border); }
.header-inner { display: flex; align-items: center; justify-content: space-between; }

.breadcrumb { font-size: 0.9rem; color: var(--color-muted); margin-bottom: 1rem; }
.breadcrumb a { color: var(--color-muted); }
.breadcrumb .sep { margin: 0 0.4rem; }

.card { background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 1rem; margin-bottom: 0.8rem; }
.card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
.card-meta { font-size: 0.9rem; color: var(--color-muted); }

.sun-badge { background: var(--color-sun); color: #fff; padding: 0.2rem 0.5rem; border-radius: var(--radius); font-weight: bold; font-size: 0.9rem; }

.ad-slot { margin: 1.5rem 0; padding: 0.5rem; border: 1px dashed var(--color-border); text-align: center; min-height: 90px; color: var(--color-muted); font-size: 0.8rem; }

.related-areas { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1.5rem 0; }
.related-areas a { background: var(--color-card); border: 1px solid var(--color-border); padding: 0.4rem 0.8rem; border-radius: var(--radius); }

.faq-item { margin-bottom: 1rem; }
.faq-item summary { font-weight: bold; cursor: pointer; }
.faq-item p { margin: 0.5rem 0 0; }

.cta { display: inline-block; background: var(--color-sun); color: #fff; padding: 0.75rem 1.25rem; border-radius: var(--radius); font-weight: bold; margin: 1.5rem 0; }
.cta:hover { text-decoration: none; opacity: 0.9; }

.mini-map { height: 320px; margin: 1.5rem 0; border-radius: var(--radius); overflow: hidden; }
```

- [ ] **Step 2 : Créer `src/components/Layout.astro`**

```astro
---
import '@/styles/global.css';
export interface Props {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  jsonld?: object[];
}
const { title, description, canonical, ogImage = '/og-default.jpg', jsonld = [] } = Astro.props;
const siteOgImage = new URL(ogImage, Astro.site).toString();
---
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <link rel="alternate" hreflang="fr" href={canonical} />

    <meta property="og:type" content="website" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content={siteOgImage} />
    <meta property="og:locale" content="fr_FR" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={siteOgImage} />

    {jsonld.map((ld) => (
      <script type="application/ld+json" set:html={JSON.stringify(ld)} />
    ))}
  </head>
  <body>
    <header class="header">
      <div class="container header-inner">
        <a href="/"><strong>🌞 Terrasses au soleil</strong></a>
        <nav><a href="/app/">Recherche live</a></nav>
      </div>
    </header>
    <main class="container">
      <slot />
    </main>
    <footer class="container" style="color: var(--color-muted); font-size: 0.85rem;">
      <p>Terrasses-au-soleil.fr — données OpenStreetMap © contributeurs. Analyses solaires assistées par IA.</p>
    </footer>
  </body>
</html>
```

- [ ] **Step 3 : Créer `src/components/Breadcrumb.astro`**

```astro
---
export interface Crumb { name: string; url: string }
export interface Props { items: Crumb[] }
const { items } = Astro.props;
---
<nav class="breadcrumb" aria-label="Fil d'Ariane">
  {items.map((it, i) => (
    <>
      {i > 0 && <span class="sep">›</span>}
      {i < items.length - 1 ? <a href={it.url}>{it.name}</a> : <span>{it.name}</span>}
    </>
  ))}
</nav>
```

- [ ] **Step 4 : Créer `src/components/TerraceCard.astro`**

```astro
---
import type { Establishment } from '@/lib/overpass';
import type { SunScore } from '@/lib/gemini';
export interface Props {
  est: Establishment & { sun: SunScore | null };
  position: number;
}
const { est, position } = Astro.props;
const typeLabel = { bar: 'Bar', cafe: 'Café', restaurant: 'Restaurant' }[est.type];
const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${est.lat},${est.lng}`;
---
<article class="card" itemscope>
  <div class="card-head">
    <div>
      <h2 itemprop="name"><span style="color: var(--color-muted); font-weight: normal;">{position}.</span> {est.name}</h2>
      <div class="card-meta">
        {typeLabel}
        {est.address && <> · {est.address}</>}
      </div>
    </div>
    {est.sun && (
      <span class="sun-badge" aria-label={`Ensoleillement ${est.sun.sunPercent}%`}>
        ☀️ {est.sun.sunPercent}%
      </span>
    )}
  </div>
  {est.sun?.analysis && <p>{est.sun.analysis}</p>}
  <p>
    <a href={mapsUrl} target="_blank" rel="noopener">Voir sur Google Maps</a>
    {est.website && <> · <a href={est.website} target="_blank" rel="noopener">Site web</a></>}
  </p>
</article>
```

- [ ] **Step 5 : Créer `src/components/AdSlot.astro`**

```astro
---
export interface Props {
  slotId: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
}
const { slotId, format = 'auto' } = Astro.props;
const client = import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '';
const enabled = Boolean(client);
---
{enabled ? (
  <div class="ad-slot">
    <ins class="adsbygoogle"
         style="display:block"
         data-ad-client={client}
         data-ad-slot={slotId}
         data-ad-format={format}
         data-full-width-responsive="true"></ins>
    <script is:inline>
      (adsbygoogle = window.adsbygoogle || []).push({});
    </script>
  </div>
) : (
  <div class="ad-slot" aria-hidden="true">emplacement publicitaire (inactif)</div>
)}
```

Ajouter dans `src/components/Layout.astro`, dans `<head>`, juste avant la fermeture, un chargement conditionnel du script AdSense :

```astro
{import.meta.env.PUBLIC_ADSENSE_CLIENT && (
  <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${import.meta.env.PUBLIC_ADSENSE_CLIENT}`} crossorigin="anonymous"></script>
)}
```

- [ ] **Step 6 : Créer `src/components/RelatedAreas.astro`**

```astro
---
import { villeUrl, quartierUrl } from '@/lib/urls';
export interface RelatedArea { ville: string; quartier?: string; villeSlug: string; quartierSlug?: string }
export interface Props { items: RelatedArea[]; title?: string }
const { items, title = 'Autres quartiers' } = Astro.props;
---
{items.length > 0 && (
  <section>
    <h2>{title}</h2>
    <nav class="related-areas" aria-label={title}>
      {items.map((it) => (
        <a href={it.quartierSlug ? quartierUrl(it.villeSlug, it.quartierSlug) : villeUrl(it.villeSlug)}>
          {it.quartier ?? it.ville}
        </a>
      ))}
    </nav>
  </section>
)}
```

- [ ] **Step 7 : Créer `src/components/FaqList.astro`**

```astro
---
import type { FaqEntry } from '@/lib/gemini';
export interface Props { items: FaqEntry[] }
const { items } = Astro.props;
---
{items.length > 0 && (
  <section>
    <h2>Questions fréquentes</h2>
    {items.map((f) => (
      <details class="faq-item">
        <summary>{f.question}</summary>
        <p>{f.answer}</p>
      </details>
    ))}
  </section>
)}
```

- [ ] **Step 8 : Créer `src/components/MiniMap.tsx` (React island)**

```tsx
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix icons pour SSR
const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export interface MapMarker { name: string; lat: number; lng: number }
export interface Props { markers: MapMarker[]; center: [number, number]; zoom?: number }

export default function MiniMap({ markers, center, zoom = 14 }: Props) {
  return (
    <MapContainer center={center} zoom={zoom} className="mini-map" style={{ height: 320, width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m) => (
        <Marker key={`${m.lat}-${m.lng}`} position={[m.lat, m.lng]} icon={icon}>
          <Popup>{m.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 9 : Commit**

```bash
git add src/components/ src/styles/
git commit -m "feat(components): add shared Astro components and React MiniMap island"
```

---

## Task 15 : Page `/terrasses/[ville]/[quartier]`

**Files:**
- Create: `src/pages/terrasses/[ville]/[quartier].astro`

- [ ] **Step 1 : Créer la page**

```astro
---
import Layout from '@/components/Layout.astro';
import Breadcrumb from '@/components/Breadcrumb.astro';
import TerraceCard from '@/components/TerraceCard.astro';
import AdSlot from '@/components/AdSlot.astro';
import RelatedAreas from '@/components/RelatedAreas.astro';
import FaqList from '@/components/FaqList.astro';
import MiniMap from '@/components/MiniMap.tsx';
import { CITIES, findCity, findQuartier } from '@/data/cities';
import { buildPageData } from '@/lib/buildData';
import { absoluteUrl, quartierUrl, villeUrl, SITE } from '@/lib/urls';
import { breadcrumbList, itemList, webPage, faqPage } from '@/lib/jsonld';

export async function getStaticPaths() {
  const paths: { params: { ville: string; quartier: string } }[] = [];
  for (const c of CITIES) {
    for (const q of c.quartiers) {
      paths.push({ params: { ville: c.slug, quartier: q.slug } });
    }
  }
  return paths;
}

const { ville, quartier } = Astro.params;
const city = findCity(ville!);
const q = findQuartier(ville!, quartier!);
if (!city || !q) throw new Error(`Unknown ${ville}/${quartier}`);

const data = await buildPageData(city, q);

const pageTitle = `Terrasses ensoleillées ${q.name} ${city.name} — Terrasses au soleil`;
const pageDesc = `Les meilleures terrasses au soleil à ${q.name}, ${city.name}. ${data.establishments.length} adresses avec analyse d'ensoleillement.`;
const canonical = absoluteUrl(quartierUrl(city.slug, q.slug));

const crumbs = [
  { name: 'Accueil', url: SITE + '/' },
  { name: 'Terrasses', url: SITE + '/terrasses/' },
  { name: city.name, url: absoluteUrl(villeUrl(city.slug)) },
  { name: q.name, url: canonical },
];

const jsonld = [
  breadcrumbList(crumbs),
  webPage({ name: pageTitle, description: pageDesc, url: canonical, aboutPlaceName: `${q.name}, ${city.name}` }),
  itemList(data.establishments.map((e) => ({ name: e.name, type: e.type, address: e.address, lat: e.lat, lng: e.lng }))),
  faqPage(data.faq),
];

const relatedQuartiers = city.quartiers
  .filter((x) => x.slug !== q.slug)
  .slice(0, 5)
  .map((x) => ({ ville: city.name, quartier: x.name, villeSlug: city.slug, quartierSlug: x.slug }));

const center: [number, number] = [
  (data.bbox.north + data.bbox.south) / 2,
  (data.bbox.east + data.bbox.west) / 2,
];
const markers = data.establishments.map((e) => ({ name: e.name, lat: e.lat, lng: e.lng }));
---
<Layout title={pageTitle} description={pageDesc} canonical={canonical} jsonld={jsonld}>
  <Breadcrumb items={crumbs.map(({ name, url }) => ({ name, url }))} />
  <h1>Terrasses ensoleillées à {q.name}, {city.name}</h1>
  <p>{data.intro}</p>

  <AdSlot slotId="1111111111" format="horizontal" />

  <section>
    <h2>Top {data.establishments.length} terrasses au soleil</h2>
    {data.establishments.slice(0, 3).map((e, i) => <TerraceCard est={e} position={i + 1} />)}

    <AdSlot slotId="2222222222" format="rectangle" />

    {data.establishments.slice(3, 10).map((e, i) => <TerraceCard est={e} position={i + 4} />)}

    <AdSlot slotId="3333333333" format="rectangle" />

    {data.establishments.slice(10).map((e, i) => <TerraceCard est={e} position={i + 11} />)}
  </section>

  <MiniMap client:visible markers={markers} center={center} />

  <RelatedAreas items={relatedQuartiers} title={`Autres quartiers de ${city.name}`} />

  <a class="cta" href={`/app/?city=${encodeURIComponent(city.name)}&area=${encodeURIComponent(q.name)}`}>
    Affiner en temps réel →
  </a>

  <FaqList items={data.faq} />
</Layout>
```

- [ ] **Step 2 : Tester le build (ne fera pas appel à Firestore si `FIREBASE_SERVICE_ACCOUNT` manque → doit échouer proprement)**

```bash
npm run build:astro
```

Résultat attendu : échec avec `FIREBASE_SERVICE_ACCOUNT env var missing`. C'est normal, on fournira les credentials au prochain step.

- [ ] **Step 3 : Configurer les credentials Firebase Admin pour le build local**

Télécharger un service account depuis Firebase Console → Project settings → Service accounts → Generate new private key.
Stocker le JSON dans `C:/Users/<user>/terrasses-sa.json` (hors repo).

Ajouter à `app/.env.local` **non commité** OU mieux, exporter dans le shell :

```bash
export FIREBASE_SERVICE_ACCOUNT="$(cat /c/Users/<user>/terrasses-sa.json)"
export GEMINI_BUILD_KEY="votre_cle_gemini_ici"
```

(Ces exports ne durent que dans le shell courant.)

- [ ] **Step 4 : Relancer le build**

```bash
npm run build:astro
```

Résultat attendu : build OK, `dist/terrasses/lyon/vieux-lyon/index.html` existe et contient `<h1>Terrasses ensoleillées à Vieux-Lyon, Lyon</h1>`.

- [ ] **Step 5 : Vérifier visuellement la page**

```bash
npm run preview
```

Ouvrir `http://localhost:4321/terrasses/lyon/vieux-lyon/`. Vérifier la présence des cartes, la carte Leaflet, la FAQ, les liens "autres quartiers".

- [ ] **Step 6 : Commit**

```bash
git add src/pages/terrasses/
git commit -m "feat(pages): add /terrasses/[ville]/[quartier] template"
```

---

## Task 16 : Page `/terrasses/[ville]/`

**Files:**
- Create: `src/pages/terrasses/[ville]/index.astro`

- [ ] **Step 1 : Créer la page**

```astro
---
import Layout from '@/components/Layout.astro';
import Breadcrumb from '@/components/Breadcrumb.astro';
import TerraceCard from '@/components/TerraceCard.astro';
import AdSlot from '@/components/AdSlot.astro';
import RelatedAreas from '@/components/RelatedAreas.astro';
import FaqList from '@/components/FaqList.astro';
import MiniMap from '@/components/MiniMap.tsx';
import { CITIES, findCity } from '@/data/cities';
import { buildPageData } from '@/lib/buildData';
import { absoluteUrl, villeUrl, quartierUrl, SITE } from '@/lib/urls';
import { breadcrumbList, itemList, webPage, faqPage } from '@/lib/jsonld';

export async function getStaticPaths() {
  return CITIES.map((c) => ({ params: { ville: c.slug } }));
}

const { ville } = Astro.params;
const city = findCity(ville!);
if (!city) throw new Error(`Unknown ville ${ville}`);

const data = await buildPageData(city, null);

const pageTitle = `Terrasses ensoleillées à ${city.name} — Terrasses au soleil`;
const pageDesc = `Les meilleures terrasses au soleil à ${city.name}. ${data.establishments.length} adresses avec analyse d'ensoleillement.`;
const canonical = absoluteUrl(villeUrl(city.slug));

const crumbs = [
  { name: 'Accueil', url: SITE + '/' },
  { name: 'Terrasses', url: SITE + '/terrasses/' },
  { name: city.name, url: canonical },
];

const jsonld = [
  breadcrumbList(crumbs),
  webPage({ name: pageTitle, description: pageDesc, url: canonical, aboutPlaceName: city.name }),
  itemList(data.establishments.map((e) => ({ name: e.name, type: e.type, address: e.address, lat: e.lat, lng: e.lng }))),
  faqPage(data.faq),
];

const relatedQuartiers = city.quartiers.slice(0, 5).map((x) => ({
  ville: city.name, quartier: x.name, villeSlug: city.slug, quartierSlug: x.slug,
}));

const center: [number, number] = [
  (data.bbox.north + data.bbox.south) / 2,
  (data.bbox.east + data.bbox.west) / 2,
];
const markers = data.establishments.map((e) => ({ name: e.name, lat: e.lat, lng: e.lng }));
---
<Layout title={pageTitle} description={pageDesc} canonical={canonical} jsonld={jsonld}>
  <Breadcrumb items={crumbs.map(({ name, url }) => ({ name, url }))} />
  <h1>Terrasses ensoleillées à {city.name}</h1>
  <p>{data.intro}</p>

  <AdSlot slotId="1111111111" format="horizontal" />

  <section>
    <h2>Top {data.establishments.length} terrasses au soleil</h2>
    {data.establishments.slice(0, 3).map((e, i) => <TerraceCard est={e} position={i + 1} />)}
    <AdSlot slotId="2222222222" format="rectangle" />
    {data.establishments.slice(3, 10).map((e, i) => <TerraceCard est={e} position={i + 4} />)}
    <AdSlot slotId="3333333333" format="rectangle" />
    {data.establishments.slice(10).map((e, i) => <TerraceCard est={e} position={i + 11} />)}
  </section>

  <MiniMap client:visible markers={markers} center={center} zoom={12} />

  {relatedQuartiers.length > 0 && <RelatedAreas items={relatedQuartiers} title={`Quartiers de ${city.name}`} />}

  <a class="cta" href={`/app/?city=${encodeURIComponent(city.name)}`}>
    Affiner en temps réel →
  </a>

  <FaqList items={data.faq} />
</Layout>
```

- [ ] **Step 2 : Builder et vérifier**

```bash
npm run build:astro
```

Résultat attendu : `dist/terrasses/paris/index.html`, `dist/terrasses/lyon/index.html`, etc. générés.

- [ ] **Step 3 : Commit**

```bash
git add src/pages/terrasses/[ville]/index.astro
git commit -m "feat(pages): add /terrasses/[ville] template"
```

---

## Task 17 : Pages variations lexicales

**Files:**
- Create: `src/pages/bar-ensoleille-[ville].astro`
- Create: `src/pages/cafe-terrasse-[ville].astro`
- Create: `src/pages/restaurant-terrasse-[ville].astro`
- Create: `src/pages/ou-boire-un-verre-au-soleil-[ville].astro`

Ces pages réutilisent la logique de la page ville, mais avec un filtre par type et un H1 différent. Pour éviter la duplication, on crée un composant template partagé.

- [ ] **Step 1 : Créer le template partagé `src/components/CityVariationPage.astro`**

```astro
---
import Layout from '@/components/Layout.astro';
import Breadcrumb from '@/components/Breadcrumb.astro';
import TerraceCard from '@/components/TerraceCard.astro';
import AdSlot from '@/components/AdSlot.astro';
import FaqList from '@/components/FaqList.astro';
import type { City } from '@/data/cities';
import { buildPageData } from '@/lib/buildData';
import { absoluteUrl, variationUrl, villeUrl, SITE, type VariationType } from '@/lib/urls';
import { breadcrumbList, itemList, webPage, faqPage } from '@/lib/jsonld';
import type { Establishment } from '@/lib/overpass';

export interface Props {
  city: City;
  variation: VariationType;
  title: string;
  h1: string;
  filter: (e: Establishment) => boolean;
}

const { city, variation, title, h1, filter } = Astro.props;
const data = await buildPageData(city, null);
const filtered = data.establishments.filter(filter);

const pageTitle = `${title} — Terrasses au soleil`;
const pageDesc = `${h1}. ${filtered.length} adresses sélectionnées avec analyse d'ensoleillement.`;
const canonical = absoluteUrl(variationUrl(variation, city.slug));

const crumbs = [
  { name: 'Accueil', url: SITE + '/' },
  { name: city.name, url: absoluteUrl(villeUrl(city.slug)) },
  { name: title, url: canonical },
];

const jsonld = [
  breadcrumbList(crumbs),
  webPage({ name: pageTitle, description: pageDesc, url: canonical, aboutPlaceName: city.name }),
  itemList(filtered.map((e) => ({ name: e.name, type: e.type, address: e.address, lat: e.lat, lng: e.lng }))),
  faqPage(data.faq),
];
---
<Layout title={pageTitle} description={pageDesc} canonical={canonical} jsonld={jsonld}>
  <Breadcrumb items={crumbs.map(({ name, url }) => ({ name, url }))} />
  <h1>{h1}</h1>
  <p>{data.intro}</p>

  <AdSlot slotId="1111111111" format="horizontal" />

  <section>
    <h2>{filtered.length} adresses à {city.name}</h2>
    {filtered.slice(0, 3).map((e, i) => <TerraceCard est={e} position={i + 1} />)}
    <AdSlot slotId="2222222222" format="rectangle" />
    {filtered.slice(3, 10).map((e, i) => <TerraceCard est={e} position={i + 4} />)}
    <AdSlot slotId="3333333333" format="rectangle" />
    {filtered.slice(10).map((e, i) => <TerraceCard est={e} position={i + 11} />)}
  </section>

  <p><a href={villeUrl(city.slug)}>← Toutes les terrasses à {city.name}</a></p>

  <a class="cta" href={`/app/?city=${encodeURIComponent(city.name)}`}>
    Affiner en temps réel →
  </a>

  <FaqList items={data.faq} />
</Layout>
```

- [ ] **Step 2 : Créer `src/pages/bar-ensoleille-[ville].astro`**

```astro
---
import CityVariationPage from '@/components/CityVariationPage.astro';
import { CITIES, findCity } from '@/data/cities';

export async function getStaticPaths() {
  return CITIES.map((c) => ({ params: { ville: c.slug } }));
}

const { ville } = Astro.params;
const city = findCity(ville!);
if (!city) throw new Error(`Unknown ville ${ville}`);
---
<CityVariationPage
  city={city}
  variation="bar"
  title={`Bars ensoleillés à ${city.name}`}
  h1={`Les meilleurs bars ensoleillés à ${city.name}`}
  filter={(e) => e.type === 'bar'}
/>
```

- [ ] **Step 3 : Créer `src/pages/cafe-terrasse-[ville].astro`**

```astro
---
import CityVariationPage from '@/components/CityVariationPage.astro';
import { CITIES, findCity } from '@/data/cities';

export async function getStaticPaths() {
  return CITIES.map((c) => ({ params: { ville: c.slug } }));
}

const { ville } = Astro.params;
const city = findCity(ville!);
if (!city) throw new Error(`Unknown ville ${ville}`);
---
<CityVariationPage
  city={city}
  variation="cafe"
  title={`Cafés avec terrasse à ${city.name}`}
  h1={`Cafés avec terrasse ensoleillée à ${city.name}`}
  filter={(e) => e.type === 'cafe'}
/>
```

- [ ] **Step 4 : Créer `src/pages/restaurant-terrasse-[ville].astro`**

```astro
---
import CityVariationPage from '@/components/CityVariationPage.astro';
import { CITIES, findCity } from '@/data/cities';

export async function getStaticPaths() {
  return CITIES.map((c) => ({ params: { ville: c.slug } }));
}

const { ville } = Astro.params;
const city = findCity(ville!);
if (!city) throw new Error(`Unknown ville ${ville}`);
---
<CityVariationPage
  city={city}
  variation="restaurant"
  title={`Restaurants avec terrasse à ${city.name}`}
  h1={`Restaurants avec terrasse ensoleillée à ${city.name}`}
  filter={(e) => e.type === 'restaurant'}
/>
```

- [ ] **Step 5 : Créer `src/pages/ou-boire-un-verre-au-soleil-[ville].astro`**

```astro
---
import CityVariationPage from '@/components/CityVariationPage.astro';
import { CITIES, findCity } from '@/data/cities';

export async function getStaticPaths() {
  return CITIES.map((c) => ({ params: { ville: c.slug } }));
}

const { ville } = Astro.params;
const city = findCity(ville!);
if (!city) throw new Error(`Unknown ville ${ville}`);
---
<CityVariationPage
  city={city}
  variation="verre"
  title={`Où boire un verre au soleil à ${city.name}`}
  h1={`Où boire un verre au soleil à ${city.name}`}
  filter={(e) => e.type === 'bar' || e.type === 'cafe'}
/>
```

- [ ] **Step 6 : Builder**

```bash
npm run build:astro
```

Résultat attendu : `dist/bar-ensoleille-paris/index.html`, `dist/cafe-terrasse-lyon/index.html`, etc. générés pour chaque ville.

- [ ] **Step 7 : Commit**

```bash
git add src/pages/ src/components/CityVariationPage.astro
git commit -m "feat(pages): add lexical variations (bar/cafe/restaurant/verre) per ville"
```

---

## Task 18 : Landing `/`

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1 : Remplacer `src/pages/index.astro`**

```astro
---
import Layout from '@/components/Layout.astro';
import { CITIES } from '@/data/cities';
import { villeUrl, SITE, absoluteUrl } from '@/lib/urls';
import { webPage } from '@/lib/jsonld';

const pageTitle = 'Terrasses au soleil — trouvez la meilleure terrasse ensoleillée en France';
const pageDesc = 'Trouvez les terrasses ensoleillées près de chez vous. Analyse d\'exposition au soleil, carte, et recherche en temps réel assistée par IA.';
const canonical = absoluteUrl('/');

const jsonld = [webPage({ name: pageTitle, description: pageDesc, url: canonical })];
---
<Layout title={pageTitle} description={pageDesc} canonical={canonical} jsonld={jsonld}>
  <h1>Trouvez la terrasse parfaite, au soleil</h1>
  <p>
    Terrasses au soleil recense les meilleurs bars, cafés et restaurants avec
    terrasse ensoleillée dans les grandes villes françaises. Chaque adresse
    est accompagnée d'une analyse de son exposition au soleil pour vous
    permettre de choisir la bonne terrasse au bon moment.
  </p>

  <a class="cta" href="/app/">Lancer la recherche en temps réel →</a>

  <section>
    <h2>Explorer par ville</h2>
    <nav class="related-areas" aria-label="Villes">
      {CITIES.map((c) => (
        <a href={villeUrl(c.slug)}>{c.name}</a>
      ))}
    </nav>
  </section>

  <section>
    <h2>Comment ça marche</h2>
    <p>
      Chaque adresse est géolocalisée à partir d'OpenStreetMap. L'orientation
      probable de la terrasse et son exposition au soleil à 17h en été sont
      calculées par une analyse IA prenant en compte les rues avoisinantes et
      l'angle solaire à cette latitude. Le score d'ensoleillement indique la
      part de la terrasse qui sera exposée au soleil à cette heure-là.
    </p>
  </section>
</Layout>
```

- [ ] **Step 2 : Commit**

```bash
git add src/pages/index.astro
git commit -m "feat(pages): add proper landing page with city directory"
```

---

## Task 19 : Sitemap et robots

**Files:**
- Modify: `astro.config.mjs` (déjà configuré pour sitemap, ajuster)
- Verify: `public/robots.txt` (créé en Task 2)

- [ ] **Step 1 : Vérifier la config sitemap dans `astro.config.mjs`**

Modifier pour filtrer `/app/` :

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://terrasse-au-soleil.fr',
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes('/app/'),
      changefreq: 'monthly',
      priority: 0.7,
    }),
    mdx(),
  ],
  output: 'static',
  build: { format: 'directory' },
  vite: { ssr: { noExternal: ['react-leaflet'] } },
});
```

- [ ] **Step 2 : Builder et vérifier le sitemap**

```bash
npm run build:astro
ls dist/sitemap-*.xml
```

Résultat attendu : `dist/sitemap-index.xml` et `dist/sitemap-0.xml` existent.

```bash
cat dist/sitemap-0.xml | grep -c "<url>"
```

Résultat attendu : ≥ 15 villes × 4 variations + 15 pages ville + quartiers = minimum 80 URLs.

- [ ] **Step 3 : Commit**

```bash
git add astro.config.mjs
git commit -m "feat(seo): configure sitemap to exclude /app and set priorities"
```

---

## Task 20 : Premier déploiement complet

**Files:** aucun (vérification opérationnelle)

- [ ] **Step 1 : Builder localement en conditions réelles**

```bash
export FIREBASE_SERVICE_ACCOUNT="$(cat /c/Users/<user>/terrasses-sa.json)"
export GEMINI_BUILD_KEY="votre_cle_gemini_ici"
npm run build
```

Résultat attendu : build complet sans erreur, `dist/` contient :
- `index.html` (landing)
- `terrasses/<ville>/index.html` × 15
- `terrasses/<ville>/<quartier>/index.html` × ~18
- `bar-ensoleille-<ville>/index.html` × 15
- `cafe-terrasse-<ville>/index.html` × 15
- `restaurant-terrasse-<ville>/index.html` × 15
- `ou-boire-un-verre-au-soleil-<ville>/index.html` × 15
- `app/index.html` + assets SPA
- `sitemap-index.xml`, `sitemap-0.xml`
- `robots.txt`

Total : ~95 pages statiques + SPA. (La V1 "~200 pages" du spec sera atteinte en ajoutant des quartiers dans `cities.ts` en Task 22.)

- [ ] **Step 2 : Ajouter les secrets à GitHub Actions (pour le build en CI si Hostinger déclenche via Actions)**

Si Hostinger buildé via GitHub Actions : dans le repo GitHub → Settings → Secrets and variables → Actions → ajouter :
- `FIREBASE_SERVICE_ACCOUNT` = contenu du JSON de service account
- `GEMINI_BUILD_KEY` = clé Gemini

Si Hostinger buildé directement sur leur infra : ajouter ces deux variables dans le panneau Hostinger → Env variables.

- [ ] **Step 3 : Merger la branche sur `main`**

```bash
git checkout main
git pull
git merge --no-ff feat/seo-astro -m "feat(seo): add hybrid Astro SEO pages for Terrasses au soleil"
git push origin main
```

- [ ] **Step 4 : Vérifier le déploiement Hostinger**

Attendre 5-10 min. Puis :

```bash
curl -s -o /dev/null -w "%{http_code} / %{url_effective}\n" https://terrasse-au-soleil.fr/
curl -s -o /dev/null -w "%{http_code} / %{url_effective}\n" https://terrasse-au-soleil.fr/terrasses/lyon/
curl -s -o /dev/null -w "%{http_code} / %{url_effective}\n" https://terrasse-au-soleil.fr/terrasses/lyon/vieux-lyon/
curl -s -o /dev/null -w "%{http_code} / %{url_effective}\n" https://terrasse-au-soleil.fr/app/
curl -s -o /dev/null -w "%{http_code} / %{url_effective}\n" https://terrasse-au-soleil.fr/sitemap-index.xml
```

Résultat attendu : cinq `200`.

- [ ] **Step 5 : Tester la SPA une dernière fois**

Ouvrir `https://terrasse-au-soleil.fr/app/`. Tester la recherche live, le TTS, le live assistant.

---

## Task 21 : Soumission aux moteurs et vérifications SEO

**Files:** aucun (action manuelle)

- [ ] **Step 1 : Soumettre le sitemap à Google Search Console**

1. Aller sur `https://search.google.com/search-console`.
2. Ajouter la propriété `terrasse-au-soleil.fr` si pas déjà fait.
3. Sitemaps → Ajouter un sitemap → `sitemap-index.xml`.

- [ ] **Step 2 : Soumettre à Bing Webmaster Tools**

1. Aller sur `https://www.bing.com/webmasters`.
2. Ajouter le site.
3. Sitemaps → Ajouter → `https://terrasse-au-soleil.fr/sitemap-index.xml`.

- [ ] **Step 3 : Valider une page avec Rich Results Test**

Aller sur `https://search.google.com/test/rich-results`. Tester :
- `https://terrasse-au-soleil.fr/terrasses/lyon/`
- `https://terrasse-au-soleil.fr/terrasses/lyon/vieux-lyon/`
- `https://terrasse-au-soleil.fr/bar-ensoleille-paris/`

Résultat attendu : BreadcrumbList, ItemList, FAQPage détectés sans erreur.

- [ ] **Step 4 : Lighthouse SEO**

Sur Chrome DevTools → Lighthouse → run pour :
- `/`
- `/terrasses/lyon/`
- `/terrasses/lyon/vieux-lyon/`
- `/bar-ensoleille-paris/`
- `/ou-boire-un-verre-au-soleil-toulouse/`

Résultat attendu : SEO ≥ 95 pour chaque page. Si une page est < 95, lire les recommandations et corriger.

- [ ] **Step 5 : Mettre à jour HANDOFF.md**

```bash
# Éditer HANDOFF.md pour refléter que les pages SEO Astro sont en prod
git add HANDOFF.md
git commit -m "docs(handoff): SEO Astro pages deployed and submitted to search engines"
git push
```

---

## Task 22 : GitHub Action de rebuild mensuel

**Files:**
- Create: `.github/workflows/monthly-rebuild.yml`

- [ ] **Step 1 : Créer le workflow**

```yaml
name: Monthly rebuild (refresh SEO data)

on:
  schedule:
    - cron: '0 3 1 * *'  # 1er du mois à 03:00 UTC
  workflow_dispatch:

jobs:
  trigger-rebuild:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
      - name: Empty commit to trigger Hostinger build
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git commit --allow-empty -m "chore: monthly SEO rebuild"
          git push origin main
```

Ce workflow ne fait que pousser un commit vide pour déclencher le rebuild automatique Hostinger. Le refresh des caches Firestore se fait automatiquement côté build (les TTL expirent).

- [ ] **Step 2 : Commit**

```bash
git add .github/workflows/monthly-rebuild.yml
git commit -m "ci: add monthly SEO rebuild workflow"
git push
```

- [ ] **Step 3 : Tester en déclenchement manuel**

Aller sur GitHub → Actions → "Monthly rebuild" → Run workflow → Run. Vérifier que le commit est créé et que Hostinger redéploie.

---

## Task 23 : Étendre le scope à 200 pages

**Files:**
- Modify: `src/data/cities.ts`

Après avoir validé (quelques jours) que Google commence à indexer les ~95 pages de la V1 initiale, élargir le scope en ajoutant des quartiers aux villes secondaires.

- [ ] **Step 1 : Ajouter 3-5 quartiers aux 10 villes secondaires dans `src/data/cities.ts`**

Exemple pour Nice :

```ts
{
  slug: 'nice',
  name: 'Nice',
  region: 'Provence-Alpes-Côte d\'Azur',
  quartiers: [
    { slug: 'vieux-nice', name: 'Vieux Nice', searchHint: 'Vieux-Nice, Nice' },
    { slug: 'promenade-des-anglais', name: 'Promenade des Anglais', searchHint: 'Promenade des Anglais, Nice' },
    { slug: 'port', name: 'Port', searchHint: 'Port de Nice' },
  ],
},
```

Étendre de même pour Nantes, Strasbourg, Lille, Montpellier, Rennes, Annecy, Aix-en-Provence, Biarritz, La Rochelle.

Ajouter aussi 2-3 quartiers supplémentaires aux 5 grandes villes (Paris : ajouter Saint-Germain, Bastille, etc.).

Objectif : ~60-80 quartiers au total → avec les 4 variations × 15 villes, ça donne 15 + 80 + 60 = ~155 pages. Proche du palier "200 pages" ciblé pour la V1 étendue.

- [ ] **Step 2 : Builder et vérifier**

```bash
npm run build
```

Résultat attendu : nombre de pages dans `dist/` augmenté conformément au seed.

- [ ] **Step 3 : Commit et deploy**

```bash
git add src/data/cities.ts
git commit -m "feat(seo): extend city coverage to ~150 pages"
git push origin main
```

- [ ] **Step 4 : Re-soumettre le sitemap mis à jour à Google Search Console**

Search Console → Sitemaps → re-valider `sitemap-index.xml`.

---

## Checklist finale

- [ ] SPA déplacée dans `app/`, build produit `app/dist/`
- [ ] Astro initialisé à la racine, build produit `dist/`
- [ ] Script `merge-dist` assemble les deux dans un `dist/` unique
- [ ] Firestore : 5 nouvelles collections avec rules read-only côté client
- [ ] `src/lib/` contient : cache, nominatim, overpass, gemini, jsonld, urls, firebase, buildData
- [ ] Tests Vitest passent sur les libs (`npm test` vert)
- [ ] Pages `/terrasses/[ville]/`, `/terrasses/[ville]/[quartier]/`, les 4 variations lexicales
- [ ] Landing `/` avec directory de villes
- [ ] Composants : Layout, Breadcrumb, TerraceCard, AdSlot, RelatedAreas, FaqList, MiniMap
- [ ] JSON-LD : BreadcrumbList + ItemList + WebPage + FAQPage sur chaque page
- [ ] OpenGraph + Twitter Cards sur chaque page
- [ ] sitemap.xml généré, `/app/` exclu, soumis à Google et Bing
- [ ] `robots.txt` autorise tout sauf `/app/`
- [ ] Build complet en < 15 min localement
- [ ] Déploiement Hostinger vert, SPA toujours fonctionnelle sur `/app/`
- [ ] Lighthouse SEO ≥ 95 sur 5 pages échantillon
- [ ] Rich Results Test OK sur 3 pages
- [ ] GitHub Action de rebuild mensuel en place
- [ ] HANDOFF.md à jour
