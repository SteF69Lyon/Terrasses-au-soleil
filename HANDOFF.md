# Handoff — reprise du travail entre PCs

Ce fichier sert de point de reprise entre les 3 PCs utilisés. Mis à jour à chaque fin de session.

## Environnement de dev

- **Repo :** `SteF69Lyon/Terrasses-au-soleil` (GitHub) — source de vérité cross-PC.
- **Chemin local standard :** `C:/dev/terrasses-au-soleil/` sur les 3 PCs (hors OneDrive).
- **Ne pas mettre le repo dans OneDrive** — corruption des objets git quasi garantie.

### Setup initial sur un nouveau PC

```bash
git clone https://github.com/SteF69Lyon/Terrasses-au-soleil.git /c/dev/terrasses-au-soleil
cd /c/dev/terrasses-au-soleil
npm install
cd functions && npm install && cd ..
echo "VITE_ADMIN_EMAIL=sflandrin@outlook.com" > .env.local
```

### Début de session (PC déjà setup)

```bash
cd /c/dev/terrasses-au-soleil
git pull
git status
```

### Fin de session

```bash
git add -A
git commit -m "wip: <description>"
git push
```

Puis mettre à jour la section **Dernière session** ci-dessous avant de pousser.

---

## Projet

**App :** Terrasses-au-soleil — recherche de terrasses ensoleillées.
**Stack :** React/Vite + Firebase Cloud Functions v2 (Node 20, TS, région `europe-west1`) + Firestore + Gemini API.
**Projet Firebase :** `terrassesausoleil`.
**Prod :** `terrasse-au-soleil.fr` (hébergé Hostinger).
**Admin :** `sflandrin@outlook.com` (via `VITE_ADMIN_EMAIL`).

---

## Dernière session — 2026-04-21 (après-midi)

**Branche active :** `claude/musing-cartwright-e84790` — merge sur `main` en cours (déclenche le déploiement auto Hostinger).

**Plan de référence :** [docs/superpowers/plans/2026-04-20-securite-gemini-firebase.md](docs/superpowers/plans/2026-04-20-securite-gemini-firebase.md)

**Ce qui est fait (Tasks 1–8 + début Task 9) :**
- Admin email déplacé en variable d'env (`VITE_ADMIN_EMAIL`)
- Règles Firestore durcies sur `profiles` et `ads` (+ default-deny) — ✅ **déployées en prod**
- 3 Cloud Functions : `geminiSearch`, `geminiTts`, `geminiLiveToken` — ✅ **déployées en `europe-west1`**
- Secret `GEMINI_API_KEY` — ✅ **enregistré dans Firebase**
- `services/geminiService.ts` refait pour appeler les Functions via `httpsCallable`
- Clé Gemini absente du bundle client (vérifié par `grep 'AIza…' dist/` — seule la clé Firebase Web publique apparaît, par design)

**Ce qui reste à faire (Task 9 — tests prod) :**

1. ~~Enregistrer le secret `GEMINI_API_KEY`~~ ✅ fait
2. ~~Déployer règles Firestore + Functions~~ ✅ fait
3. Merge `claude/musing-cartwright-e84790` → `main` (en cours) → déclenche auto-deploy Hostinger
4. Une fois en ligne, vérification prod :
   ```bash
   curl -s https://terrasse-au-soleil.fr/assets/*.js | grep -oE 'AIza[A-Za-z0-9_-]{35}'
   ```
   → doit renvoyer uniquement `AIzaSyBxuoq...` (Firebase Web, publique), pas la clé Gemini (`AIzaSyD4EQ0...`).
5. Tests manuels dans l'app :
   - Recherche de terrasse → doit appeler `europe-west1-terrassesausoleil.cloudfunctions.net`, pas `generativelanguage.googleapis.com`.
   - Bouton TTS sur une carte.
   - Assistant vocal : connecté (doit fonctionner) / déconnecté (doit afficher erreur gérée).
6. Firebase Console → Firestore → Rules Playground :
   - Écriture `ads/test` par non-admin → **Denied**.
   - Écriture `ads/test` par admin → **Allowed**.

**À prévoir prochainement (pas urgent aujourd'hui) :**
- Node 20 déprécié le 2026-04-30 → upgrade `functions/package.json` vers `"node": "22"` + retester le deploy avant cette date.
- `firebase-functions` obsolète → upgrade vers v6.x (breaking changes à gérer).

---

## Notes cross-PC

- Le fichier `.env.local` doit être recréé sur chaque PC (il n'est pas commité — et c'est voulu).
- Les fichiers mémoire Claude (`~/.claude/projects/…/memory/`) **ne suivent pas** entre les PCs. Ce fichier HANDOFF.md est le seul vrai point de reprise partagé.
