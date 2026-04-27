# Migration Firebase → Supabase self-hosted — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sortir Terrasses-au-soleil de Firebase (Auth + Firestore + Cloud Functions) vers une instance Supabase self-hosted dédiée sur le VPS Hostinger existant, avec un AI router multi-provider remplaçant les appels Gemini directs.

**Architecture:** Deux repos. Un nouveau repo `terrasses-supabase-stack` contient l'infra (Docker overlay sur le compose upstream Supabase, DDL versionné, Edge Functions Deno, scripts d'ops). Le repo applicatif `terrasses-au-soleil` est modifié en fin de chaîne pour parler à Supabase à la place de Firebase. Bascule progressive J-3 → J+30 avec filet de sécurité Firebase en marche jusqu'à J+7.

**Tech Stack:** Supabase self-hosted (Postgres 15 + GoTrue + PostgREST + Realtime + Storage + Edge Runtime Deno + Studio + Kong) · Docker Compose · Traefik (existant sur VPS, découverte par labels) · `@supabase/supabase-js` côté client · AI Router multi-provider (Anthropic Claude + OpenAI + Google Gemini) · OSM Overpass + Nominatim (POI source).

**Contexte de référence :** voir [`docs/superpowers/specs/2026-04-27-migration-firebase-supabase-design.md`](../specs/2026-04-27-migration-firebase-supabase-design.md) pour le design validé. Pattern code repris de [Poolscore](https://github.com/SteF69Lyon/Poolscore), pattern infra repris de [iremia-supabase-stack](https://github.com/SteF69Lyon/iremia-supabase-stack).

---

## Conventions

- Repo infra : **`terrasses-supabase-stack`** (à créer, dossier local `C:\dev\terrasses-supabase-stack`)
- Repo applicatif (existant) : **`terrasses-au-soleil`** (`C:\dev\terrasses-au-soleil`)
- Tests Edge Functions : Deno test (`deno test --allow-net --allow-env`)
- Tests SQL : `psql -f db/tests/rls_smoke.sql` exécuté depuis l'extérieur via tunnel SSH
- Tests front : Vitest (à introduire — pas encore présent dans terrasses-au-soleil)
- Branches : `feat/<sujet>` sur `main`, PR ou merge direct selon le risque
- Tasks marquées **[VPS]** demandent un accès SSH root au VPS Hostinger — l'utilisateur les exécute lui-même
- Tasks marquées **[CONSOLE]** demandent une action manuelle dans une interface web (DNS Hostinger, Firebase Console, Studio Supabase)

## Structure cible des fichiers

### Nouveau repo `terrasses-supabase-stack` (créé Phase 0-4)

```
terrasses-supabase-stack/
├── README.md
├── HANDOFF.md
├── .gitignore
├── docker/
│   └── supabase/
│       ├── docker-compose.override.yml   # surcharge le compose upstream Supabase
│       └── .env.example                  # template secrets + URLs
├── db/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql        # profiles, ads, osm_cache, helpers, trigger
│   │   ├── 002_rls.sql                   # toutes les policies RLS
│   │   └── 003_realtime.sql              # publication Realtime pour ads
│   ├── seed/
│   │   └── admin.sql.example             # gabarit recréation admin (manuel)
│   └── tests/
│       └── rls_smoke.sql                 # tests RLS rôles anon/authenticated
├── supabase/
│   └── functions/
│       ├── _shared/
│       │   └── ai-router.ts              # multi-provider router (adapté Poolscore)
│       ├── search-terraces/
│       │   ├── index.ts                  # OSM Overpass + cache + LLM
│       │   └── index.test.ts             # tests Deno
│       └── live-token/
│           └── index.ts                  # mint Gemini Live API key
├── scripts/
│   ├── generate-secrets.sh               # génère les 8 secrets crypto
│   ├── deploy-functions.sh               # restart conteneur edge-runtime
│   ├── backup-now.sh                     # pg_dump GPG rclone manuel
│   └── ops/
│       └── backup-postgres.sh            # version cron (adapté d'iremia)
└── docs/
    ├── RUNBOOK_BACKUPS.md
    ├── RUNBOOK_MIGRATE_VPS.md
    └── superpowers/
        ├── specs/                        # copie du spec (lien depuis README)
        └── plans/                        # copie de ce plan (lien depuis README)
```

### Repo `terrasses-au-soleil` (modifié Phase 6)

```
terrasses-au-soleil/
├── services/
│   ├── dbService.ts                      # MODIFIED — Firebase → Supabase
│   ├── searchService.ts                  # NEW — appelle Edge Function search-terraces
│   ├── liveTokenService.ts               # NEW — appelle Edge Function live-token
│   └── geminiService.ts                  # MODIFIED — délègue à searchService/liveTokenService
├── package.json                          # MODIFIED — - firebase, + @supabase/supabase-js
├── .env.local                            # MODIFIED (par PC, non commité)
├── firebase.json                         # SUPPRIMÉ (Phase 8)
├── firestore.rules                       # SUPPRIMÉ (Phase 8)
├── firestore.indexes.json                # SUPPRIMÉ (Phase 8)
├── functions/                            # SUPPRIMÉ (Phase 8)
└── HANDOFF.md                            # MODIFIED — refléter nouvel état
```

---

## Phase 0 — Bootstrap repo terrasses-supabase-stack

### Task 1 : Initialiser le repo `terrasses-supabase-stack`

**Files:**
- Create: `C:\dev\terrasses-supabase-stack\.gitignore`
- Create: `C:\dev\terrasses-supabase-stack\README.md`

- [ ] **Step 1 : Créer le dossier et init git**

```bash
cd /c/dev
mkdir terrasses-supabase-stack
cd terrasses-supabase-stack
git init -b main
```

- [ ] **Step 2 : Créer `.gitignore`**

Contenu :

```gitignore
# Secrets
.env
.env.local
*.key
*.pem
*-credentials.json
*-service-account*.json

# Volumes Docker (jamais dans le repo)
docker/volumes/

# Logs
*.log
/var/log/

# Node / build artefacts (Edge Functions)
node_modules/
.deno/
dist/

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 3 : Créer un `README.md` squelette**

```markdown
# terrasses-supabase-stack

Infra et tooling de la migration Firebase → Supabase self-hosted pour
[Terrasses-au-soleil](https://github.com/SteF69Lyon/Terrasses-au-soleil).

Le code applicatif (SPA React) reste dans le repo `Terrasses-au-soleil`.
Ce repo contient l'overlay Docker Compose, le DDL Postgres, les Edge
Functions Deno, et les scripts d'ops (backups, runbooks).

Spec : voir `docs/superpowers/specs/`
Plan : voir `docs/superpowers/plans/`

## Quick links

- Production VPS : api.terrasse-au-soleil.fr
- Frontend : https://terrasse-au-soleil.fr (auto-deploy via Hostinger)
- Pattern de référence : [iremia-supabase-stack](https://github.com/SteF69Lyon/iremia-supabase-stack)
```

- [ ] **Step 4 : Premier commit**

```bash
git add .gitignore README.md
git commit -m "chore: bootstrap terrasses-supabase-stack"
```

---

## Phase 1 — Infrastructure Docker

### Task 2 : Créer `docker-compose.override.yml`

**Files:**
- Create: `docker/supabase/docker-compose.override.yml`

- [ ] **Step 1 : Créer l'arbo**

```bash
mkdir -p docker/supabase
```

- [ ] **Step 2 : Écrire `docker-compose.override.yml`**

Surcharge le `docker-compose.yml` upstream Supabase pour : (1) ports non-conflictuels avec Iremia/Poolscore, (2) labels Traefik pour exposer Kong, (3) Edge Functions montées en volume + secrets AI, (4) hardening (postgres bindé sur 127.0.0.1).

```yaml
# docker-compose.override.yml — terrasses-supabase-stack
#
# S'ajoute par-dessus le docker-compose.yml upstream Supabase (non modifié)
# pour :
#   1. Forcer les ports Postgres/Pooler en 127.0.0.1 (anti-bypass-UFW)
#   2. Intégrer Kong au réseau Traefik existant et router api.terrasse-au-soleil.fr
#   3. Monter les Edge Functions du repo + injecter les secrets AI
#
# Réseau `root_default` = celui créé par le compose Traefik à la racine du VPS.
# Pré-requis : ce réseau doit déjà exister (présent grâce à n8n/Iremia/Poolscore).
#
# Project name : `terrasses` (toutes les ressources préfixées terrasses_*)

services:

  db:
    container_name: terrasses-supabase-db
    # Volume Postgres dédié au projet (jamais partagé)
    volumes:
      - terrasses_db_data:/var/lib/postgresql/data
      # Migrations DDL appliquées au premier boot (initdb)
      - ../../db/migrations:/docker-entrypoint-initdb.d/migrations:ro

  supavisor:
    # CRITIQUE : l'upstream publie 5432 et 6543 sur 0.0.0.0 — Docker bypass UFW.
    # On force 127.0.0.1 + ports non-conflictuels (Iremia=5432/6543, Poolscore=5433/6544).
    ports: !override
      - "127.0.0.1:5434:5432"
      - "127.0.0.1:6545:6543"

  functions:
    container_name: terrasses-supabase-functions
    volumes:
      - ../../supabase/functions:/home/deno/functions:ro
    environment:
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}

  kong:
    container_name: terrasses-supabase-kong
    networks:
      default:
        aliases:
          - api-gw
      traefik-public: {}
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=root_default"
      # Router HTTPS sur api.terrasse-au-soleil.fr
      - "traefik.http.routers.terrasses-api.rule=Host(`api.terrasse-au-soleil.fr`)"
      - "traefik.http.routers.terrasses-api.entrypoints=websecure"
      - "traefik.http.routers.terrasses-api.tls=true"
      - "traefik.http.routers.terrasses-api.tls.certresolver=mytlschallenge"
      - "traefik.http.services.terrasses-api.loadbalancer.server.port=8000"
      # Headers de sécurité
      - "traefik.http.middlewares.terrasses-sec.headers.stsseconds=31536000"
      - "traefik.http.middlewares.terrasses-sec.headers.stsincludesubdomains=true"
      - "traefik.http.middlewares.terrasses-sec.headers.stspreload=true"
      - "traefik.http.middlewares.terrasses-sec.headers.contenttypenosniff=true"
      - "traefik.http.middlewares.terrasses-sec.headers.browserxssfilter=true"
      - "traefik.http.middlewares.terrasses-sec.headers.framedeny=true"
      - "traefik.http.middlewares.terrasses-sec.headers.referrerpolicy=strict-origin-when-cross-origin"
      - "traefik.http.routers.terrasses-api.middlewares=terrasses-sec"

volumes:
  terrasses_db_data:
    name: terrasses_db_data

networks:
  traefik-public:
    name: root_default
    external: true
```

- [ ] **Step 3 : Commit**

```bash
git add docker/
git commit -m "feat(docker): add docker-compose.override.yml with Traefik routing and hardening"
```

---

### Task 3 : Créer le `.env.example`

**Files:**
- Create: `docker/supabase/.env.example`

- [ ] **Step 1 : Écrire le template**

```bash
# ============================================================================
# Supabase Self-Hosted — terrasses-supabase-stack — .env.example
#
# Copier sur le VPS en `.env` dans /opt/terrasses-supabase/supabase/docker/`
# Remplir tous les `__FILL_ME__` via scripts/generate-secrets.sh.
# Chmod 600. NE JAMAIS COMMITTER LE .env RÉEL.
#
# Doc Supabase self-hosted :
#   https://supabase.com/docs/guides/self-hosting/docker
# ============================================================================

############ SECRETS CRYPTO (générés via scripts/generate-secrets.sh) ############

# Postgres super-user. openssl rand -base64 33 | tr -d '/+=\n' | cut -c1-40
POSTGRES_PASSWORD=__FILL_ME__

# JWT HMAC secret (HS256). openssl rand -hex 32
JWT_SECRET=__FILL_ME__

# JWT ANON (role=anon, exp=10 ans). Safe côté client (RLS protège).
ANON_KEY=__FILL_ME__

# JWT SERVICE_ROLE (role=service_role). BYPASS RLS — JAMAIS côté client.
SERVICE_ROLE_KEY=__FILL_ME__

# Studio login (admin UI accessible via tunnel SSH).
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=__FILL_ME__

# Phoenix (Realtime + Supavisor) base secret. openssl rand -hex 64
SECRET_KEY_BASE=__FILL_ME__

# Supavisor vault — DOIT faire EXACTEMENT 32 chars hex. openssl rand -hex 16
VAULT_ENC_KEY=__FILL_ME__

# postgres-meta crypto. openssl rand -hex 16
PG_META_CRYPTO_KEY=__FILL_ME__

# Logflare. openssl rand -hex 32 chacun
LOGFLARE_PUBLIC_ACCESS_TOKEN=__FILL_ME__
LOGFLARE_PRIVATE_ACCESS_TOKEN=__FILL_ME__

# Storage S3 (signed URLs internes). openssl rand -hex 16 / openssl rand -hex 32
S3_PROTOCOL_ACCESS_KEY_ID=__FILL_ME__
S3_PROTOCOL_ACCESS_KEY_SECRET=__FILL_ME__

############ URLs ############

SUPABASE_PUBLIC_URL=https://api.terrasse-au-soleil.fr
API_EXTERNAL_URL=https://api.terrasse-au-soleil.fr
SITE_URL=https://terrasse-au-soleil.fr
ADDITIONAL_REDIRECT_URLS=https://terrasse-au-soleil.fr,http://localhost:3000

############ AI Providers (injectés dans le service `functions`) ############

ANTHROPIC_API_KEY=__FILL_ME__
OPENAI_API_KEY=__FILL_ME__
GEMINI_API_KEY=__FILL_ME__

############ Email (SMTP par défaut GoTrue, à configurer plus tard) ############

SMTP_ADMIN_EMAIL=sflandrin@outlook.com
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=Terrasses au soleil

############ Désactiver les providers OAuth non utilisés ############

ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
GOTRUE_EXTERNAL_AZURE_ENABLED=false
GOTRUE_EXTERNAL_GOOGLE_ENABLED=false
```

- [ ] **Step 2 : Commit**

```bash
git add docker/supabase/.env.example
git commit -m "feat(docker): add .env.example template for Supabase secrets and AI keys"
```

---

### Task 4 : Script de génération des secrets

**Files:**
- Create: `scripts/generate-secrets.sh`

- [ ] **Step 1 : Écrire le script**

```bash
#!/usr/bin/env bash
# scripts/generate-secrets.sh
#
# Génère les 8 secrets crypto Supabase et les imprime sur stdout au format
# .env (clé=valeur). Usage typique :
#   bash scripts/generate-secrets.sh > /tmp/secrets.env
#   # puis copier-coller manuellement les 8 lignes dans le .env du VPS.
#
# Note : ANON_KEY et SERVICE_ROLE_KEY sont des JWT signés avec JWT_SECRET.
# Ce script imprime les commandes Node pour les générer (à exécuter à la main
# car nécessite npx jsonwebtoken). Ne pas les calculer ici → on garde le
# script en pure shell, exécutable n'importe où.

set -euo pipefail

echo "POSTGRES_PASSWORD=$(openssl rand -base64 33 | tr -d '/+=\n' | cut -c1-40)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "DASHBOARD_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=\n' | cut -c1-32)"
echo "SECRET_KEY_BASE=$(openssl rand -hex 64)"
echo "VAULT_ENC_KEY=$(openssl rand -hex 16)"
echo "PG_META_CRYPTO_KEY=$(openssl rand -hex 16)"
echo "LOGFLARE_PUBLIC_ACCESS_TOKEN=$(openssl rand -hex 32)"
echo "LOGFLARE_PRIVATE_ACCESS_TOKEN=$(openssl rand -hex 32)"
echo "S3_PROTOCOL_ACCESS_KEY_ID=$(openssl rand -hex 16)"
echo "S3_PROTOCOL_ACCESS_KEY_SECRET=$(openssl rand -hex 32)"
echo
echo "# ANON_KEY et SERVICE_ROLE_KEY : générer manuellement à partir de JWT_SECRET ci-dessus."
echo "# Sur le VPS, après avoir mis JWT_SECRET en env :"
echo "#   docker run --rm -e JWT_SECRET node:20-alpine sh -c '"
echo "#     npm i -g jsonwebtoken-cli >/dev/null 2>&1;"
echo '#     for ROLE in anon service_role; do'
echo '#       echo "${ROLE^^}_KEY=$(jwt sign --secret \"$JWT_SECRET\" --algorithm HS256 \\'
echo '#         {\"role\":\"$ROLE\",\"iss\":\"supabase\",\"iat\":'$(date +%s)',\"exp\":'$(($(date +%s) + 315360000))'})"'
echo '#     done'
echo "#   '"
```

- [ ] **Step 2 : Rendre exécutable et commit**

```bash
chmod +x scripts/generate-secrets.sh
git add scripts/generate-secrets.sh
git commit -m "feat(scripts): add generate-secrets.sh for Supabase crypto secrets"
```

---

### Task 5 : Script de redéploiement Edge Functions

**Files:**
- Create: `scripts/deploy-functions.sh`

- [ ] **Step 1 : Écrire**

```bash
#!/usr/bin/env bash
# scripts/deploy-functions.sh
#
# Pull dernière version des Edge Functions et restart le conteneur edge-runtime.
# À lancer sur le VPS dans /opt/terrasses-supabase/.
#
# Le code des functions est monté en volume (read-only) depuis ce repo,
# donc un git pull + restart suffit — pas de build, pas de push image.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ git pull"
git pull --ff-only

echo "→ restart functions container"
cd supabase/docker
docker compose --project-name terrasses restart functions

echo "→ recent logs (last 20 lines)"
docker compose --project-name terrasses logs --tail=20 functions

echo "✅ Edge Functions redeployed"
```

- [ ] **Step 2 : Commit**

```bash
chmod +x scripts/deploy-functions.sh
git add scripts/deploy-functions.sh
git commit -m "feat(scripts): add deploy-functions.sh for VPS-side redeploy"
```

---

## Phase 2 — Schéma de données

### Task 6 : Migration 001 — schéma initial

**Files:**
- Create: `db/migrations/001_initial_schema.sql`

- [ ] **Step 1 : Créer l'arbo**

```bash
mkdir -p db/migrations db/seed db/tests
```

- [ ] **Step 2 : Écrire le schéma**

```sql
-- ============================================================================
-- 001_initial_schema.sql — terrasses-supabase-stack
--
-- Crée :
--   - public.profiles (1 ligne par auth.users)
--   - public.ads (annonces internes affichées en complément d'AdSense)
--   - public.osm_cache (cache POI Overpass — TTL géré côté Edge Function)
--   - helpers : is_admin(), set_updated_at()
--   - trigger updated_at sur profiles
-- ============================================================================

set search_path = public;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
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

create index if not exists profiles_email_idx on public.profiles(email);

-- ----------------------------------------------------------------------------
-- ads
-- ----------------------------------------------------------------------------
create table if not exists public.ads (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  link        text,
  is_active   boolean default true not null,
  created_at  timestamptz default now() not null,
  created_by  uuid references auth.users(id) on delete set null
);

create index if not exists ads_active_created_idx on public.ads(is_active, created_at desc);

-- ----------------------------------------------------------------------------
-- osm_cache (jamais lu/écrit par anon ou authenticated → service_role only via RLS)
-- ----------------------------------------------------------------------------
create table if not exists public.osm_cache (
  location_key  text primary key,
  results       jsonb not null,
  fetched_at    timestamptz default now() not null
);

create index if not exists osm_cache_fetched_idx on public.osm_cache(fetched_at);

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
-- is_admin() : true si l'email JWT correspond à l'allowlist
create or replace function public.is_admin() returns boolean
  language sql stable as $$
    select coalesce(auth.jwt() ->> 'email', '') = 'sflandrin@outlook.com';
  $$;

-- set_updated_at trigger fn
create or replace function public.set_updated_at() returns trigger
  language plpgsql as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
```

- [ ] **Step 3 : Commit**

```bash
git add db/migrations/001_initial_schema.sql
git commit -m "feat(db): initial schema with profiles, ads, osm_cache + helpers"
```

---

### Task 7 : Migration 002 — RLS policies

**Files:**
- Create: `db/migrations/002_rls.sql`

- [ ] **Step 1 : Écrire les policies**

```sql
-- ============================================================================
-- 002_rls.sql — Row-Level Security pour terrasses-supabase-stack
--
-- Modèle d'accès :
--   profiles  : SELECT/UPDATE/INSERT par soi-même, DELETE par admin uniquement
--   ads       : SELECT public, écritures admin uniquement
--   osm_cache : service_role only (jamais exposé au client)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self
  on public.profiles for select
  using ( auth.uid() = id );

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles for insert
  with check ( auth.uid() = id );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update
  using ( auth.uid() = id )
  with check ( auth.uid() = id );

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin
  on public.profiles for delete
  using ( public.is_admin() );

-- ---------------------------------------------------------------------------
-- ads
-- ---------------------------------------------------------------------------
alter table public.ads enable row level security;

drop policy if exists ads_select_public on public.ads;
create policy ads_select_public
  on public.ads for select
  using ( true );  -- lecture publique (anon + auth)

drop policy if exists ads_insert_admin on public.ads;
create policy ads_insert_admin
  on public.ads for insert
  with check ( public.is_admin() );

drop policy if exists ads_update_admin on public.ads;
create policy ads_update_admin
  on public.ads for update
  using ( public.is_admin() );

drop policy if exists ads_delete_admin on public.ads;
create policy ads_delete_admin
  on public.ads for delete
  using ( public.is_admin() );

-- ---------------------------------------------------------------------------
-- osm_cache : RLS activée mais aucune policy pour anon/authenticated
-- → seul service_role (qui bypass RLS par défaut) peut accéder
-- ---------------------------------------------------------------------------
alter table public.osm_cache enable row level security;
-- (aucune policy : verrouillé)
```

- [ ] **Step 2 : Commit**

```bash
git add db/migrations/002_rls.sql
git commit -m "feat(db): RLS policies for profiles, ads, osm_cache"
```

---

### Task 8 : Migration 003 — Realtime publication

**Files:**
- Create: `db/migrations/003_realtime.sql`

- [ ] **Step 1 : Écrire**

```sql
-- ============================================================================
-- 003_realtime.sql — Activer Realtime sur ads pour le dashboard admin
-- ============================================================================

-- La publication `supabase_realtime` est créée par Supabase au boot.
-- On ajoute uniquement la table `ads` (pas les autres — pas besoin).
alter publication supabase_realtime add table public.ads;
```

- [ ] **Step 2 : Commit**

```bash
git add db/migrations/003_realtime.sql
git commit -m "feat(db): add ads to supabase_realtime publication"
```

---

### Task 9 : Tests RLS smoke

**Files:**
- Create: `db/tests/rls_smoke.sql`
- Create: `db/tests/README.md`

- [ ] **Step 1 : Écrire les tests**

```sql
-- ============================================================================
-- rls_smoke.sql — Tests d'intégration RLS
--
-- Usage local (depuis ta machine, avec un tunnel SSH ouvert sur 5434) :
--   PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -p 5434 -U postgres \
--     -f db/tests/rls_smoke.sql
--
-- Si tous les tests passent, le script affiche "✓ ALL RLS TESTS PASSED" à la fin.
-- En cas de fail, le script s'arrête avec un message explicite.
-- ============================================================================

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Setup : créer un user de test et son profil
-- ---------------------------------------------------------------------------
do $$
declare
  test_uid uuid := gen_random_uuid();
begin
  -- Insert direct dans auth.users (bypass GoTrue, ok pour test SQL pur)
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, role, aud)
  values (test_uid, 'test-rls@example.com', 'fake', now(), 'authenticated', 'authenticated')
  on conflict (id) do nothing;

  insert into public.profiles (id, name, email)
  values (test_uid, 'Test User', 'test-rls@example.com')
  on conflict (id) do nothing;

  perform set_config('test.uid', test_uid::text, false);
end $$;

-- ---------------------------------------------------------------------------
-- Test 1 : anon ne peut PAS lire profiles
-- ---------------------------------------------------------------------------
set role anon;
do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.profiles;
  if visible_count > 0 then
    raise exception '❌ FAIL: anon can see % profile(s) — should be 0', visible_count;
  end if;
  raise notice '✓ Test 1: anon cannot read profiles';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Test 2 : anon ne peut PAS écrire dans ads
-- ---------------------------------------------------------------------------
set role anon;
do $$
begin
  begin
    insert into public.ads (text) values ('hack');
    raise exception '❌ FAIL: anon could insert into ads';
  exception when insufficient_privilege or check_violation then
    raise notice '✓ Test 2: anon cannot insert into ads';
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Test 3 : anon PEUT lire ads
-- ---------------------------------------------------------------------------
set role anon;
do $$
declare
  ok boolean;
begin
  -- on attend juste que la requête réussisse, pas qu'il y ait du contenu
  perform * from public.ads limit 1;
  raise notice '✓ Test 3: anon can read ads';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Test 4 : anon ne peut PAS lire osm_cache
-- ---------------------------------------------------------------------------
set role anon;
do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.osm_cache;
  if visible_count > 0 then
    raise exception '❌ FAIL: anon can see % osm_cache row(s)', visible_count;
  end if;
  raise notice '✓ Test 4: anon cannot read osm_cache';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
delete from public.profiles where email = 'test-rls@example.com';
delete from auth.users where email = 'test-rls@example.com';

\echo '✓ ALL RLS TESTS PASSED'
```

- [ ] **Step 2 : Doc associée**

```markdown
# db/tests

Tests SQL exécutés manuellement contre l'instance Postgres du VPS via tunnel SSH.

## rls_smoke.sql

Vérifie que les policies RLS bloquent bien l'accès anon aux tables sensibles.

### Lancer depuis ta machine

```bash
# 1. Tunnel SSH (laisse-le ouvert dans un terminal)
ssh -L 5434:127.0.0.1:5434 root@<IP_VPS>

# 2. Dans un autre terminal local
PGPASSWORD=<POSTGRES_PASSWORD> psql \
  -h 127.0.0.1 -p 5434 -U postgres -d postgres \
  -f db/tests/rls_smoke.sql
```

Sortie attendue : `✓ ALL RLS TESTS PASSED`. Si un test fail, le script s'arrête avec `❌ FAIL: ...`.
```

- [ ] **Step 3 : Commit**

```bash
git add db/tests/
git commit -m "test(db): add RLS smoke tests for profiles, ads, osm_cache"
```

---

## Phase 3 — Edge Functions

### Task 10 : `_shared/ai-router.ts` (multi-provider)

**Files:**
- Create: `supabase/functions/_shared/ai-router.ts`

Le router est fondamentalement le même que [Poolscore](https://github.com/SteF69Lyon/Poolscore/blob/main/supabase/functions/_shared/ai-router.ts) avec une seule différence : on retire le support `images` (non utilisé). On copie le fichier puis on le simplifie.

- [ ] **Step 1 : Créer l'arbo et récupérer la base Poolscore**

```bash
mkdir -p supabase/functions/_shared
curl -fsSL \
  https://raw.githubusercontent.com/SteF69Lyon/Poolscore/main/supabase/functions/_shared/ai-router.ts \
  -o supabase/functions/_shared/ai-router.ts
```

- [ ] **Step 2 : Simplifier — retirer le support `images`**

Éditer `supabase/functions/_shared/ai-router.ts` et appliquer ces 3 changements :

1. **Type `AIMessage`** : retirer la branche avec `images`. Remplacer :
   ```ts
   export type AIMessage =
     | { role: 'assistant'; content: string }
     | { role: 'user'; content: string; images?: InlineImage[] };
   ```
   par :
   ```ts
   export type AIMessage =
     | { role: 'assistant'; content: string }
     | { role: 'user'; content: string };
   ```
   Et **supprimer entièrement** le type `InlineImage` et `CLAUDE_MEDIA_TYPES`.

2. **Provider Anthropic** : remplacer le bloc `messages.map((m) => { if (m.role === 'user' && 'images' in m && m.images?.length) { ... } return ...; });` par :
   ```ts
   const messages = req.messages.map((m) => ({ role: m.role, content: m.content }));
   ```

3. **Provider OpenAI** : même simplification — remplacer la boucle `for (const m of req.messages) { if (m.role === 'user' && 'images' in m && m.images?.length) { ... } else { ... } }` par :
   ```ts
   for (const m of req.messages) {
     messages.push({ role: m.role, content: m.content });
   }
   ```

4. **Provider Google** : même chose — remplacer le `parts: unknown[] = [{ text: m.content }]; if (m.role === 'user' && 'images' in m && m.images?.length) { for (const img of m.images) { parts.push(...); } }` par :
   ```ts
   const parts = [{ text: m.content }];
   ```

Le reste du fichier (router avec fallback, helpers `corsHeaders`, `jsonResponse`, `errorResponse`) **reste identique**.

- [ ] **Step 3 : Test rapide via deno fmt**

```bash
deno fmt --check supabase/functions/_shared/ai-router.ts
```

Si pas de Deno installé localement : `npx -p deno deno fmt --check supabase/functions/_shared/ai-router.ts`. Attendu : exit 0, pas de diff.

- [ ] **Step 4 : Commit**

```bash
git add supabase/functions/_shared/ai-router.ts
git commit -m "feat(functions): add multi-provider AI router (adapted from Poolscore, no image support)"
```

---

### Task 11 : Edge Function `search-terraces`

**Files:**
- Create: `supabase/functions/search-terraces/index.ts`
- Create: `supabase/functions/search-terraces/index.test.ts`

- [ ] **Step 1 : Écrire le test (TDD)**

Test minimal qui mock `fetch` (Overpass + LLM) et vérifie le format de réponse. Créer `supabase/functions/search-terraces/index.test.ts` :

```ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// Mock global fetch pour Nominatim + Overpass + LLM
const originalFetch = globalThis.fetch;

Deno.test('search-terraces returns Terrace[] in expected shape', async () => {
  globalThis.fetch = (input: Request | URL | string, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('nominatim')) {
      return Promise.resolve(new Response(JSON.stringify([{ lat: '45.75', lon: '4.85' }])));
    }
    if (url.includes('overpass')) {
      return Promise.resolve(new Response(JSON.stringify({
        elements: [
          { type: 'node', id: 1, lat: 45.75, lon: 4.85, tags: { name: 'Le Solar', amenity: 'bar' } },
        ],
      })));
    }
    if (url.includes('anthropic.com')) {
      return Promise.resolve(new Response(JSON.stringify({
        content: [{ type: 'text', text: '[{"id":"1","name":"Le Solar","sunExposure":75}]' }],
      })));
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  };

  const { default: handler } = await import('./index.ts');
  const req = new Request('http://localhost/functions/v1/search-terraces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'Lyon', type: 'bar', date: '2026-04-30', time: '18:00' }),
  });
  const res = await handler(req);
  const json = await res.json();

  assertEquals(res.status, 200);
  assertEquals(Array.isArray(json.results), true);
  assertEquals(json.results[0].name, 'Le Solar');
  assertEquals(typeof json.provider, 'string');

  globalThis.fetch = originalFetch;
});
```

- [ ] **Step 2 : Lancer le test (doit échouer — handler n'existe pas)**

```bash
deno test --allow-net --allow-env --allow-read supabase/functions/search-terraces/index.test.ts
```

Attendu : `error: Module not found "file:///.../index.ts"`.

- [ ] **Step 3 : Implémenter l'Edge Function**

Créer `supabase/functions/search-terraces/index.ts` :

```ts
// Edge Function: search-terraces
// Remplace l'ancienne Cloud Function geminiSearch.
//
// Flux :
//   1. Géocode location via Nominatim si pas de lat/lng
//   2. Cherche dans osm_cache (TTL 7j)
//   3. MISS → Overpass query, INSERT dans osm_cache
//   4. AI router : LLM analyse l'ensoleillement de chaque POI
//   5. Renvoie { results, sources: [], provider, model }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  generate,
  corsHeaders,
  jsonResponse,
  errorResponse,
} from '../_shared/ai-router.ts';

