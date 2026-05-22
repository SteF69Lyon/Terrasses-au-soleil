import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

// Derive the city list directly from src/data/cities.ts so OG cards never
// drift out of sync with the real seed (this was previously a hand-copied
// 22-city array that silently went stale when the seed grew to 52).
//
// The script runs before TS transpile, so we parse the source with a regex
// rather than importing it. City entries (unlike quartier entries) always
// have a `region:` field right after `name:` — that disambiguates them.
async function loadCities() {
  const src = await readFile(path.resolve('src/data/cities.ts'), 'utf-8');
  const re = /slug:\s*'([^']+)',\s*name:\s*'([^']+)',\s*region:/g;
  const cities = [];
  for (const m of src.matchAll(re)) {
    cities.push({ slug: m[1], name: m[2] });
  }
  if (cities.length === 0) {
    throw new Error('generate-og: parsed 0 cities from src/data/cities.ts — regex drift?');
  }
  return cities;
}

const W = 1200;
const H = 630;

function escape(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSvg({ title, subtitle }) {
  const safeTitle = escape(title);
  const safeSubtitle = escape(subtitle);
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffd48a"/>
      <stop offset="55%" stop-color="#f5a623"/>
      <stop offset="100%" stop-color="#e07a15"/>
    </linearGradient>
    <radialGradient id="sun" cx="82%" cy="22%" r="32%">
      <stop offset="0%" stop-color="#fff7d8" stop-opacity="1"/>
      <stop offset="60%" stop-color="#fff7d8" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#fff7d8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#sun)"/>

  <!-- Sun emoji-like circle -->
  <circle cx="984" cy="138" r="60" fill="#fff2b0"/>
  <circle cx="984" cy="138" r="42" fill="#ffde4d"/>

  <!-- Brand -->
  <text x="80" y="120" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="38" font-weight="700" fill="#ffffff" opacity="0.95">
    ☀ terrasse-au-soleil.fr
  </text>

  <!-- Title -->
  <text x="80" y="310" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="84" font-weight="800" fill="#2a1800">
    ${safeTitle}
  </text>

  <!-- Subtitle -->
  <text x="80" y="390" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="40" font-weight="500" fill="#5a3800">
    ${safeSubtitle}
  </text>

  <!-- Bottom tagline -->
  <text x="80" y="560" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="26" font-weight="500" fill="#2a1800" opacity="0.75">
    Le café au soleil, sans l'ombre d'un doute.
  </text>
</svg>`;
}

async function renderPng(svg) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { loadSystemFonts: true },
  });
  return Buffer.from(resvg.render().asPng());
}

async function main() {
  const outDir = path.resolve('public/og');
  await mkdir(outDir, { recursive: true });

  const cities = await loadCities();

  // Default (landing)
  {
    const svg = buildSvg({
      title: 'Terrasses au soleil',
      subtitle: 'Trouvez la terrasse ensoleillée parfaite en France',
    });
    const png = await renderPng(svg);
    await writeFile(path.join(outDir, 'default.png'), png);
    console.log('✓ public/og/default.png');
  }

  for (const city of cities) {
    const svg = buildSvg({
      title: `Terrasses ensoleillées`,
      subtitle: `à ${city.name}`,
    });
    const png = await renderPng(svg);
    await writeFile(path.join(outDir, `${city.slug}.png`), png);
    console.log(`✓ public/og/${city.slug}.png`);
  }

  console.log(`\nGenerated ${cities.length + 1} OG cards in public/og/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
