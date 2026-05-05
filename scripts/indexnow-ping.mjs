// Ping IndexNow with all URLs from dist/sitemap-0.xml after a deploy.
// IndexNow (https://www.indexnow.org/) is a protocol supported by Bing,
// Yandex, Naver, Seznam, and used as a discovery signal by Google. One ping
// here triggers fresh crawls across all those engines.
//
// Run AFTER `npm run build` so dist/sitemap-0.xml is up-to-date.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KEY = '6b7fbf92dd94f2f235aff2f92f3c8e8f';
const HOST = 'terrasse-au-soleil.fr';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP_PATH = join(process.cwd(), 'dist', 'sitemap-0.xml');
const ENDPOINT = 'https://api.indexnow.org/indexnow';

if (!existsSync(SITEMAP_PATH)) {
  console.warn(`[indexnow] no sitemap at ${SITEMAP_PATH}, skipping ping`);
  process.exit(0);
}

const xml = readFileSync(SITEMAP_PATH, 'utf-8');
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

if (urls.length === 0) {
  console.warn('[indexnow] sitemap parsed but 0 URLs found, skipping');
  process.exit(0);
}

console.log(`[indexnow] pinging ${urls.length} URLs to ${ENDPOINT}`);

const body = {
  host: HOST,
  key: KEY,
  keyLocation: KEY_LOCATION,
  urlList: urls,
};

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const text = await res.text().catch(() => '');
// IndexNow returns 200 (accepted) or 202 (accepted, processing async) on
// success. 4xx/5xx mean the protocol rejected the request — log but don't
// fail the build, since the deploy itself was successful.
if (res.ok || res.status === 202) {
  console.log(`[indexnow] OK — ${res.status} (${urls.length} URLs submitted)`);
} else {
  console.warn(
    `[indexnow] ping failed ${res.status} — ${text.slice(0, 300)}\n` +
      `(deploy succeeded, this is non-fatal)`,
  );
}