type Input = {
  location: string;
  type: 'bar' | 'restaurant' | 'cafe' | 'hotel' | 'all';
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
  lat?: number;
  lng?: number;
};

type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const RADIUS_M = 1000;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

function validate(d: unknown): string | null {
  if (!d || typeof d !== 'object') return 'Invalid payload';
  const i = d as Partial<Input>;
  if (!i.location || typeof i.location !== 'string') return 'location required';
  if (!i.type || typeof i.type !== 'string') return 'type required';
  if (!i.date || !/^\d{4}-\d{2}-\d{2}$/.test(i.date)) return 'date must be YYYY-MM-DD';
  if (!i.time || !/^\d{1,2}:\d{2}$/.test(i.time)) return 'time must be HH:MM';
  return null;
}

async function geocode(location: string): Promise<{ lat: number; lng: number }> {
  const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(location)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'terrasse-au-soleil/1.0' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const arr = await res.json();
  if (!arr.length) throw new Error(`Location not found: ${location}`);
  return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
}

async function overpassQuery(lat: number, lng: number, type: string): Promise<OsmElement[]> {
  const amenityFilter = type === 'all'
    ? '["amenity"~"^(bar|restaurant|cafe)$"]'
    : `["amenity"="${type}"]`;
  const q = `
    [out:json][timeout:15];
    (
      node${amenityFilter}["outdoor_seating"="yes"](around:${RADIUS_M},${lat},${lng});
      way${amenityFilter}["outdoor_seating"="yes"](around:${RADIUS_M},${lat},${lng});
    );
    out center 50;
  `.trim();

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!res.ok) continue;
      const json = await res.json();
      return (json.elements ?? []) as OsmElement[];
    } catch {
      // try next mirror
    }
  }
  throw new Error('All Overpass mirrors failed');
}

