# Spec : Sécurisation Gemini API & Firebase — Terrasses au Soleil

Date : 2026-04-20  
Statut : Approuvé

## Contexte

Le rapport de sécurité a identifié trois problèmes à corriger par ordre de priorité :

- **P0** : La clé `GEMINI_API_KEY` est injectée dans le bundle JavaScript via `vite.config.ts` — visible par n'importe qui dans les DevTools navigateur.
- **P1** : La vérification admin (`isAdmin()`) est uniquement côté client — les règles Firestore sur la collection `ads` doivent être durcies côté serveur.
- **P2** : L'email admin `sflandrin@outlook.com` est hardcodé dans le source — à déplacer en variable d'environnement.

## Contraintes techniques

- Frontend : app React/Vite statique hébergée sur **Hostinger**
- Backend Firebase : projet `terrassesausoleil`, plan **Blaze** (Cloud Functions disponibles)
- Trois fonctionnalités Gemini à sécuriser : recherche de terrasses, TTS, assistant vocal live (WebSocket)

## Architecture cible

```
Hostinger (frontend statique)
    │
    ├─► POST /api/findTerraces ──────► Cloud Function : gemini-search
    │                                       └─► Gemini API (clé serveur)
    │
    ├─► POST /api/speakDescription ──► Cloud Function : gemini-tts
    │                                       └─► Gemini API (clé serveur)
    │
    └─► GET  /api/liveToken ─────────► Cloud Function : gemini-live-token
              (auth Firebase requis)          └─► retourne { apiKey }
                                              Client établit WebSocket Gemini directement
```

## P0 — Cloud Functions Gemini

### Structure du projet

```
functions/
  index.ts
  src/
    geminiSearch.ts
    geminiTts.ts
    geminiLiveToken.ts
  package.json
  tsconfig.json
```

La clé API est stockée comme secret Firebase :
```bash
firebase functions:secrets:set GEMINI_API_KEY
```

Elle est retirée de `vite.config.ts` et du bundle frontend.

### Prérequis Firebase CLI

```bash
firebase init functions   # si pas encore initialisé
firebase init firestore   # si firestore.rules n'existe pas encore
```

### CORS

Toutes les fonctions autorisent uniquement :
- Le domaine Hostinger de production exact (à confirmer — ex: `https://terrassesausoleil.com`)
- `http://localhost:3000` (développement)

### Cloud Function : `gemini-search`

- **Route :** POST `/api/findTerraces`
- **Auth :** non requise (recherche publique)
- **Body :** `{ location: string, type: string, date: string, time: string, lat?: number, lng?: number }`
- **Logique :** exécute le prompt Gemini avec l'outil `googleSearch`, parse le JSON, retourne le tableau de terrasses + sources
- **Erreurs :** 400 si paramètres manquants, 500 si Gemini échoue — body `{ error: string }`

### Cloud Function : `gemini-tts`

- **Route :** POST `/api/speakDescription`
- **Auth :** non requise
- **Body :** `{ text: string }`
- **Logique :** appelle Gemini TTS, retourne l'audio base64
- **Erreurs :** 400 si `text` manquant, 500 si Gemini échoue

### Cloud Function : `gemini-live-token`

- **Route :** GET `/api/liveToken`
- **Auth :** **requise** — header `Authorization: Bearer <Firebase ID token>`
- **Logique :** vérifie le token Firebase via `admin.auth().verifyIdToken()`, retourne `{ apiKey: GEMINI_API_KEY }` si valide
- **Erreurs :** 401 si token absent ou invalide

### Modifications frontend (`GeminiService`)

- `findTerraces` : remplace l'appel SDK par `fetch('/api/findTerraces', { method: 'POST', body: JSON.stringify(...) })`
- `speakDescription` : remplace l'appel SDK par `fetch('/api/speakDescription', { method: 'POST', body: JSON.stringify({ text }) })`
- `connectLiveAssistant` : appelle d'abord `GET /api/liveToken` avec le Firebase ID token, récupère `apiKey`, puis initialise `GoogleGenAI({ apiKey })` pour la connexion WebSocket
- Le SDK `@google/genai` reste en dépendance frontend uniquement pour le live assistant
- `vite.config.ts` : supprimer les entrées `process.env.API_KEY` et `process.env.GEMINI_API_KEY` du `define`

## P1 — Règles Firestore

Fichier : `firestore.rules`

```js
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

Déploiement : `firebase deploy --only firestore:rules`

La vérification `isAdmin()` côté client reste pour contrôler l'affichage de l'onglet admin — elle n'a plus de rôle de sécurité.

## P2 — Email admin en variable d'environnement

**`dbService.ts` :**
```ts
// Avant
const ADMIN_EMAIL = 'sflandrin@outlook.com';

// Après
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? '';
```

**`.env.local` (développement, non commité) :**
```
VITE_ADMIN_EMAIL=sflandrin@outlook.com
```

**Hostinger :** ajouter `VITE_ADMIN_EMAIL` dans les variables d'environnement du build.

**`.gitignore` :** vérifier que `.env.local` est bien ignoré.

## Ordre d'implémentation

1. P2 (trivial, 5 min) — aucun risque
2. P1 (Firestore rules) — déploiement simple
3. P0 (Cloud Functions) — le plus long, à faire en dernier pour ne pas casser la prod prématurément

## Tests de validation

- [ ] La clé Gemini n'apparaît plus dans le bundle JS (`npm run build` + `grep -r "AIza" dist/`)
- [ ] `findTerraces` fonctionne via la Cloud Function
- [ ] `speakDescription` fonctionne via la Cloud Function
- [ ] Le live assistant fonctionne pour un utilisateur connecté
- [ ] Le live assistant retourne 401 pour un utilisateur non connecté
- [ ] Un utilisateur authentifié non-admin ne peut pas écrire dans la collection `ads` (tester via Firebase console)
- [ ] L'email admin ne figure plus dans le code source commité
