# Migration Firebase → Supabase self-hosted — design

**Date :** 2026-04-27
**Objectif métier :** Sortir de la dépendance Google/Firebase pour Terrasses-au-soleil suite aux blocages successifs subis sur d'autres projets (Iremia 2026-04-23, Poolscore avant ça). Reproduire le pattern d'autonomie déjà éprouvé sur ces deux projets : VPS Hostinger + Supabase self-hosted + AI router multi-provider.

## Contexte

- App existante : SPA React/Vite déployée sur Hostinger shared, auto-deploy push `main`.
- Backend actuel : Firebase Auth + Firestore + 3 Cloud Functions Gemini (`geminiSearch`, `geminiTts`, `geminiLiveToken` en `europe-west1`).
- Données métier en Firestore : 2 collections (`profiles`, `ads`). **Aucune donnée utilisateur à préserver** (seul le compte admin `sflandrin@outlook.com` existe en prod, recréé à la main). Les `ads` éventuelles seront recréées via le nouveau panneau admin.
- Pattern de référence : [Poolscore](https://github.com/SteF69Lyon/Poolscore) pour le code applicatif (Edge Functions + AI router) et [iremia-supabase-stack](https://github.com/SteF69Lyon/iremia-supabase-stack) pour la structure du repo infra.
- Le plan SEO Astro ([2026-04-21-seo-pages-statiques-astro-design.md](2026-04-21-seo-pages-statiques-astro-design.md)) n'a **pas** été exécuté à ce jour. Cette migration le précède intentionnellement pour ne pas migrer du code transitoire.

## Décisions arrêtées (validées)

1. **Instance Supabase dédiée** au projet (pas mutualisée avec Poolscore/Iremia), via projet Docker Compose isolé sur le VPS Hostinger existant. Migration vers VPS dédié possible plus tard en ~2 h (`pg_dumpall` + `tar` + DNS).
2. **API exposée sur `api.terrasse-au-soleil.fr`** via Traefik (déjà déployé sur le VPS pour n8n / Iremia / Poolscore — découverte automatique via labels Docker).
3. **Remplacement de `geminiSearch` par OSM Overpass + AI Router multi-provider** (Anthropic Claude → OpenAI → Google Gemini, avec fallback automatique). OSM fournit les POI réels, le LLM analyse l'ensoleillement.
4. **TTS coupé** (`geminiTts` non porté — gadget non utilisé). Restaurable plus tard si besoin.
5. **Assistant vocal Gemini Live conservé** (`geminiLiveToken` porté tel quel — Gemini-only par nature).
6. **Pas de migration de données** — schéma vide au démarrage, compte admin recréé via Studio.
7. **Front reste sur Hostinger shared**, auto-deploy push `main` inchangé.
8. **Les 3 clés AI providers** (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`) configurées dès le démarrage pour fallback complet.

## Architecture cible

```
┌──────────────────────────────────────────────────────┐
│ Hostinger shared hosting                              │
│ terrasse-au-soleil.fr (SPA Vite/React, auto-deploy)   │
│   - @supabase/supabase-js (anon key publique)         │
│   - Pas de SDK Firebase                               │
└────────────────────┬─────────────────────────────────┘
                     │ HTTPS
                     ▼
┌──────────────────────────────────────────────────────┐
│ VPS Hostinger (mutualisé Poolscore + Iremia)          │
│                                                       │
│ ┌────────────────────────────────────────────┐       │
│ │ docker-compose project: terrasses_*         │       │
│ │ Sous-réseau Docker isolé, ports dédiés      │       │
│ │  - Postgres 15 (volume terrasses_db_data)   │       │
│ │  - GoTrue (auth)                            │       │
│ │  - PostgREST (REST API)                     │       │
│ │  - Realtime (WebSocket pour `ads`)          │       │
│ │  - Storage (provisionné, non utilisé V1)    │       │
│ │  - Edge Runtime (Deno, pour les functions)  │       │
│ │  - Studio (admin UI)                        │       │
│ │  - Kong (API gateway)                       │       │
│ └────────────────────────────────────────────┘       │
│ + Traefik (existant) → route api.terrasse-au-soleil.fr│
│ + Backups pg_dump → GPG → rclone (existant, +1 job)   │
│ + Uptime Kuma (existant, +2 monitors)                 │
└──────────────────────────────────────────────────────┘
```

« Instance dédiée » = projet Docker Compose isolé (réseaux, volumes, ports, secrets). Aucun couplage avec les autres stacks Supabase du VPS.

## Repo `terrasses-supabase-stack`

Calqué sur `iremia-supabase-stack` :

```
terrasses-supabase-stack/
├── README.md
├── HANDOFF.md
├── .env.example
├── .gitignore                          # .env, volumes, secrets
├── docker/
│   └── supabase/
│       ├── docker-compose.override.yml # surcharge le compose upstream (Traefik labels, ports custom)
│       └── .env.example                # secrets + URLs spécifiques au projet
├── db/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql      # profiles, ads, osm_cache + helpers + trigger
│   │   ├── 002_rls.sql                 # toutes les policies
│   │   └── 003_realtime.sql            # publication ads pour Realtime
│   ├── seed/
│   │   └── admin.sql.example           # création compte admin (manuel, non commité avec valeurs)
│   └── tests/
│       └── rls_smoke.sql               # tests RLS en rôles anon/auth/service_role
├── supabase/
│   └── functions/
│       ├── _shared/
│       │   └── ai-router.ts            # adapté du router Poolscore (sans support image)
│       ├── search-terraces/
│       │   └── index.ts
│       └── live-token/
│           └── index.ts
├── scripts/
│   ├── deploy-functions.sh             # restart edge-runtime container
│   └── backup-now.sh                   # pg_dump → B2 manuel (en plus du cron)
└── docs/
    ├── RUNBOOK_MIGRATE_VPS.md          # bascule vers VPS dédié
    ├── RUNBOOK_BACKUPS.md              # restore-from-B2
    └── superpowers/
        ├── specs/                      # ce fichier (copié ici aussi pour traçabilité)
        └── plans/                      # plan d'exécution
```

Le **code applicatif** (SPA, types, components) reste dans le repo `terrasses-au-soleil`. Ce nouveau repo ne contient que l'infra + les Edge Functions + DDL + scripts d'ops.

## Schéma de données (`db/migrations/001_initial_schema.sql`)

```sql
set search_path = public;

-- profiles : 1 ligne par auth.users
create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  name                 text not null,
  email                text not null,
  is_subscribed        boolean default false not null,
  email_notifications  boolean default false not null,
  preferred_type       text default 'all' check (preferred_type in ('bar','restaurant','cafe','hotel','all')),
  preferred_sun_level  integer default 20 check (preferred_sun_level between 0 and 100),
  favorites            text[] default '{}' not null,
  created_at           timestamptz default now() not null,
  updated_at           timestamptz default now() not null
);

-- ads : annonces internes (en plus d'AdSense)
create table public.ads (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  link        text,
  is_active   boolean default true not null,
  created_at  timestamptz default now() not null,
  created_by  uuid references auth.users(id) on delete set null
);

-- osm_cache : POI Overpass cachés (TTL applicatif 7j, géré côté Edge Function)
create table public.osm_cache (
  location_key  text primary key,
  results       jsonb not null,
  fetched_at    timestamptz default now() not null
);
create index osm_cache_fetched_idx on public.osm_cache(fetched_at);

-- helpers
create or replace function public.is_admin() returns boolean
  language sql stable as $$
    select coalesce(auth.jwt() ->> 'email', '') = 'sflandrin@outlook.com';
  $$;

-- trigger updated_at sur profiles (pattern Poolscore)
create or replace function public.set_updated_at() returns trigger
  language plpgsql as $$
  begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
```

`db/migrations/003_realtime.sql` :

```sql
alter publication supabase_realtime add table public.ads;
```

## Row-Level Security (`db/migrations/002_rls.sql`)

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | `auth.uid() = id` (self) | `auth.uid() = id` | `auth.uid() = id` | `is_admin()` |
| `ads` | **public** (anon + auth) | `is_admin()` | `is_admin()` | `is_admin()` |
| `osm_cache` | service_role only | service_role only | service_role only | service_role only |

`osm_cache` est purement serveur (jamais exposé au client) → policies vides côté `anon`/`authenticated`, RLS activée → accès uniquement via la `SERVICE_ROLE_KEY` utilisée par les Edge Functions.

L'admin allowlist est dans la fonction Postgres `is_admin()` — si l'email change, c'est une migration SQL, pas un redéploiement front. Côté front, `VITE_ADMIN_EMAIL` est conservée pour le **gating UI** (cacher les boutons admin), mais **n'est plus la source de vérité** : la RLS Postgres l'est.

## Edge Functions

### `supabase/functions/_shared/ai-router.ts`

Copie quasi-conforme du router Poolscore. Une seule adaptation : retrait du support `images` (non utilisé par Terrasses-au-soleil) → router plus léger. Modèles cibles :

- Anthropic : `claude-sonnet-4-5-20250929`
- OpenAI : `gpt-4o-mini`
- Google : `gemini-2.5-flash`

Helpers exportés : `generate(req)`, `corsHeaders`, `jsonResponse(body, init?)`, `errorResponse(status, message)`. Fallback automatique sur erreur HTTP : Anthropic → OpenAI → Google.

### `supabase/functions/search-terraces/index.ts`

Remplace `geminiSearch`. Flux :

```
POST /functions/v1/search-terraces
Body: { location, type, date, time, lat?, lng? }

1. Validation input
2. Si lat/lng absent : géocoder `location` via Nominatim OSM (1 fetch)
3. location_key = sha256(`${lat.toFixed(4)}:${lng.toFixed(4)}:${type}:1km`)
4. SELECT osm_cache WHERE location_key = $1 AND fetched_at > now() - interval '7 days'
   - HIT  → results = cached.results
   - MISS → Overpass query (amenity in (bar,restaurant,cafe), outdoor_seating=yes, around:1000)
            → INSERT INTO osm_cache (upsert)
5. Construire un prompt avec la liste OSM + date + time
6. router.generate({
     system: 'Tu reçois une liste de POI OSM. Pour chacun, calcule un sunExposure 0-100
              selon orientation et heure. JSON uniquement. sunExposure=null si inconnu.',
     messages: [{ role: 'user', content: prompt }],
     maxTokens: 2000
   })
7. Parser le JSON, retourner { results: Terrace[], sources: [], provider, model }
```

Réponse au format identique à l'actuel pour minimiser le diff client : `{ results, sources }`. `sources` reste vide (plus de Google Search grounding).

### `supabase/functions/live-token/index.ts`

Port direct de `geminiLiveToken`. Mint un token éphémère via Google Live API et le renvoie au client. Reste **Gemini-only** (Live API n'a pas d'équivalent multi-provider). ~30 lignes Deno, aucune logique métier.

## Refactor client `services/dbService.ts`

Stratégie : **conserver l'API publique de la classe** pour minimiser le diff dans `App.tsx` et les composants.

| Méthode publique | Avant (Firebase) | Après (Supabase) |
|---|---|---|
| `register(name, email, password)` | `createUserWithEmailAndPassword` + `setDoc(profiles/{uid})` | `supabase.auth.signUp` + `insert profiles` |
| `login(email, password)` | `signInWithEmailAndPassword` + `getDoc` | `supabase.auth.signInWithPassword` + `select profiles` |
| `logout()` | `signOut` | `supabase.auth.signOut` |
| `onAuthChange(cb)` | `onAuthStateChanged` | `supabase.auth.onAuthStateChange` |
| `updateProfile(uid, profile)` | `setDoc merge` | `update profiles where id = uid` |
| `fetchProfileByUid(uid)` | `getDoc` | `select * from profiles where id = $1` |
| `setSubscriptionStatus(uid, b)` | `updateDoc` | `update profiles set is_subscribed = $1` |
| `isAdmin(email)` | compare avec `VITE_ADMIN_EMAIL` | inchangé (gating UI) |
| `onAdsChange(cb)` | `onSnapshot(query(...))` | `supabase.channel('ads').on('postgres_changes', ...)` + initial `select` |
| `addAd / deleteAd / toggleAdStatus` | Firestore writes | PostgREST writes (RLS bloque si pas admin) |

Mapping snake_case ↔ camelCase via 2 helpers locaux (`dbToProfile()` / `profileToDb()`, ~15 lignes), pattern Poolscore.

Appels aux Edge Functions (`search-terraces`, `live-token`) : remplace `httpsCallable` par `fetch` POST sur `https://api.terrasse-au-soleil.fr/functions/v1/<name>` avec headers `apikey: <SUPABASE_ANON_KEY>` et `Authorization: Bearer <user_jwt>`.

Variables d'env du front (Hostinger panel + `.env.local` par PC) :

```
VITE_SUPABASE_URL=https://api.terrasse-au-soleil.fr
VITE_SUPABASE_ANON_KEY=<eyJ...>
VITE_ADMIN_EMAIL=sflandrin@outlook.com
```

`firebaseConfig` supprimé du code, `firebase` retiré de `package.json` à la fin de la migration.

## Bootstrap initial du VPS (one-shot manuel)

Pattern repris d'iremia-supabase-stack : on **ne fork pas** le `docker-compose.yml` upstream Supabase, on l'étend avec un `docker-compose.override.yml` qui ajoute les labels Traefik et les bindings de ports spécifiques à Terrasses.

```bash
# Cloner upstream Supabase + notre overlay
mkdir -p /opt/terrasses-supabase && cd /opt/terrasses-supabase
git clone --depth 1 https://github.com/supabase/supabase.git
cd supabase/docker
# Récupérer notre overlay et .env depuis le repo terrasses-supabase-stack
curl -O https://raw.githubusercontent.com/SteF69Lyon/terrasses-supabase-stack/main/docker/supabase/docker-compose.override.yml
curl -O https://raw.githubusercontent.com/SteF69Lyon/terrasses-supabase-stack/main/docker/supabase/.env.example
cp .env.example .env
# Éditer .env :
#   POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, etc. (via generate-supabase-secrets.sh)
#   DASHBOARD_USERNAME / DASHBOARD_PASSWORD
#   ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY
#   SITE_URL=https://terrasse-au-soleil.fr
#   API_EXTERNAL_URL=https://api.terrasse-au-soleil.fr
docker compose --project-name terrasses up -d
```

**Ports VPS** (non-conflictuels avec Iremia 5432/6543 et Poolscore 5433/6544) :
- Postgres : `127.0.0.1:5434` (admin uniquement via tunnel SSH, jamais exposé publiquement)
- Pooler : `127.0.0.1:6545`
- Kong : exposé publiquement uniquement via Traefik, pas de bind direct sur l'IP publique

DNS pré-requis : A record `api.terrasse-au-soleil.fr → <IP_VPS>` (Hostinger DNS, TTL 300).

**Traefik** : zéro config supplémentaire côté VPS — Traefik est déjà en place et découvre automatiquement Kong via les labels Docker dans `docker-compose.override.yml` (Host rule + cert TLS Let's Encrypt automatique).

Edge Functions : montées en volume Docker dans le service `functions`. Redéploiement = `docker compose --project-name terrasses restart functions`. Secrets AI injectés via les variables d'env du service.

## Backups & monitoring

- **Backups** : `pg_dump → GPG encrypt → rclone upload` quotidien 03:00 UTC vers le remote backup (Scaleway Object Storage par défaut, configurable via env var `BACKUP_REMOTE` pour B2/S3/GCS). Rétention 30 jours. Pattern et script repris d'iremia (`scripts/ops/backup-postgres.sh`), adapté avec `DB_CONTAINER=terrasses-supabase-db` et `BACKUP_PATH=postgres/terrasses`. Restore documenté dans `docs/RUNBOOK_BACKUPS.md`.
- **Monitoring** : 2 monitors Uptime Kuma (existant) :
  - `https://api.terrasse-au-soleil.fr/rest/v1/` (health PostgREST)
  - `https://terrasse-au-soleil.fr` (front)
  Alertes email/SMS sur `sflandrin@outlook.com`.
- **Logs Edge Functions** : `docker compose --project-name terrasses logs -f functions`. Pas de Grafana en V1.

## Plan de bascule (cutover)

| Jour | Action |
|---|---|
| **J-3** | Repo + infra prêts. Edge Functions déployées. Smoke test depuis Postman/curl. |
| **J-2** | Front en branche `feat/supabase-migration`, dev local pointe sur `api.terrasse-au-soleil.fr`. Tests manuels golden path : register, login, search, ad CRUD admin, live vocal. |
| **J-1** | Merge en `main`. Hostinger redéploie. Test prod **avec un compte de test** d'abord. |
| **J-0** | Compte admin recréé via Studio. Re-login admin. Re-test création/suppression `ads`. |
| **J+1 → J+7** | Observation Uptime Kuma + logs Edge Functions. Le projet Firebase reste en prod, désactivable d'un revert. |
| **J+7** | Coupure Firebase : `firebase functions:delete geminiSearch geminiTts geminiLiveToken`, désactivation Firestore (default-deny). Projet Firebase conservé en lecture seule 30 j. |
| **J+30** | Suppression définitive du projet Firebase. `npm uninstall firebase` côté front si pas déjà fait. |

**Fenêtre de rollback** : J+0 à J+7. Tant que les 3 Cloud Functions et les règles Firestore sont en place, un `git revert` du commit de bascule + redéploiement Hostinger ramène à l'état antérieur en quelques minutes. Après J+7 (suppression des Cloud Functions), un rollback nécessiterait de redéployer les Functions — possible mais plus long. C'est pourquoi on attend 7 jours d'observation avant la coupure.

## Sécurité

- **Aucune clé en dur dans le bundle client** (vs aujourd'hui où `firebaseConfig` est en dur). Seules valeurs publiques : `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (anon = JWT public, OK par design Supabase).
- **`SERVICE_ROLE_KEY` jamais exposée au front**. Utilisée uniquement par les Edge Functions (env var) et les scripts d'ops (depuis le VPS).
- **CORS** : restreint à `https://terrasse-au-soleil.fr` et `http://localhost:3000` côté GoTrue + Edge Functions. Pas de wildcard.
- **Rate limiting Kong** sur les Edge Functions (60 req/min/IP par défaut) pour protéger les budgets LLM contre abus. Configurable dans le `docker-compose.override.yml` ou la config Kong déclarative.
- **Postgres jamais exposé publiquement** : binding forcé à `127.0.0.1:5434` via `docker-compose.override.yml` (sinon Docker bypass UFW sur Ubuntu et expose 5432 sur l'IP publique — pattern de garde-fou repris d'iremia).
- **Tests RLS** dans `db/tests/rls_smoke.sql` exécutés en CI/local : un client `anon` ne doit pas pouvoir lire `profiles`, ne doit pas pouvoir écrire `ads`, etc.

## Risques

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Google bloque entièrement Firebase pendant la migration | Moyenne | Haut | Pas de migration de données → pas bloquant. Repo + infra peuvent être prêts en mode shadow en quelques heures même sans accès Firebase. |
| Coût LLM explose à cause d'un abuseur | Moyenne | Moyen | Rate limit Kong (60/min/IP) + alerte budgétaire chez chaque provider. |
| Overpass rate-limit ou downtime | Moyenne | Faible | Fallback sur 2 mirrors Overpass dans l'Edge Function ; cache Postgres 7 j absorbe la majorité du trafic. |
| RLS mal configurée → fuite de données | Faible | Haut | Tests RLS dans `db/tests/` avant prod (pattern Poolscore). |
| Realtime `ads` ne fonctionne pas en prod | Faible | Faible | Fallback : polling 30 s côté admin si la WebSocket échoue. |
| DNS propagation lente | Faible | Faible | TTL 300, prévenir 24 h à l'avance. |

## Hors scope (incréments séparés ultérieurs)

- Plan SEO Astro ([2026-04-21-seo-pages-statiques-astro-design.md](2026-04-21-seo-pages-statiques-astro-design.md)) — sera repris une fois cette migration stabilisée. Les collections `osmCache/sunScores/pageIntros/etc.` seront créées en tables Postgres en s'appuyant sur la stack ici posée.
- SMTP custom (Resend/Brevo) pour les emails transactionnels GoTrue. V1 utilise les SMTP par défaut.
- Intégration AdSense (déjà prévue hors migration).
- Upgrade Node 22 des Cloud Functions Firebase — devient sans objet une fois Firebase coupé (J+7).
- Restauration du TTS si besoin futur — l'AI router peut être étendu, ou une Edge Function dédiée OpenAI TTS / ElevenLabs créée.