function locationKey(lat: number, lng: number, type: string): string {
  // round to 4 decimals (~11m precision) + type — deterministic
  const k = `${lat.toFixed(4)}:${lng.toFixed(4)}:${type}:${RADIUS_M}`;
  // simple hash : sha256 hex would be safer mais here clé en clair OK (DB privée)
  return k;
}

function osmToTerrace(el: OsmElement) {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  return {
    id: String(el.id),
    name: el.tags?.name ?? 'Établissement sans nom',
    address: [el.tags?.['addr:street'], el.tags?.['addr:postcode'], el.tags?.['addr:city']]
      .filter(Boolean).join(' '),
    type: el.tags?.amenity ?? 'bar',
    lat,
    lng: lon,
    rating: 0, // OSM ne fournit pas de rating
    sunExposure: null as number | null,
    description: '',
    sunLevel: '',
    imageUrl: '',
    coordinates: { lat: lat ?? 0, lng: lon ?? 0 },
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse(405, 'POST only');

  const body = await req.json().catch(() => null);
  const err = validate(body);
  if (err) return errorResponse(400, err);
  const input = body as Input;

  try {
    // 1. coords
    const coords = (input.lat != null && input.lng != null)
      ? { lat: input.lat, lng: input.lng }
      : await geocode(input.location);

    // 2. cache lookup
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const key = locationKey(coords.lat, coords.lng, input.type);

    const { data: cached } = await supabase
      .from('osm_cache')
      .select('results, fetched_at')
      .eq('location_key', key)
      .single();

    let elements: OsmElement[];
    const fresh = cached
      && (Date.now() - new Date(cached.fetched_at).getTime() < TTL_MS);

    if (fresh) {
      elements = cached!.results as OsmElement[];
    } else {
      elements = await overpassQuery(coords.lat, coords.lng, input.type);
      await supabase.from('osm_cache').upsert({
        location_key: key,
        results: elements,
        fetched_at: new Date().toISOString(),
      });
    }

    // 3. LLM enrichment — ensoleillement
    const terraces = elements.map(osmToTerrace).filter((t) => t.lat && t.lng);
    if (terraces.length === 0) {
      return jsonResponse({ results: [], sources: [], provider: null, model: null });
    }

    const prompt = `Voici une liste de POI OpenStreetMap à analyser pour leur ensoleillement le ${input.date} à ${input.time} :

${JSON.stringify(terraces.map((t) => ({ id: t.id, name: t.name, lat: t.lat, lng: t.lng })), null, 2)}

Pour chaque POI, calcule un sunExposure entre 0 (totalement à l'ombre) et 100 (en plein soleil) en tenant compte de l'orientation des rues environnantes et de la position du soleil à l'heure indiquée. Si tu ne peux pas estimer, mets sunExposure: null.

Réponds EXCLUSIVEMENT par un tableau JSON de la forme :
[{"id":"<id>","sunExposure":<0-100|null>,"description":"<courte analyse>"}]`;

    const ai = await generate({
      system: 'Tu es un expert en analyse d\'ensoleillement urbain. Tu réponds uniquement en JSON.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
    });

    // Parser le JSON
    const match = ai.text.match(/\[[\s\S]*\]/);
    let enrichments: Array<{ id: string; sunExposure: number | null; description: string }> = [];
    if (match) {
      try {
        enrichments = JSON.parse(match[0]);
      } catch {
        // si le LLM rend du JSON cassé, on retourne quand même les terraces sans enrichissement
      }
    }

    const enriched = terraces.map((t) => {
      const e = enrichments.find((x) => x.id === t.id);
      return e
        ? { ...t, sunExposure: e.sunExposure, description: e.description }
        : t;
    });

    return jsonResponse({
      results: enriched,
      sources: [],
      provider: ai.provider,
      model: ai.model,
    });
  } catch (e) {
    console.error('search-terraces error:', e);
    return errorResponse(500, (e as Error).message);
  }
};

Deno.serve(handler);
export default handler;
```

- [ ] **Step 4 : Lancer le test → doit passer**

```bash
deno test --allow-net --allow-env --allow-read supabase/functions/search-terraces/index.test.ts
```

Attendu : `ok | 1 passed | 0 failed`.

- [ ] **Step 5 : Commit**

```bash
git add supabase/functions/search-terraces/
git commit -m "feat(functions): add search-terraces with Overpass + cache + AI router"
```

---

### Task 12 : Edge Function `live-token`

**Files:**
- Create: `supabase/functions/live-token/index.ts`

Port direct de `terrasses-au-soleil/functions/src/geminiLiveToken.ts` (Cloud Function Firebase). Auth-gate puis renvoie la clé Gemini API au client. Pas de tests Deno (logique triviale, validée par le smoke test cross-stack).

- [ ] **Step 1 : Créer**

```bash
mkdir -p supabase/functions/live-token
```

- [ ] **Step 2 : Écrire**

```ts
// Edge Function: live-token
// Mint un accès à Gemini Live API pour un client authentifié.
// Port direct de l'ancienne Cloud Function geminiLiveToken.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse, errorResponse } from '../_shared/ai-router.ts';

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST' && req.method !== 'GET') return errorResponse(405, 'GET/POST only');

  // Vérifie le JWT utilisateur via header Authorization
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(401, 'Connexion requise pour accéder à l\'assistant vocal.');
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return errorResponse(401, 'Connexion requise pour accéder à l\'assistant vocal.');
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return errorResponse(500, 'Clé API non configurée.');

  return jsonResponse({ apiKey });
};

