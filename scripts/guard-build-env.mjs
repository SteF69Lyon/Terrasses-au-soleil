// Guard against Hostinger's auto-build clobbering production.
//
// Hostinger watches the GitHub repo and runs `npm run build` on every merge
// to main. It does NOT have access to ANTHROPIC_API_KEY / SUPABASE_URL etc.
// (those secrets live only in GitHub Actions), so its Astro build skips the
// ~330 dynamic city / variation / quartier pages but still produces a partial
// dist/. Hostinger then uploads that partial dist over the live webroot,
// silently wiping the 330 SEO pages — exactly the catastrophe we observed
// on 2026-05-05 around 13:40 UTC.
//
// The real, full build runs in GitHub Actions and deploys via FTPS afterwards.
// So `npm run build` must hard-fail anywhere that ISN'T GitHub Actions, to
// signal to the Hostinger build runner that there is nothing to deploy.
//
// GitHub Actions sets GITHUB_ACTIONS=true automatically. Local devs running
// `npm run build` should set BUILD_ALLOW_LOCAL=1 if they really mean to.

if (process.env.GITHUB_ACTIONS === 'true') {
  // Real CI build — let it through.
  process.exit(0);
}

if (process.env.BUILD_ALLOW_LOCAL === '1') {
  console.log('[guard] BUILD_ALLOW_LOCAL=1 — running build locally as requested');
  process.exit(0);
}

console.error(`
[guard] Refusing to run \`npm run build\` outside GitHub Actions.

  Why: the full build needs ANTHROPIC_API_KEY / OPENAI_API_KEY /
  SUPABASE_* secrets that only the GitHub Actions runner has. Running
  here would produce a partial dist/ — and on Hostinger's auto-build
  runner that partial dist would be uploaded over the live webroot,
  wiping the ~330 dynamic SEO pages.

  Local dev:    npm run dev          (Astro dev server, no build)
  Local build:  BUILD_ALLOW_LOCAL=1 npm run build
  CI build:     handled automatically by .github/workflows/deploy.yml
`);
process.exit(1);
