# Sécurisation Gemini API & Firebase — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retirer la clé Gemini du bundle client, durcir les règles Firestore sur la collection `ads`, et déplacer l'email admin en variable d'environnement.

**Architecture:** Trois Cloud Functions Firebase (`onCall`, région `europe-west1`) remplacent les appels directs au SDK Gemini depuis le frontend. La clé API est stockée comme secret Firebase et ne quitte jamais le serveur, sauf pour `geminiLiveToken` qui la transmet uniquement à un utilisateur authentifié.

**Tech Stack:** Firebase Functions v2 (Node 20, TypeScript), `@google/genai` côté serveur, `firebase/functions` (`httpsCallable`) côté client.

---

## Structure des fichiers

**Créés :**
- `firebase.json` — config Firebase CLI (functions + firestore)
- `.firebaserc` — association projet Firebase
- `firestore.rules` — règles de sécurité Firestore
- `firestore.indexes.json` — indexes Firestore (vide)
- `functions/package.json`
- `functions/tsconfig.json`
- `functions/index.ts` — exports des 3 fonctions
- `functions/src/geminiSearch.ts` — proxy findTerraces
- `functions/src/geminiTts.ts` — proxy speakDescription
- `functions/src/geminiLiveToken.ts` — échange de token pour live assistant

**Modifiés :**
- `services/geminiService.ts` — remplace SDK par `httpsCallable`
- `services/dbService.ts` — ADMIN_EMAIL depuis env var
- `vite.config.ts` — supprime injection de la clé API
- `.env.local` — créé localement, jamais commité

---

## Task 1 : P2 — Email admin en variable d'environnement

**Files:**
- Modify: `services/dbService.ts`
- Create: `.env.local` (non commité)

- [ ] **Step 1 : Vérifier que `.env.local` est dans `.gitignore`**

```bash
grep -i "env.local" .gitignore
```

Si aucun résultat, ajouter la ligne :
```
.env.local
```

- [ ] **Step 2 : Créer `.env.local`**

Créer le fichier `.env.local` à la racine du projet :
```
VITE_ADMIN_EMAIL=sflandrin@outlook.com
```

- [ ] **Step 3 : Modifier `dbService.ts`**

Remplacer la ligne 37 :
```ts
// Avant
const ADMIN_EMAIL = 'sflandrin@outlook.com';

// Après
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? '';
```

- [ ] **Step 4 : Tester localement**

```bash
npm run dev
```

Ouvrir http://localhost:3000, se connecter avec le compte admin, vérifier que l'onglet "Régie Pubs" apparaît toujours dans le profil.

- [ ] **Step 5 : Commit**

```bash
git add services/dbService.ts .gitignore
git commit -m "feat(security): move admin email to env variable"
```

---

## Task 2 : P1 — Règles Firestore

**Files:**
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `firebase.json`
- Create: `.firebaserc`

- [ ] **Step 1 : Créer `firebase.json`**

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true }
  }
}
```

- [ ] **Step 2 : Créer `.firebaserc`**

```json
{
  "projects": {
    "default": "terrassesausoleil"
  }
}
```

- [ ] **Step 3 : Créer `firestore.indexes.json`**

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

- [ ] **Step 4 : Créer `firestore.rules`**

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
  }
}
```

- [ ] **Step 5 : Déployer les règles**

```bash
firebase deploy --only firestore:rules
```

Résultat attendu :
```
✔  firestore: released rules firestore.rules to cloud.firestore
```

- [ ] **Step 6 : Vérifier dans la console Firebase**

Ouvrir Firebase Console → Firestore → Rules → vérifier que les règles sont bien actives.

- [ ] **Step 7 : Commit**

```bash
git add firebase.json .firebaserc firestore.rules firestore.indexes.json
git commit -m "feat(security): add Firestore security rules for ads collection"
```

---

## Task 3 : Initialisation du projet Firebase Functions