Deno.serve(handler);
export default handler;
```

- [ ] **Step 3 : Commit**

```bash
git add supabase/functions/live-token/
git commit -m "feat(functions): port geminiLiveToken to Edge Function live-token"
```

---

## Phase 4 — Ops & docs

### Task 13 : Adapter le script de backup

**Files:**
- Create: `scripts/ops/backup-postgres.sh`
- Create: `scripts/backup-now.sh`

- [ ] **Step 1 : Récupérer le script iremia comme base**

```bash
mkdir -p scripts/ops
curl -fsSL \
  https://raw.githubusercontent.com/SteF69Lyon/iremia-supabase-stack/main/scripts/ops/backup-postgres.sh \
  -o scripts/ops/backup-postgres.sh
```

- [ ] **Step 2 : Adapter pour Terrasses (3 changements)**

Éditer `scripts/ops/backup-postgres.sh` :

1. **Container par défaut** : remplacer `DB_CONTAINER="${DB_CONTAINER:-supabase-db}"` par :
   ```bash
   DB_CONTAINER="${DB_CONTAINER:-terrasses-supabase-db}"
   ```

2. **GPG recipient** : remplacer `GPG_RECIPIENT="${GPG_RECIPIENT:-backup@iremia-sante.fr}"` par :
   ```bash
   GPG_RECIPIENT="${GPG_RECIPIENT:-backup@terrasse-au-soleil.fr}"
   ```

3. **Backup path** : remplacer `BACKUP_PATH="${BACKUP_PATH:-postgres}"` par :
   ```bash
   BACKUP_PATH="${BACKUP_PATH:-postgres/terrasses}"
   ```

4. **Header de bannière** : remplacer `log "═══ Iremia Supabase backup ═══"` par :
   ```bash
   log "═══ Terrasses Supabase backup ═══"
   ```

5. **Log dir** : remplacer `LOG_DIR="${LOG_DIR:-/var/log/iremia-backup}"` par :
   ```bash
   LOG_DIR="${LOG_DIR:-/var/log/terrasses-backup}"
   ```

6. **DB user** : `pg_dump -U supabase_admin` reste identique (Supabase upstream utilise `supabase_admin` partout).

- [ ] **Step 3 : Wrapper manuel `backup-now.sh`**

```bash
#!/usr/bin/env bash
# scripts/backup-now.sh
# Lance un backup à la demande (utile avant une opération risquée).
# Doit être exécuté sur le VPS, sous root.

