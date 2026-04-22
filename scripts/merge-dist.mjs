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
