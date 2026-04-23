import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

// Re-implementing the cities seed here (script runs before TS transpile).
// Must stay in sync with src/data/cities.ts — keep slugs + display names aligned.
const CITIES = [
  { slug: 'paris', name: 'Paris' },
  { slug: 'lyon', name: 'Lyon' },
  { slug: 'marseille', name: 'Marseille' },
  { slug: 'bordeaux', name: 'Bordeaux' },
  { slug: 'toulouse', name: 'Toulouse' },
  { slug: 'nice', name: 'Nice' },
  { slug: 'nantes', name: 'Nantes' },
  { slug: 'strasbourg', name: 'Strasbourg' },
  { slug: 'lille', name: 'Lille' },
  { slug: 'montpellier', name: 'Montpellier' },
  { slug: 'rennes', name: 'Rennes' },
  { slug: 'annecy', name: 'Annecy' },
  { slug: 'aix-en-provence', name: 'Aix-en-Provence' },
  { slug: 'biarritz', name: 'Biarritz' },
  { slug: 'la-rochelle', name: 'La Rochelle' },
  { slug: 'grenoble', name: 'Grenoble' },
  { slug: 'clermont-ferrand', name: 'Clermont-Ferrand' },
  { slug: 'dijon', name: 'Dijon' },
  { slug: 'tours', name: 'Tours' },
  { slug: 'angers', name: 'Angers' },
  { slug: 'reims', name: 'Reims' },
  { slug: 'le-havre', name: 'Le Havre' },
];

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

  for (const city of CITIES) {
    const svg = buildSvg({
      title: `Terrasses ensoleillées`,
      subtitle: `à ${city.name}`,
    });
    const png = await renderPng(svg);
    await writeFile(path.join(outDir, `${city.slug}.png`), png);
    console.log(`✓ public/og/${city.slug}.png`);
  }

  console.log(`\nGenerated ${CITIES.length + 1} OG cards in public/og/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