set -euo pipefail
exec bash "$(dirname "$0")/ops/backup-postgres.sh" "$@"
```

- [ ] **Step 4 : Commit**

```bash
chmod +x scripts/ops/backup-postgres.sh scripts/backup-now.sh
git add scripts/ops/backup-postgres.sh scripts/backup-now.sh
git commit -m "feat(scripts): adapt backup-postgres.sh for terrasses container/path"
```

---

### Task 14 : Runbooks

**Files:**
- Create: `docs/RUNBOOK_BACKUPS.md`
- Create: `docs/RUNBOOK_MIGRATE_VPS.md`

- [ ] **Step 1 : `docs/RUNBOOK_BACKUPS.md`**

```markdown
# Runbook — Backups Postgres

## Backup automatique (cron)

Le job `scripts/ops/backup-postgres.sh` tourne tous les jours à 03:00 UTC sur le VPS via cron :

```cron
0 3 * * * /opt/terrasses-supabase/scripts/ops/backup-postgres.sh >> /var/log/terrasses-backup/cron.log 2>&1
```

Le backup chiffré GPG est uploadé sur le remote rclone par défaut (`scaleway:`), bucket `iremia-supabase-backups`, path `postgres/terrasses/<host>-<timestamp>.dump.gpg`.

## Backup manuel (avant opération risquée)

```bash
# Sur le VPS
sudo bash /opt/terrasses-supabase/scripts/backup-now.sh
```

## Restore

```bash
# 1. Lister les backups disponibles
rclone ls scaleway:iremia-supabase-backups/postgres/terrasses/ | tail -10

# 2. Télécharger + déchiffrer le dump souhaité
rclone cat scaleway:iremia-supabase-backups/postgres/terrasses/<host>-<timestamp>.dump.gpg \
  | gpg --decrypt > /tmp/terrasses-restore.dump

# 3. (Optionnel — DESTRUCTIF) Stopper la stack avant restore
cd /opt/terrasses-supabase/supabase/docker
docker compose --project-name terrasses stop

# 4. Restore
docker compose --project-name terrasses up -d db
docker exec -i terrasses-supabase-db pg_restore \
  -U supabase_admin -d postgres --clean --if-exists < /tmp/terrasses-restore.dump

# 5. Restart le reste
docker compose --project-name terrasses up -d
```

## Vérification d'intégrité

Comparer le manifest compté (uploadé à côté du dump) vs `SELECT count(*) FROM ...` post-restore :

```bash
rclone cat scaleway:iremia-supabase-backups/postgres/terrasses/<file>.dump.gpg.manifest
```

Format : `<schema>.<table>|<estimated_rows>` une ligne par table.
```

- [ ] **Step 2 : `docs/RUNBOOK_MIGRATE_VPS.md`**

```markdown
# Runbook — Migrer Terrasses vers un VPS dédié

Si la mutualisation devient problématique (perfs, isolation, panne du VPS partagé), bascule vers un nouveau VPS dédié. Opération typique ~2 h.

## Pré-requis

- Nouveau VPS Hostinger commandé, accès SSH root configuré
- DNS sous ton contrôle (Hostinger panel)
- Backup récent disponible (`scripts/backup-now.sh` lancé < 1h avant)

## Procédure

### 1. Préparer le nouveau VPS

```bash
ssh root@<NEW_IP>
# Installer Docker + rclone + gpg + git (cf. setup-vps-hardening.sh d'iremia si besoin)
mkdir -p /opt/terrasses-supabase
cd /opt/terrasses-supabase
git clone https://github.com/SteF69Lyon/terrasses-supabase-stack.git .
git clone --depth 1 https://github.com/supabase/supabase.git
cp docker/supabase/docker-compose.override.yml supabase/docker/
cp docker/supabase/.env.example supabase/docker/.env
```

### 2. Restaurer les secrets exacts de l'ancien VPS

**CRITIQUE :** garder le **MÊME `JWT_SECRET`** sinon tous les tokens utilisateurs actifs deviennent invalides (logout forcé). Idem `POSTGRES_PASSWORD` (sinon il faut tout reconfigurer).

```bash
# Sur l'ancien VPS, copier le .env vers le nouveau (via scp local, pas via internet en clair)
scp /opt/terrasses-supabase/supabase/docker/.env new-vps:/opt/terrasses-supabase/supabase/docker/.env
```

### 3. Backup → restore

```bash
# Sur l'ancien VPS
sudo bash /opt/terrasses-supabase/scripts/backup-now.sh

# Sur le nouveau VPS — restore le dernier dump
LATEST=$(rclone ls scaleway:iremia-supabase-backups/postgres/terrasses/ | tail -1 | awk '{print $2}')
cd /opt/terrasses-supabase/supabase/docker
docker compose --project-name terrasses up -d db
sleep 10
rclone cat "scaleway:iremia-supabase-backups/postgres/terrasses/$LATEST" \
  | gpg --decrypt \
  | docker exec -i terrasses-supabase-db pg_restore -U supabase_admin -d postgres --clean --if-exists
docker compose --project-name terrasses up -d
```

### 4. Bascule DNS

Hostinger panel → DNS terrasse-au-soleil.fr → A record `api` → `<NEW_IP>`. TTL avait été mis à 300 → propagation < 10 min.

### 5. Vérifier

```bash
# Depuis ta machine locale
curl -s https://api.terrasse-au-soleil.fr/rest/v1/ -H "apikey: $ANON_KEY" | jq
# Doit retourner le swagger OpenAPI Supabase
```

### 6. Décommissionner l'ancien

Après 24h d'observation sans incident :
```bash
ssh old-vps
cd /opt/terrasses-supabase/supabase/docker
docker compose --project-name terrasses down
docker volume rm terrasses_db_data
```
```

- [ ] **Step 3 : Commit**

```bash
git add docs/
git commit -m "docs: add runbooks for backups and VPS migration"
```

---

### Task 15 : Finaliser README et HANDOFF

**Files:**
- Modify: `README.md`
- Create: `HANDOFF.md`

- [ ] **Step 1 : Réécrire `README.md`** complet

```markdown
# terrasses-supabase-stack

