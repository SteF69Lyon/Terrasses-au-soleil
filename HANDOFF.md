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

## Dernière session — 2026-04-21

**Branche active :** `claude/musing-cartwright-e84790` (non mergée sur `main`).

**Plan de référence :** [docs/superpowers/plans/2026-04-20-securite-gemini-firebase.md](docs/superpowers/plans/2026-04-20-securite-gemini-firebase.md)

**Ce qui est fait et commité (Tasks 1–8 du plan) :**
- Admin email déplacé en variable d'env (`VITE_ADMIN_EMAIL`)
- Règles Firestore durcies sur `profiles` et `ads` (+ default-deny)
- 3 Cloud Functions créées : `geminiSearch`, `geminiTts`, `geminiLiveToken`
- `services/geminiService.ts` refait pour appeler les Functions via `httpsCallable`
- Clé Gemini retirée du bundle client (`vite.config.ts` nettoyé)

**Ce qui reste à faire (Task 9 — déploiement & tests prod) :**

1. Enregistrer le secret Gemini côté Firebase :
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```
2. Déployer les règles Firestore et les Functions :
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only functions
   ```
3. Tester en dev (`npm run dev`) :
   - Recherche de terrasse → vérifier que la requête va vers `europe-west1-terrassesausoleil.cloudfunctions.net` et non vers `generativelanguage.googleapis.com`.
   - Lecture vocale TTS d'une description.
   - Live assistant : connecté (doit fonctionner) / déconnecté (doit renvoyer une erreur gérée).
4. Tester les règles dans Firebase Console → Firestore → Rules Playground :
   - Écriture `ads/test` par non-admin → **Denied**.
   - Écriture `ads/test` par admin → **Allowed**.
5. ~~Ajouter `VITE_ADMIN_EMAIL=sflandrin@outlook.com` dans les variables d'env de build sur Hostinger.~~ **✅ Déjà fait.**
6. Redéployer le frontend (process habituel Hostinger).
7. Vérification finale en prod :
   ```bash
   curl -s https://terrasse-au-soleil.fr/assets/*.js | grep "AIza"
   ```
   → doit être **vide**.
8. Une fois validé : merge `claude/musing-cartwright-e84790` → `main` et supprimer la branche.

---

## Notes cross-PC

- Le fichier `.env.local` doit être recréé sur chaque PC (il n'est pas commité — et c'est voulu).
- Les fichiers mémoire Claude (`~/.claude/projects/…/memory/`) **ne suivent pas** entre les PCs. Ce fichier HANDOFF.md est le seul vrai point de reprise partagé.