**Files:**
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/index.ts`
- Create: `functions/src/` (dossier)

- [ ] **Step 1 : Créer `functions/package.json`**

```json
{
  "name": "terrasses-au-soleil-functions",
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "firebase deploy --only functions"
  },
  "engines": { "node": "20" },
  "main": "lib/index.js",
  "dependencies": {
    "@google/genai": "1.34.0",
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "typescript": "~5.8.2"
  },
  "private": true
}
```

- [ ] **Step 2 : Créer `functions/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2017",
    "skipLibCheck": true
  },
  "compileOnSave": true,
  "include": ["src", "index.ts"]
}
```

- [ ] **Step 3 : Créer `functions/index.ts`** (vide — les exports sont ajoutés aux tasks 4, 5, 6)

```ts
// Cloud Functions — exports ajoutés au fur et à mesure
```

- [ ] **Step 4 : Installer les dépendances**

```bash
cd functions && npm install
```

Résultat attendu : `added N packages` sans erreur.

- [ ] **Step 5 : Ajouter `functions/lib/` et `functions/node_modules/` au `.gitignore`**

Ajouter ces lignes dans `.gitignore` à la racine :
```
functions/lib/
functions/node_modules/
```

- [ ] **Step 6 : Commit**

```bash
cd ..
git add functions/package.json functions/tsconfig.json functions/index.ts .gitignore
git commit -m "feat(functions): initialize Firebase Functions TypeScript project"
```

---

## Task 4 : Cloud Function `geminiSearch`

**Files:**
- Create: `functions/src/geminiSearch.ts`

- [ ] **Step 1 : Créer `functions/src/geminiSearch.ts`**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI } from '@google/genai';

export const geminiSearch = onCall(
  { region: 'europe-west1', secrets: ['GEMINI_API_KEY'] },
  async (request) => {
    const { location, type, date, time, lat, lng } = request.data as {
      location: string;
      type: string;
      date: string;
      time: string;
      lat?: number;
      lng?: number;
    };

    if (!location || !type || !date || !time) {
      throw new HttpsError('invalid-argument', 'Paramètres manquants : location, type, date, time requis.');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpsError('internal', 'Clé API non configurée.');
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Recherche des terrasses à "${location}" pour le ${date} vers ${time}. 
    Type d'établissement: ${type}.
    Analyse l'ensoleillement (pourcentage de 0 à 100%) selon l'orientation de la rue et l'heure.
    Réponds EXCLUSIVEMENT sous forme de tableau JSON: 
    [{"name": "Nom", "address": "Adresse complète", "type": "bar|restaurant|cafe", "sunExposure": 80, "description": "Analyse du soleil", "rating": 4.5, "lat": 48.8, "lng": 2.3}]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text = response.text || '[]';
    const jsonMatch = text.match(/\[\s*\{.*\}\s*\]/s);
    const results: any[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    const groundingChunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || []) as any[];
    const sources = groundingChunks
      .map((chunk: any) => (chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null))
      .filter(Boolean);

    return { results, sources };
  }
);
```

- [ ] **Step 2 : Ajouter l'export dans `functions/index.ts`**

Remplacer le contenu de `functions/index.ts` :
```ts
export { geminiSearch } from './src/geminiSearch';
```

- [ ] **Step 3 : Compiler**

```bash
cd functions && npm run build
```

Résultat attendu : aucune erreur TypeScript, dossier `lib/` créé.

- [ ] **Step 4 : Commit**

```bash
cd ..
git add functions/src/geminiSearch.ts functions/index.ts
git commit -m "feat(functions): add geminiSearch Cloud Function"
```

---

## Task 5 : Cloud Function `geminiTts`

**Files:**
- Create: `functions/src/geminiTts.ts`

- [ ] **Step 1 : Créer `functions/src/geminiTts.ts`**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI, Modality } from '@google/genai';