> Infrastructure et tooling de la migration Firebase → Supabase self-hosted pour [Terrasses-au-soleil](https://github.com/SteF69Lyon/Terrasses-au-soleil).

## Contexte

Le compte Google qui héberge Firebase pour Terrasses-au-soleil est susceptible d'être bloqué (cas déjà subi sur Iremia et Poolscore). On migre toute la couche données vers Supabase self-hosted sur le VPS Hostinger pour éliminer la dépendance à Google.

Spec : [`docs/superpowers/specs/2026-04-27-migration-firebase-supabase-design.md`](docs/superpowers/specs/2026-04-27-migration-firebase-supabase-design.md)
Plan : [`docs/superpowers/plans/2026-04-27-migration-firebase-supabase.md`](docs/superpowers/plans/2026-04-27-migration-firebase-supabase.md)

## Architecture

```
Hostinger shared (terrasse-au-soleil.fr — SPA React)
      │ HTTPS @supabase/supabase-js
      ▼
VPS Hostinger (mutualisé Iremia + Poolscore + Terrasses)
      │ Traefik (cert TLS Let's Encrypt automatique)
      ▼
Docker Compose --project-name terrasses
  ├─ Postgres 15 (volume terrasses_db_data, port 127.0.0.1:5434)
  ├─ GoTrue (Auth)
  ├─ PostgREST (REST API)
  ├─ Realtime (WebSocket — table ads)
  ├─ Storage (provisionné, pas utilisé V1)
  ├─ Edge Runtime Deno (search-terraces, live-token)
  ├─ Studio (admin UI via tunnel SSH)
  └─ Kong (API gateway → exposé via Traefik sur api.terrasse-au-soleil.fr)
```

## Repo layout

```
docker/supabase/        Overlay Docker Compose (étend l'upstream Supabase)
db/migrations/          DDL Postgres versionné (001..003)
db/tests/               Tests RLS smoke
supabase/functions/     Edge Functions Deno (multi-provider AI router + use cases)
scripts/                generate-secrets, deploy-functions, backup-now
scripts/ops/            backup-postgres (cron) — adapté d'iremia-supabase-stack
docs/                   Runbooks + spec/plan
```

## Quick links

- Production : https://api.terrasse-au-soleil.fr
- Frontend : https://terrasse-au-soleil.fr
- Pattern de référence (infra) : [iremia-supabase-stack](https://github.com/SteF69Lyon/iremia-supabase-stack)
- Pattern de référence (code Edge Functions) : [Poolscore](https://github.com/SteF69Lyon/Poolscore)

## Sécurité

⚠️ **Ne jamais committer** :
- `.env` (utiliser `.env.example` comme template)
- Clés privées (`*.key`, `*.pem`)
- Volumes Docker (`docker/volumes/`)

Le `.gitignore` couvre ces patterns mais vérifier `git status` avant chaque commit.
```

- [ ] **Step 2 : `HANDOFF.md`**

```markdown
# terrasses-supabase-stack — HANDOFF

État du repo et de la migration. Mis à jour à chaque session.

---

## État au commit initial

Repo créé conformément au plan d'implémentation [`docs/superpowers/plans/2026-04-27-migration-firebase-supabase.md`](docs/superpowers/plans/2026-04-27-migration-firebase-supabase.md).

Phases terminées dans ce repo :
- Phase 0 — Bootstrap repo
- Phase 1 — Docker overlay + .env.example + scripts/generate-secrets.sh + scripts/deploy-functions.sh
- Phase 2 — Migrations DDL 001..003 + tests RLS
- Phase 3 — Edge Functions (ai-router, search-terraces, live-token)
- Phase 4 — Scripts ops (backup) + runbooks + README

À faire :
- Phase 5 — Push GitHub + bootstrap VPS (Tasks 16-19) — **manuel SSH**
- Phase 6 — Refactor `terrasses-au-soleil/services/*` (Tasks 20-25) — **dans l'autre repo**
- Phase 7 — Cutover prod (Tasks 26-28)
- Phase 8 — Décommissionner Firebase (Tasks 29-30) à J+7
- Phase 9 — Cleanup final (Task 31) à J+30
```

- [ ] **Step 3 : Commit**

```bash
git add README.md HANDOFF.md
git commit -m "docs: complete README and HANDOFF for terrasses-supabase-stack"
```

---

## Phase 5 — Push GitHub + bootstrap VPS

### Task 16 : Push `terrasses-supabase-stack` sur GitHub

**Files:** —

- [ ] **Step 1 : Créer le repo distant via gh**

```bash
cd /c/dev/terrasses-supabase-stack
gh repo create SteF69Lyon/terrasses-supabase-stack \
  --description "Self-hosted Supabase stack for Terrasses-au-soleil — migration off Firebase" \
  --public \
  --source=. \
  --remote=origin
```

- [ ] **Step 2 : Push**

```bash
git push -u origin main
```

- [ ] **Step 3 : Vérifier**

```bash
gh repo view SteF69Lyon/terrasses-supabase-stack --web
```

---

### Task 17 : [CONSOLE] Configurer le DNS `api.terrasse-au-soleil.fr`

**Files:** — (action manuelle dans Hostinger)

- [ ] **Step 1 : Récupérer l'IP du VPS**

Depuis le panneau Hostinger ou via SSH :

```bash
ssh root@<VPS_HOSTNAME> "hostname -I | awk '{print \$1}'"
```

Noter l'IP (ex: `195.35.29.52`).

- [ ] **Step 2 : Hostinger DNS panel**

Aller sur https://hpanel.hostinger.com/ → Domains → `terrasse-au-soleil.fr` → DNS / Nameservers → ajouter :

| Type | Name | Points to | TTL |
|------|------|-----------|-----|
| A    | api  | `<VPS_IP>` | 300 |

- [ ] **Step 3 : Vérifier la propagation**

Attendre 5-10 min, puis :

```bash
dig +short api.terrasse-au-soleil.fr
# Doit retourner <VPS_IP>
```

---

### Task 18 : [VPS] Bootstrap initial sur le VPS

**Files:** — (opérations manuelles SSH)

- [ ] **Step 1 : SSH sur le VPS**

```bash
ssh root@<VPS_IP>
```

- [ ] **Step 2 : Cloner le repo + l'upstream Supabase**

```bash
mkdir -p /opt/terrasses-supabase
cd /opt/terrasses-supabase
git clone https://github.com/SteF69Lyon/terrasses-supabase-stack.git .
git clone --depth 1 https://github.com/supabase/supabase.git
```

- [ ] **Step 3 : Lier l'overlay et le .env**

```bash
cp docker/supabase/docker-compose.override.yml supabase/docker/
cp docker/supabase/.env.example supabase/docker/.env
chmod 600 supabase/docker/.env
```

- [ ] **Step 4 : Générer les secrets et les coller dans .env**

```bash
bash scripts/generate-secrets.sh
# Copier-coller manuellement chaque ligne dans supabase/docker/.env
# (à la place du __FILL_ME__ correspondant)
nano supabase/docker/.env
```

Pour `ANON_KEY` et `SERVICE_ROLE_KEY` (JWT signés), utiliser jwt.io ou une commande Node :

```bash
# Sur le VPS, après avoir mis JWT_SECRET dans le shell
export JWT_SECRET=<valeur du .env>
docker run --rm -e JWT_SECRET=$JWT_SECRET node:20-alpine sh -c '
  npm i -g jsonwebtoken-cli >/dev/null 2>&1 || npm i -g jsonwebtoken >/dev/null 2>&1
  for ROLE in anon service_role; do
    EXP=$(($(date +%s) + 315360000))  # 10 ans
    NOW=$(date +%s)
    echo "${ROLE}_KEY=$(node -e "console.log(require(\"jsonwebtoken\").sign({role: \"$ROLE\", iss: \"supabase\", iat: $NOW, exp: $EXP}, process.env.JWT_SECRET, {algorithm: \"HS256\"}))")"
  done
'
```

Coller `ANON_KEY=...` et `SERVICE_ROLE_KEY=...` dans le `.env`.

- [ ] **Step 5 : Coller les 3 clés AI providers**

Dans `supabase/docker/.env`, remplir :

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

(Récupérées depuis tes consoles Anthropic/OpenAI/Google AI Studio.)

- [ ] **Step 6 : Démarrer la stack**

```bash
cd /opt/terrasses-supabase/supabase/docker
docker compose --project-name terrasses up -d
docker compose --project-name terrasses ps
# Tous les services doivent être "Up (healthy)" après ~30s
```

- [ ] **Step 7 : Appliquer les migrations**

Le volume `../../db/migrations:/docker-entrypoint-initdb.d/migrations:ro` n'est exécuté qu'au **premier boot** de Postgres (initdb). Comme le volume est neuf, ça doit avoir tourné automatiquement. Vérifier :

```bash
docker exec -it terrasses-supabase-db psql -U supabase_admin -d postgres -c "\dt public.*"
# Doit lister profiles, ads, osm_cache
```

Si pas listées (volume préexistant) :
```bash
for f in /opt/terrasses-supabase/db/migrations/*.sql; do
  docker exec -i terrasses-supabase-db psql -U supabase_admin -d postgres < "$f"
done
```

- [ ] **Step 8 : Vérifier les logs Traefik**

```bash
docker logs root_traefik_1 --tail 30 | grep -i terrasses
# Doit montrer la création du router terrasses-api et l'obtention du cert TLS
```

- [ ] **Step 9 : Test depuis ta machine**

```bash
curl -s https://api.terrasse-au-soleil.fr/rest/v1/ \
  -H "apikey: <ANON_KEY>" | head -50
# Doit retourner le swagger OpenAPI PostgREST
```

---

### Task 19 : [VPS] Déployer les Edge Functions et smoke-tester

**Files:** — (action sur VPS)

Les Edge Functions sont déjà montées en volume (Task 18 step 7), mais il faut redémarrer le conteneur `functions` après changements ou migrations majeures.

- [ ] **Step 1 : Redémarrer**

```bash
cd /opt/terrasses-supabase/supabase/docker
docker compose --project-name terrasses restart functions
```

- [ ] **Step 2 : Smoke test `search-terraces`**

```bash
curl -s -X POST https://api.terrasse-au-soleil.fr/functions/v1/search-terraces \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"location":"Lyon","type":"bar","date":"2026-04-30","time":"18:00"}' \
  | jq '.results | length, .provider, .model'
```

Attendu : un nombre (>0 idéalement), `"anthropic"` (premier provider du fallback), un nom de modèle.

- [ ] **Step 3 : Smoke test `live-token` (sans auth → doit fail)**

```bash
curl -i -X POST https://api.terrasse-au-soleil.fr/functions/v1/live-token \
  -H "apikey: <ANON_KEY>"
# Doit renvoyer 401
```

- [ ] **Step 4 : Lancer les tests RLS**

Dans un terminal local :
```bash
# Tunnel SSH dans un terminal (à laisser ouvert)
ssh -L 5434:127.0.0.1:5434 root@<VPS_IP>
```

Dans un autre terminal local :
```bash
cd /c/dev/terrasses-supabase-stack
PGPASSWORD=<POSTGRES_PASSWORD> psql -h 127.0.0.1 -p 5434 -U postgres -d postgres \
  -f db/tests/rls_smoke.sql
# Doit afficher "✓ ALL RLS TESTS PASSED"
```

- [ ] **Step 5 : Configurer le cron de backup**

```bash
ssh root@<VPS_IP>
crontab -e
# Ajouter la ligne :
# 0 3 * * * /opt/terrasses-supabase/scripts/ops/backup-postgres.sh >> /var/log/terrasses-backup/cron.log 2>&1
mkdir -p /var/log/terrasses-backup
```

- [ ] **Step 6 : Ajouter 2 monitors Uptime Kuma**

Via l'UI Uptime Kuma (déjà déployée) :
- Monitor HTTPS : `https://api.terrasse-au-soleil.fr/rest/v1/` (interval 5 min, retry 3, alerte email `sflandrin@outlook.com`)
- Monitor HTTPS : `https://terrasse-au-soleil.fr` (interval 5 min, retry 3)

---

## Phase 6 — Refactor frontend `terrasses-au-soleil`

### Task 20 : Créer la branche et installer @supabase/supabase-js

**Files:**
- Modify: `terrasses-au-soleil/package.json`
- Create: `.env.local` (par PC, non commité)

- [ ] **Step 1 : Branche**

```bash
cd /c/dev/terrasses-au-soleil
git checkout main
git pull
git checkout -b feat/supabase-migration
```

- [ ] **Step 2 : Installer le SDK Supabase (sans encore retirer Firebase)**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 3 : Mettre à jour `.env.local`**

Éditer `/c/dev/terrasses-au-soleil/.env.local` :

```
VITE_ADMIN_EMAIL=sflandrin@outlook.com
VITE_SUPABASE_URL=https://api.terrasse-au-soleil.fr
VITE_SUPABASE_ANON_KEY=<ANON_KEY récupéré du VPS>
```

- [ ] **Step 4 : Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): install @supabase/supabase-js (firebase still in)"
```

---

### Task 21 : Refactor `dbService.ts` — auth + profiles

**Files:**
- Modify: `services/dbService.ts`

L'API publique de la classe `DatabaseService` reste **identique** (pour ne pas toucher `App.tsx` ni les composants). Seule l'implémentation change. On garde Firebase importé temporairement pour le rollback rapide (sera retiré en Phase 9).

- [ ] **Step 1 : Réécrire les imports en haut du fichier**

Remplacer les lignes 1-25 (imports Firebase) par :

```ts
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { UserProfile, EstablishmentType, Advertisement } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL ?? '').toLowerCase().trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[dbService] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing.');
}
if (!ADMIN_EMAIL) {
  console.warn('[dbService] VITE_ADMIN_EMAIL is not set — admin UI gating disabled.');
}

// Helpers de mapping snake_case (DB) ↔ camelCase (TS)
type DbProfile = {
  id: string;
  name: string;
  email: string;
  is_subscribed: boolean;
  email_notifications: boolean;
  preferred_type: string;
  preferred_sun_level: number;
  favorites: string[];
};

function dbToProfile(row: DbProfile): UserProfile {
  return {
    name: row.name,
    email: row.email,
    isSubscribed: row.is_subscribed,
    emailNotifications: row.email_notifications,
    preferredType: row.preferred_type as EstablishmentType,
    preferredSunLevel: row.preferred_sun_level,
    favorites: row.favorites,
  };
}

function profileToDb(p: Partial<UserProfile>): Partial<DbProfile> {
  const out: Partial<DbProfile> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.email !== undefined) out.email = p.email;
  if (p.isSubscribed !== undefined) out.is_subscribed = p.isSubscribed;
  if (p.emailNotifications !== undefined) out.email_notifications = p.emailNotifications;
  if (p.preferredType !== undefined) out.preferred_type = p.preferredType;
  if (p.preferredSunLevel !== undefined) out.preferred_sun_level = p.preferredSunLevel;
  if (p.favorites !== undefined) out.favorites = p.favorites;
  return out;
}
```

- [ ] **Step 2 : Réécrire la classe `DatabaseService`**

Remplacer toute la classe (lignes 43-173) par :

```ts
class DatabaseService {
  private supabase?: SupabaseClient;

  constructor() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
      console.log('Database Engine initialized (Supabase).');
    } else {
      console.warn('Supabase client not initialized — env vars missing.');
    }
  }

  onAuthChange(callback: (user: User | null) => void) {
    if (!this.supabase) return () => {};
    const { data } = this.supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
    // Initial value
    this.supabase.auth.getUser().then(({ data: { user } }) => callback(user));
    return () => data.subscription.unsubscribe();
  }

  async register(name: string, email: string, password: string): Promise<UserProfile> {
    if (!this.supabase) throw new Error('Service indisponible.');
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? 'Erreur d\'inscription');

    const newProfile: UserProfile = {
      name,
      email: data.user.email!,
      isSubscribed: false,
      emailNotifications: false,
      preferredType: EstablishmentType.ALL,
      preferredSunLevel: 20,
      favorites: [],
    };

    const { error: insertErr } = await this.supabase
      .from('profiles')
      .insert({ id: data.user.id, ...profileToDb(newProfile) });
    if (insertErr) throw new Error(insertErr.message);

    return newProfile;
  }

  async login(email: string, password: string): Promise<UserProfile> {
    if (!this.supabase) throw new Error('Service indisponible.');
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? 'Erreur de connexion');

    const profile = await this.fetchProfileByUid(data.user.id);
    return profile ?? {
      name: data.user.email?.split('@')[0] ?? 'Utilisateur',
      email: data.user.email!,
      isSubscribed: false,
      emailNotifications: false,
      preferredType: EstablishmentType.ALL,
      preferredSunLevel: 20,
      favorites: [],
    };
  }

  async logout() {
    if (this.supabase) await this.supabase.auth.signOut();
  }

  async updateProfile(uid: string, profile: UserProfile): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase
      .from('profiles')
      .update(profileToDb(profile))
      .eq('id', uid);
    if (error) console.error('Profile sync error:', error.message);
  }

  async fetchProfileByUid(uid: string): Promise<UserProfile | null> {
    if (!this.supabase) return null;
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
    if (error || !data) return null;
    return dbToProfile(data as DbProfile);
  }

  async setSubscriptionStatus(uid: string, status: boolean): Promise<void> {
    if (!this.supabase) return;
    await this.supabase.from('profiles').update({ is_subscribed: status }).eq('id', uid);
  }

  isAdmin(email?: string | null): boolean {
    return email?.toLowerCase().trim() === ADMIN_EMAIL;
  }

  // --- ads (à compléter Task 22) ---
  onAdsChange(_callback: (ads: Advertisement[]) => void) { return () => {}; }
  async addAd(_text: string, _link?: string): Promise<void> {}
  async deleteAd(_id: string): Promise<void> {}
  async toggleAdStatus(_id: string, _currentStatus: boolean): Promise<void> {}

  getSupabase() { return this.supabase; }
  getAuth() { return this.supabase?.auth; }  // back-compat avec l'ancienne API
}

export const dbService = new DatabaseService();
```

- [ ] **Step 3 : Vérifier que ça compile**

```bash
npm run build
# Attendu : build OK (pas d'erreur TS)
```

- [ ] **Step 4 : Commit**

```bash
git add services/dbService.ts
git commit -m "feat(db): refactor dbService auth + profiles to Supabase (ads stub for next task)"
```

---

### Task 22 : Refactor `dbService.ts` — ads + Realtime

**Files:**
- Modify: `services/dbService.ts`

- [ ] **Step 1 : Remplacer les 4 stubs ads par l'implémentation Supabase**

Dans `services/dbService.ts`, remplacer les 4 lignes stub (`onAdsChange`, `addAd`, `deleteAd`, `toggleAdStatus`) par :

```ts
  onAdsChange(callback: (ads: Advertisement[]) => void) {
    if (!this.supabase) return () => {};

    // Helper : recharger la liste complète depuis la DB
    const refresh = async () => {
      const { data } = await this.supabase!
        .from('ads')
        .select('id, text, link, is_active, created_at')
        .order('created_at', { ascending: false });
      const ads: Advertisement[] = (data ?? []).map((row) => ({
        id: row.id,
        text: row.text,
        link: row.link ?? undefined,
        isActive: row.is_active,
        createdAt: new Date(row.created_at).getTime(),
      }));
      callback(ads);
    };

    // Charge initiale
    refresh();

    // Realtime channel — n'importe quel changement → refresh
    const channel = this.supabase
      .channel('ads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ads' }, refresh)
      .subscribe();

    return () => {
      this.supabase!.removeChannel(channel);
    };
  }

  async addAd(text: string, link?: string): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase
      .from('ads')
      .insert({ text, link: link || null, is_active: true });
    if (error) throw new Error(error.message);
  }

  async deleteAd(id: string): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase.from('ads').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async toggleAdStatus(id: string, currentStatus: boolean): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase
      .from('ads')
      .update({ is_active: !currentStatus })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
```

- [ ] **Step 2 : Build**

```bash
npm run build
```

- [ ] **Step 3 : Commit**

```bash
git add services/dbService.ts
git commit -m "feat(db): wire ads CRUD + Realtime channel via Supabase"
```

---

### Task 23 : Service `searchService.ts` (remplace l'appel à `geminiSearch`)

**Files:**
- Create: `services/searchService.ts`
- Modify: `services/geminiService.ts` (déléguer la recherche au nouveau service)

- [ ] **Step 1 : Identifier l'appel actuel à `geminiSearch`**

Lire `services/geminiService.ts` pour repérer la fonction qui appelle `httpsCallable(functions, 'geminiSearch')`. Noter sa signature exacte.

```bash
grep -n "geminiSearch" services/geminiService.ts
```

- [ ] **Step 2 : Créer `services/searchService.ts`**

```ts
// services/searchService.ts
//
// Appelle l'Edge Function search-terraces sur Supabase et retourne les résultats
// au même format que l'ancienne Cloud Function geminiSearch.

import { Terrace } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type SearchInput = {
  location: string;
  type: string;
  date: string;
  time: string;
  lat?: number;
  lng?: number;
};

type SearchResponse = {
  results: Array<Partial<Terrace> & { id: string; name: string; lat?: number; lng?: number }>;
  sources: Array<{ title: string; uri: string }>;
  provider?: string;
  model?: string;
};

export async function searchTerraces(input: SearchInput, userJwt?: string): Promise<SearchResponse> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase env vars manquantes.');
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/search-terraces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${userJwt ?? SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`search-terraces ${res.status}: ${txt}`);
  }
  return res.json();
}
```

- [ ] **Step 3 : Modifier `geminiService.ts` pour déléguer**

Repérer la fonction qui faisait `httpsCallable('geminiSearch')(...)` et remplacer son corps par un appel à `searchTerraces` :

```ts
// services/geminiService.ts (extrait — la fonction qui faisait l'appel à geminiSearch)
import { searchTerraces } from './searchService';
import { dbService } from './dbService';

export async function searchTerracesViaGemini(/* mêmes params qu'avant */) {
  const session = await dbService.getAuth()?.getSession();
  const jwt = session?.data.session?.access_token;
  return searchTerraces({ /* mêmes paramètres */ }, jwt);
}
```

(Adapter les noms de paramètres au code existant — `grep` les call sites pour ne rien casser.)

- [ ] **Step 4 : Build**

```bash
npm run build
```

- [ ] **Step 5 : Commit**

```bash
git add services/searchService.ts services/geminiService.ts
git commit -m "feat(search): route search-terraces via Supabase Edge Function instead of Cloud Function"
```

---

### Task 24 : Service `liveTokenService.ts` (remplace l'appel à `geminiLiveToken`)

**Files:**
- Create: `services/liveTokenService.ts`
- Modify: `services/geminiService.ts` (ou le composant qui appelait `geminiLiveToken`)

- [ ] **Step 1 : Identifier l'appel actuel**

```bash
grep -rn "geminiLiveToken" services/ components/
```

- [ ] **Step 2 : Créer `services/liveTokenService.ts`**

```ts
// services/liveTokenService.ts
//
// Récupère la clé Gemini API auprès de l'Edge Function live-token (auth requise).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function fetchLiveToken(userJwt: string): Promise<{ apiKey: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase env vars manquantes.');
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/live-token`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${userJwt}`,
    },
  });
  if (res.status === 401) throw new Error('Connexion requise pour l\'assistant vocal.');
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`live-token ${res.status}: ${txt}`);
  }
  return res.json();
}
```

- [ ] **Step 3 : Remplacer l'appel `httpsCallable('geminiLiveToken')`** dans le code identifié au Step 1 par :

```ts
import { fetchLiveToken } from '../services/liveTokenService';
import { dbService } from '../services/dbService';

// dans la fonction qui demandait la clé :
const session = await dbService.getAuth()?.getSession();
const jwt = session?.data.session?.access_token;
if (!jwt) throw new Error('Connexion requise.');
const { apiKey } = await fetchLiveToken(jwt);
// utiliser apiKey comme avant
```

- [ ] **Step 4 : Build**

```bash
npm run build
```

- [ ] **Step 5 : Commit**

```bash
git add services/liveTokenService.ts services/geminiService.ts components/
git commit -m "feat(live): route live-token via Supabase Edge Function"
```

---

### Task 25 : Mettre à jour HANDOFF, .env.example et nettoyer Firebase progressivement

**Files:**
- Modify: `HANDOFF.md`
- Create: `.env.example` (à la racine de `terrasses-au-soleil`, si absent)

- [ ] **Step 1 : Créer/mettre à jour `.env.example`**

```
# Variables d'env du front Terrasses-au-soleil (post-migration Supabase)
# Copier en .env.local et remplir.

VITE_ADMIN_EMAIL=sflandrin@outlook.com
VITE_SUPABASE_URL=https://api.terrasse-au-soleil.fr
VITE_SUPABASE_ANON_KEY=eyJ...   # ANON_KEY récupérée du VPS
```

- [ ] **Step 2 : Mettre à jour `HANDOFF.md`**

Ajouter une section en haut (sous le 1er titre) :

```markdown
## 📍 État du projet — 2026-04-XX (en cours de migration)

**Migration Firebase → Supabase en cours sur la branche `feat/supabase-migration`.**

- Spec : [`docs/superpowers/specs/2026-04-27-migration-firebase-supabase-design.md`](docs/superpowers/specs/2026-04-27-migration-firebase-supabase-design.md)
- Plan : [`docs/superpowers/plans/2026-04-27-migration-firebase-supabase.md`](docs/superpowers/plans/2026-04-27-migration-firebase-supabase.md)
- Repo infra : https://github.com/SteF69Lyon/terrasses-supabase-stack