export const geminiTts = onCall(
  { region: 'europe-west1', secrets: ['GEMINI_API_KEY'] },
  async (request) => {
    const { text } = request.data as { text: string };

    if (!text) {
      throw new HttpsError('invalid-argument', 'Paramètre text manquant.');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpsError('internal', 'Clé API non configurée.');
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: `Dis de manière chaleureuse: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });

    const audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;
    return { audio };
  }
);
```

- [ ] **Step 2 : Ajouter l'export dans `functions/index.ts`**

```ts
export { geminiSearch } from './src/geminiSearch';
export { geminiTts } from './src/geminiTts';
```

- [ ] **Step 3 : Compiler**

```bash
cd functions && npm run build
```

Résultat attendu : aucune erreur TypeScript.

- [ ] **Step 4 : Commit**

```bash
cd ..
git add functions/src/geminiTts.ts functions/index.ts
git commit -m "feat(functions): add geminiTts Cloud Function"
```

---

## Task 6 : Cloud Function `geminiLiveToken`

**Files:**
- Create: `functions/src/geminiLiveToken.ts`

- [ ] **Step 1 : Créer `functions/src/geminiLiveToken.ts`**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const geminiLiveToken = onCall(
  { region: 'europe-west1', secrets: ['GEMINI_API_KEY'] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        "Connexion requise pour accéder à l'assistant vocal."
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpsError('internal', 'Clé API non configurée.');
    }

    return { apiKey };
  }
);
```

- [ ] **Step 2 : Ajouter l'export dans `functions/index.ts`**

```ts
export { geminiSearch } from './src/geminiSearch';
export { geminiTts } from './src/geminiTts';
export { geminiLiveToken } from './src/geminiLiveToken';
```

- [ ] **Step 3 : Compiler**

```bash
cd functions && npm run build
```

Résultat attendu : aucune erreur TypeScript.

- [ ] **Step 4 : Commit**

```bash
cd ..
git add functions/src/geminiLiveToken.ts functions/index.ts
git commit -m "feat(functions): add geminiLiveToken Cloud Function"
```

---

## Task 7 : Mise à jour du GeminiService frontend

**Files:**
- Modify: `services/geminiService.ts`

- [ ] **Step 1 : Remplacer entièrement `services/geminiService.ts`**

```ts
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { GoogleGenAI, Modality } from '@google/genai';
import { EstablishmentType, SunLevel, Terrace } from '../types';

const REGION = 'europe-west1';

export class GeminiService {
  private fns() {
    return getFunctions(getApp(), REGION);
  }

  async findTerraces(
    location: string,
    type: EstablishmentType,
    date: string,
    time: string,
    lat?: number,
    lng?: number
  ): Promise<Terrace[]> {
    const searchFn = httpsCallable(this.fns(), 'geminiSearch');
    const result = await searchFn({ location, type, date, time, lat, lng });
    const { results, sources } = result.data as { results: any[]; sources: any[] };

    return results.map((r: any, i: number) => ({
      id: `${i}-${Date.now()}`,
      name: r.name,
      address: r.address,
      type: (r.type || type) as EstablishmentType,
      sunExposure: r.sunExposure || 0,
      sunLevel: r.sunExposure > 65 ? SunLevel.FULL : r.sunExposure > 25 ? SunLevel.PARTIAL : SunLevel.SHADED,
      description: r.description || "Analyse d'ensoleillement par IA.",
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(r.name)}/400/300`,
      rating: r.rating || 4.0,
      coordinates: { lat: r.lat || 48.8566, lng: r.lng || 2.3522 },
      sources: sources.length > 0 ? sources : undefined,
    }));
  }

  async speakDescription(text: string) {
    try {
      const ttsFn = httpsCallable(this.fns(), 'geminiTts');
      const result = await ttsFn({ text });
      const { audio } = result.data as { audio: string | null };
      if (audio) this.playRawAudio(audio);
    } catch (e: any) {
      console.error('TTS Error:', e?.message);
    }
  }

  async connectLiveAssistant(callbacks: any) {
    const tokenFn = httpsCallable(this.fns(), 'geminiLiveToken');
    const result = await tokenFn({});
    const { apiKey } = result.data as { apiKey: string };

    const ai = new GoogleGenAI({ apiKey });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction:
          "Tu es un expert en terrasses. Aide l'utilisateur à trouver le soleil. Réponds en français.",
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
      },
    });
  }

  private async playRawAudio(base64: string) {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (e) {
      console.error('Erreur lecture audio');
    }
  }
}

export const gemini = new GeminiService();
```

- [ ] **Step 2 : Vérifier que TypeScript compile**

```bash
npm run build
```

Résultat attendu : build réussi, aucune erreur.

- [ ] **Step 3 : Tester en dev (avant déploiement des functions)**

```bash
npm run dev
```

À ce stade, les appels Gemini échoueront car les Cloud Functions ne sont pas encore déployées — c'est attendu. Vérifier uniquement que le frontend charge sans erreur de compilation.

- [ ] **Step 4 : Commit**

```bash
git add services/geminiService.ts
git commit -m "feat(frontend): replace Gemini SDK with Cloud Function calls"
```

---

## Task 8 : Nettoyage de `vite.config.ts` et vérification du bundle

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1 : Remplacer `vite.config.ts`**

```ts
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
});
```

- [ ] **Step 2 : Builder le frontend**

```bash
npm run build
```

Résultat attendu : build réussi dans `dist/`.

- [ ] **Step 3 : Vérifier l'absence de la clé dans le bundle**

```bash
grep -r "AIza" dist/
```

Résultat attendu : **aucun résultat** (la clé ne figure plus dans le bundle).

- [ ] **Step 4 : Vérifier l'absence de `process.env.API_KEY` dans le bundle**

```bash
grep -r "GEMINI_API_KEY" dist/
```

Résultat attendu : **aucun résultat**.

- [ ] **Step 5 : Commit**

```bash
git add vite.config.ts
git commit -m "feat(security): remove Gemini API key from client bundle"
```

---

## Task 9 : Déploiement Firebase et tests de production

- [ ] **Step 1 : Enregistrer la clé Gemini comme secret Firebase**

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

Entrer la clé Gemini quand demandé. Résultat attendu :
```
✔  Created a new secret version projects/terrassesausoleil/secrets/GEMINI_API_KEY/versions/1
```

- [ ] **Step 2 : Déployer les Cloud Functions**

```bash
firebase deploy --only functions
```

Résultat attendu :
```
✔  functions[geminiSearch(europe-west1)]: Successful create operation.
✔  functions[geminiTts(europe-west1)]: Successful create operation.
✔  functions[geminiLiveToken(europe-west1)]: Successful create operation.
```

- [ ] **Step 3 : Tester `geminiSearch` en dev**

```bash
npm run dev
```

Effectuer une recherche de terrasse dans l'app. Vérifier dans l'onglet Réseau du navigateur que la requête va vers `europe-west1-terrassesausoleil.cloudfunctions.net` (ou similaire) et non vers `generativelanguage.googleapis.com`.

- [ ] **Step 4 : Tester `geminiTts`**

Cliquer sur le bouton de lecture vocale d'une terrasse. Vérifier que l'audio se lance.

- [ ] **Step 5 : Tester `geminiLiveToken` — utilisateur connecté**

Se connecter dans l'app, ouvrir l'assistant vocal, vérifier qu'il se connecte.

- [ ] **Step 6 : Tester `geminiLiveToken` — utilisateur non connecté**

Se déconnecter, tenter d'ouvrir l'assistant vocal. Le code doit gérer l'erreur `unauthenticated` (vérifier que l'app n'affiche pas de message cryptique).

- [ ] **Step 7 : Tester les règles Firestore**

Dans la Firebase Console → Firestore → Rules → onglet "Rules Playground" :
- Simuler une écriture dans `ads/test` avec un user non-admin → résultat attendu : **Denied**
- Simuler une écriture dans `ads/test` avec l'email admin → résultat attendu : **Allowed**

- [ ] **Step 8 : Ajouter `VITE_ADMIN_EMAIL` sur Hostinger**

Dans le panneau Hostinger → Variables d'environnement du build :
```
VITE_ADMIN_EMAIL=sflandrin@outlook.com
```

- [ ] **Step 9 : Déployer le frontend sur Hostinger**

Suivre le process de déploiement habituel sur Hostinger (build + upload ou pipeline CI).

- [ ] **Step 10 : Vérification finale en production**

```bash
curl -s https://terrasse-au-soleil.fr/assets/*.js | grep "AIza"
```

Résultat attendu : **aucun résultat** (clé absente du bundle de production).

---

## Checklist finale

- [ ] `grep -r "AIza" dist/` → aucun résultat
- [ ] `grep -r "GEMINI_API_KEY" dist/` → aucun résultat
- [ ] `findTerraces` fonctionne via Cloud Function
- [ ] `speakDescription` fonctionne via Cloud Function
- [ ] Live assistant fonctionne pour un utilisateur connecté
- [ ] Live assistant retourne une erreur gérée pour un utilisateur non connecté
- [ ] Écriture dans `ads` impossible pour un non-admin (testée via Firebase Console)
- [ ] Email admin absent du code source commité