Phase 6 (refactor frontend) terminée sur la branche. Phase 7 (cutover) à venir.
```

- [ ] **Step 3 : Commit**

```bash
git add HANDOFF.md .env.example
git commit -m "docs: update HANDOFF and add .env.example for Supabase migration"
```

---

## Phase 7 — Smoke test + cutover

### Task 26 : Smoke test local — golden path complet

**Files:** —

- [ ] **Step 1 : Démarrer le dev server**

```bash
cd /c/dev/terrasses-au-soleil
npm run dev
# http://localhost:3000
```

- [ ] **Step 2 : Créer un compte de test**

Dans l'UI : « S'inscrire » → email `test-migration@example.com` / password aléatoire. Vérifier qu'aucune erreur n'apparaît dans la console.

Vérifier en DB (tunnel SSH ouvert depuis Phase 5) :
```bash
PGPASSWORD=<...> psql -h 127.0.0.1 -p 5434 -U postgres -d postgres \
  -c "select id, email, name from public.profiles where email='test-migration@example.com';"
```

- [ ] **Step 3 : Tester la recherche**

UI → Lyon, type=bar, date=demain, time=18:00 → `Rechercher`. Vérifier :
- Network tab : 1 POST vers `api.terrasse-au-soleil.fr/functions/v1/search-terraces` (200 OK)
- Résultats affichés avec valeurs de `sunExposure`
- Pas d'erreur dans la console

- [ ] **Step 4 : Tester l'assistant vocal (live)**

UI → ouvrir l'assistant vocal. Network tab : 1 POST vers `live-token` (200), puis ouverture WebSocket vers Google. Couper la connexion réseau dans devtools → l'erreur doit être gérée proprement.

- [ ] **Step 5 : Tester le panneau admin (avec ton vrai compte admin)**

> Pré-requis : avoir créé le compte admin via Studio. Si pas encore fait, ouvre Supabase Studio (tunnel SSH `ssh -L 3010:127.0.0.1:3010 root@<VPS_IP>`, puis http://127.0.0.1:3010) → Authentication → Users → Add user → `sflandrin@outlook.com` + password + Auto Confirm ✓. Insère ensuite la ligne `profiles` correspondante (cf. Task 28 step 3 pour le SQL).

Logout → Login avec `sflandrin@outlook.com`. UI admin → créer une `ad` → vérifier qu'elle s'affiche immédiatement (Realtime). Toggle / delete.

Vérifier en DB :
```bash
psql -c "select id, text, is_active from public.ads order by created_at desc limit 5;"
```

- [ ] **Step 6 : Logout + tentative d'écriture par un user normal**

Login `test-migration@example.com` → tentative de création d'ad via la console devtools :
```js
await dbService.addAd('hack');
// Doit throw : "new row violates row-level security policy"
```

✅ Si tous les tests passent, on est bon pour la prod.

---

### Task 27 : [J-1] Merger en main et configurer Hostinger env panel

**Files:** —

- [ ] **Step 1 : Récupérer les valeurs à mettre côté Hostinger**

Dans le panneau Hostinger → `terrasse-au-soleil.fr` → Hosting → Variables d'environnement (ou équivalent).

Variables à ajouter / vérifier :
- `VITE_SUPABASE_URL=https://api.terrasse-au-soleil.fr`
- `VITE_SUPABASE_ANON_KEY=<ANON_KEY>`
- `VITE_ADMIN_EMAIL=sflandrin@outlook.com` (déjà présent)

- [ ] **Step 2 : Merger la branche**

```bash
cd /c/dev/terrasses-au-soleil
git checkout main
git pull
git merge feat/supabase-migration
git push origin main
```

Hostinger auto-redéploie sur push `main`. Attendre ~2 min puis ouvrir https://terrasse-au-soleil.fr.

- [ ] **Step 3 : Vérifier en prod**

Devtools Network → la 1re requête API doit pointer sur `api.terrasse-au-soleil.fr`, pas `cloudfunctions.net`. Si encore Firebase → vérifier que le build a bien embarqué les nouvelles env vars (Hostinger panel + redéployer).

---

### Task 28 : [J-0, CONSOLE] Recréer le compte admin via Supabase Studio et re-tester en prod

**Files:** —

- [ ] **Step 1 : Ouvrir Supabase Studio via tunnel SSH**

```bash
ssh -L 3010:127.0.0.1:3010 root@<VPS_IP>
# Dans le navigateur local : http://127.0.0.1:3010
# Login avec DASHBOARD_USERNAME / DASHBOARD_PASSWORD du .env
```

- [ ] **Step 2 : Créer le compte admin**

Studio → Authentication → Users → "Add user" → "Create new user" :
- Email : `sflandrin@outlook.com`
- Password : <choisir un mot de passe robuste, le noter dans KeePass>
- Auto Confirm User : ✓

- [ ] **Step 3 : Vérifier que le profile est créé**

Studio → Table Editor → `profiles`. Si la ligne n'existe pas (le `register()` ne s'est pas joué), l'insérer manuellement :

```sql
insert into public.profiles (id, name, email)
values (
  (select id from auth.users where email='sflandrin@outlook.com'),
  'Stéphane',
  'sflandrin@outlook.com'
);
```

- [ ] **Step 4 : Re-test prod en tant qu'admin**

Sur https://terrasse-au-soleil.fr → login admin → créer une `ad` réelle → vérifier qu'elle s'affiche.

✅ **Migration en prod terminée.** À partir d'ici : on observe Uptime Kuma et logs Edge Functions pendant 7 jours.

---

## Phase 8 — Décommissionner Firebase (J+7)

### Task 29 : Supprimer Cloud Functions et durcir Firestore

**Files:** —

⚠️ **NE PAS lancer cette task avant J+7** (7 jours d'observation prod sans incident).

- [ ] **Step 1 : Supprimer les 3 Cloud Functions**

```bash
cd /c/dev/terrasses-au-soleil
firebase use terrassesausoleil
firebase functions:delete geminiSearch geminiTts geminiLiveToken --region europe-west1
# Confirmer avec yes
```

- [ ] **Step 2 : Mettre les rules Firestore en default-deny**

Éditer `firestore.rules` :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

```bash
firebase deploy --only firestore:rules
```

- [ ] **Step 3 : Commit**

```bash
git add firestore.rules
git commit -m "chore(firebase): tighten Firestore rules to default-deny (post-migration)"
git push
```

---

### Task 30 : Mettre à jour HANDOFF pour refléter le nouvel état

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1 : Réécrire la section « État du projet »**

Remplacer la section migration en cours par :

```markdown
## 📍 État du projet — 2026-XX-XX (post-migration Supabase)

✅ Migration Firebase → Supabase **terminée et stabilisée**.

- Backend : Supabase self-hosted sur VPS Hostinger via [terrasses-supabase-stack](https://github.com/SteF69Lyon/terrasses-supabase-stack)
- API : https://api.terrasse-au-soleil.fr
- 2 Edge Functions : `search-terraces` (Overpass + AI router), `live-token` (Gemini Live)
- Cloud Functions Firebase **supprimées** (J+7)
- Firestore rules en **default-deny** (J+7)
- Projet Firebase **conservé en lecture seule** jusqu'à J+30 (filet de sécurité), puis supprimé.

Le SDK `firebase` reste dans `package.json` jusqu'à la suppression définitive du projet (Task 31).
```

- [ ] **Step 2 : Commit**

```bash
git add HANDOFF.md
git commit -m "docs: HANDOFF post-migration Supabase complete"
git push
```

---

## Phase 9 — Cleanup final (J+30)

### Task 31 : Supprimer le projet Firebase et nettoyer le repo

**Files:**
- Delete: `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `.firebaserc`
- Delete: `functions/` (tout le dossier)
- Modify: `package.json` (retirer `firebase`)

⚠️ **NE PAS lancer cette task avant J+30** (30 jours d'observation, point de non-retour).

- [ ] **Step 1 : Supprimer le projet Firebase via la console**

Console Firebase → Project settings → General → bas de page → "Delete project". Confirmer le projet `terrassesausoleil`.

- [ ] **Step 2 : Nettoyer le repo**

```bash
cd /c/dev/terrasses-au-soleil
rm -rf functions/ firebase.json firestore.rules firestore.indexes.json .firebaserc
npm uninstall firebase
```

- [ ] **Step 3 : Vérifier qu'il ne reste aucun import firebase**

```bash
grep -rn "from 'firebase" services/ components/ App.tsx index.tsx 2>/dev/null
# Doit ne rien retourner
```

S'il reste des imports : les éliminer (probablement des reliquats dans `geminiService.ts`).

- [ ] **Step 4 : Build final**

```bash
npm run build
# Build doit passer, et le bundle ne doit plus contenir firebase
grep -l "firebaseapp.com\|firestore" dist/assets/*.js 2>/dev/null
# Doit ne rien retourner
```

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "chore(firebase): final removal — project deleted, deps and config cleaned up"
git push
```

- [ ] **Step 6 : Mettre à jour HANDOFF.md une dernière fois**

```markdown
## 📍 État du projet — 2026-XX-XX

Projet 100% sur Supabase self-hosted. Aucune dépendance Firebase.
```

---

## Récapitulatif

| Phase | Tasks | Lieu | Cutover Day |
|-------|-------|------|-------------|
| 0     | 1     | Local (nouveau repo) | — |
| 1     | 2-5   | Local (nouveau repo) | — |
| 2     | 6-9   | Local (nouveau repo) | — |
| 3     | 10-12 | Local (nouveau repo) | — |
| 4     | 13-15 | Local (nouveau repo) | — |
| 5     | 16-19 | GitHub + VPS | J-3 |
| 6     | 20-25 | Local (terrasses-au-soleil, branche) | J-2 |
| 7     | 26-28 | Local + prod | J-1 / J-0 |
| 8     | 29-30 | Local + Firebase | J+7 |
| 9     | 31    | Local + Firebase Console | J+30 |

**Total : 31 tasks.** Tasks 17, 18, 19, 27, 28 demandent des actions manuelles (SSH ou console web) — l'utilisateur les exécute lui-même quand il sait qu'il a accès aux credentials.

## Hors scope V1 (à traiter en follow-up)

Le spec mentionne le **rate limiting Kong** (60 req/min/IP) sur les Edge Functions pour protéger le budget LLM. Ce n'est **pas implémenté dans ce plan** car la config Kong déclarative demande un fichier `kong.yml` séparé et un test load à part. À ajouter en task isolée dès qu'un tableau de bord de coût LLM sera en place pour mesurer l'impact réel. En attendant : les alertes budgétaires côté Anthropic / OpenAI / Google AI Studio sont les garde-fous actifs.

Autres items hors scope (rappel du spec) : SMTP custom, intégration AdSense, restauration TTS, projet SEO Astro.
