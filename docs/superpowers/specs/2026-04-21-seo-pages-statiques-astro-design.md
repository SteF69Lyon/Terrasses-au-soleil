# SEO : pages statiques Astro pour trafic AdSense — design

**Date :** 2026-04-21
**Objectif métier :** Générer du trafic organique sur `terrasse-au-soleil.fr` pour monétiser via AdSense. L'app actuelle est une SPA React rendue côté client — indexation quasi nulle. On ajoute une couche de pages statiques SEO sans casser l'existant.

## Contexte

- App existante : React/Vite déployée sur Hostinger via auto-deploy GitHub push `main`.
- Backend : Firebase (Cloud Functions en `europe-west1`, Firestore, Auth).
- La sécurisation Gemini/Firebase vient d'être terminée (branche `claude/musing-cartwright-e84790` mergée sur `main`).
- Audience : francophone, France métropolitaine.

## Approche retenue

**Hybride incrémentale** : on ajoute Astro au repo sans migrer la SPA. Astro génère des pages HTML statiques au build pour les routes SEO, la SPA reste telle quelle pour la recherche interactive. Un seul `dist/` fusionné est déployé sur Hostinger.

**Source de données : OpenStreetMap (Overpass API) + Gemini.** OSM fournit les vraies adresses, coordonnées, types d'établissement. Gemini ajoute l'analyse d'ensoleillement (différenciation vs Google Maps) et rédige l'intro unique de chaque page.

## Architecture repo

```
terrasses-au-soleil/
├── astro.config.mjs              (NEW)
├── src/
│   ├── pages/
│   │   ├── index.astro           (landing statique avec CTA vers /app)
│   │   ├── terrasses/
│   │   │   ├── [ville]/
│   │   │   │   ├── index.astro   (aperçu ville)
│   │   │   │   └── [quartier].astro
│   │   ├── bar-ensoleille-[ville].astro
│   │   ├── cafe-terrasse-[ville].astro
│   │   ├── restaurant-terrasse-[ville].astro
│   │   └── ou-boire-un-verre-au-soleil-[ville].astro
│   ├── data/
│   │   └── cities.ts             (seed villes/quartiers avec bounding boxes)
│   ├── lib/
│   │   ├── osm.ts                (client Overpass)
│   │   ├── gemini.ts             (analyse ensoleillement + intros)
│   │   └── cache.ts              (Firestore cache wrapper)
│   └── components/
│       ├── TerraceCard.astro
│       ├── MiniMap.astro         (Leaflet)
│       └── Breadcrumb.astro
├── app/                          (NEW — contient la SPA Vite actuelle)
│   ├── App.tsx
│   ├── components/
│   ├── services/
│   ├── vite.config.ts
│   └── package.json              (extrait de la racine)
├── functions/                    (inchangé)
├── firestore.rules
├── firebase.json
├── package.json                  (racine = Astro + script pour builder l'app)
└── HANDOFF.md
```

La SPA React devient `/app/` (sous-projet Vite) et sera accessible au runtime sur `/app`. L'URL racine `/` sert désormais une landing Astro statique qui présente le concept + bouton "Trouver une terrasse au soleil" → lien vers `/app`. Les utilisateurs qui bookmark `/` continuent de voir quelque chose de pertinent (et de mieux : une vraie home SEO au lieu d'un bundle JS).

**Build final :**
1. `cd app && npm run build` → produit `app/dist/`
2. `npm run build` (à la racine) → Astro produit `dist/` avec toutes les pages SEO
3. Script post-build copie `app/dist/` vers `dist/app/`
4. Résultat : `dist/` contient toutes les pages Astro + le bundle SPA dans `dist/app/`
5. Hostinger déploie `dist/`

## Contenu d'une page type

Exemple canonique : `/terrasses/lyon/croix-rousse`.

1. **`<head>`**
   - `<title>` : "Terrasses ensoleillées Croix-Rousse Lyon — Terrasses au soleil"
   - `<meta name="description">` : 150-160 caractères, unique par page, généré au build
   - `<link rel="canonical">` : URL absolue
   - OpenGraph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type=website`)
   - Twitter Card (`summary_large_image`)
   - JSON-LD : `BreadcrumbList` + `ItemList` de `LocalBusiness`

2. **`<body>`**
   - Header partagé (logo + nav minimale + lien `/app`)
   - Breadcrumb visible : Accueil › Terrasses › Lyon › Croix-Rousse
   - H1 : "Terrasses ensoleillées à la Croix-Rousse, Lyon"
   - Intro (150-200 mots, unique par page, générée par Gemini au premier build et cachée)
   - **Ad slot 1** (in-article, responsive)
   - Liste des 10-15 meilleures terrasses :
     - Nom en `<h2>`
     - Adresse, type (bar/café/restaurant)
     - Badge "Ensoleillement : X%" (score Gemini)
     - Analyse soleil en 1-2 phrases (orientation rue + heure type)
     - Boutons : Google Maps, site web si dispo dans OSM
   - **Ad slot 2** (after 3rd result)
   - Mini-carte Leaflet avec markers des terrasses (lazy-loaded, ne bloque pas le rendering)
   - **Ad slot 3** (after 10th result)
   - Section "Autres quartiers de Lyon" : 5 liens internes vers `/terrasses/lyon/<autre>`
   - CTA final : "Affiner la recherche en temps réel →" lien vers `/app?city=lyon&area=croix-rousse`
   - FAQ générée par Gemini (3-5 questions type "Quelles terrasses sont ouvertes le dimanche ?") — balisée `FAQPage` pour rich snippet
   - Footer

## Pipeline de données

### Seed initial (`src/data/cities.ts`)

```ts
export const CITIES: City[] = [
  {
    slug: 'paris',
    name: 'Paris',
    quartiers: [
      { slug: 'marais', name: 'Marais', bbox: [...] },
      { slug: '11e', name: '11e arrondissement', bbox: [...] },
      // ...
    ],
  },
  // ...
];
```

Coordonnées initiales des bounding boxes des quartiers : **résolues automatiquement au premier build via Nominatim** (API de géocodage d'OSM, gratuite, 1 req/s), puis cachées dans Firestore `cityGeo/<ville>-<quartier>` (TTL infini — les quartiers ne bougent pas). Le seed ne contient que les slugs et noms affichés.

### Au build Astro

Pour chaque page :

1. **Cache Firestore** `osmCache/{ville}-{quartier}` (TTL 30 jours) :
   - Si frais → réutiliser.
   - Sinon → requête Overpass :
     ```
     [out:json][timeout:25];
     (
       node["amenity"~"cafe|bar|restaurant"]["outdoor_seating"="yes"]({{bbox}});
       way["amenity"~"cafe|bar|restaurant"]["outdoor_seating"="yes"]({{bbox}});
     );
     out center tags;
     ```
     Throttle 1 req/sec pour respecter l'etiquette Overpass. Stockage Firestore.

2. **Cache Firestore** `sunScores/{osmId}` (TTL 90 jours) :
   - Pour chaque établissement sans score cached : appel Gemini avec prompt :
     > "L'établissement {name} est situé {adresse}, coordonnées {lat},{lng}. Quelle est l'orientation probable de sa terrasse, et le pourcentage d'ensoleillement à 17h un jour d'été ? Réponds en JSON : {sunPercent: number, orientation: string, analysis: string}."
   - Throttle 500ms entre appels (free tier Gemini = 15 RPM = 1 req/4s en production, on peut grouper en batch de 10).
   - Stockage Firestore.

3. **Cache Firestore** `pageIntros/{ville}-{quartier}` (TTL 180 jours) :
   - Si pas d'intro cached : Gemini génère 150-200 mots.
   - Stockage.

4. **Cache Firestore** `pageFaqs/{ville}-{quartier}` (TTL 180 jours) : idem pour les 3-5 Q/R de la section FAQ.

5. Astro assemble la page, génère le HTML.

### Rebuild

- **Manuel** : `npm run build` à la racine.
- **Planifié** : GitHub Action cron mensuel (`0 3 1 * *`) qui `git commit --allow-empty "chore: monthly rebuild"` et push sur `main` → déclenche le déploiement Hostinger.
- Les caches empêchent les régénérations inutiles.

### Coûts estimés (première génération complète, 450 pages)

- **Overpass** : ~450 requêtes, gratuit (respect du rate limit).
- **Gemini intros** : 450 appels.
- **Gemini FAQ** : 450 appels.
- **Gemini sun scores** : ~450 × 15 = 6750 appels au premier build, cache à 90 jours donc quasi zéro aux rebuilds suivants.
- **Firestore writes** : ~8000, reads comparables → ~quelques dizaines de MB/mois, très en-dessous du free tier.

Total premier build : ~7600 appels Gemini. À 15 RPM = ~8h de build, trop long. **Option de contournement** : batch les sun scores par appel (un prompt = 10 établissements en un coup). Passe à ~680 appels = ~45min. Acceptable pour un run mensuel manuel.

## URL structure (V1)

- `/` — landing Astro (remplace la SPA racine)
- `/app` — SPA recherche interactive
- `/terrasses/<ville>/` — aperçu ville (30 pages)
- `/terrasses/<ville>/<quartier>/` — quartier (5 villes × ~10 quartiers = ~50 pages — on garde ce nombre contrôlé au départ, scope C complet attaqué dans les semaines suivantes une fois V1 validé par Google)
- `/bar-ensoleille-<ville>/` — variation lexicale type (30 pages)
- `/cafe-terrasse-<ville>/` (30 pages)
- `/restaurant-terrasse-<ville>/` (30 pages)
- `/ou-boire-un-verre-au-soleil-<ville>/` (30 pages)
- `/sitemap.xml` — généré par `@astrojs/sitemap`
- `/robots.txt`

**Total V1 : ~200 pages réellement générées au premier déploiement**, extensibles à 450+ via ajout progressif de quartiers dans `cities.ts` après validation d'indexation. On privilégie une montée en charge contrôlée pour éviter le red flag "spam massif" auprès de Google.

Cette nuance par rapport au "500+ pages d'un coup" est importante et documentée ici pour que le plan d'implémentation la reflète — on peut ajouter des quartiers en 1 commit ultérieur sans rework.

## Rich snippets et partage social

### Par page

```jsonld
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "itemListElement": [...]
    },
    {
      "@type": "WebPage",
      "name": "...",
      "description": "...",
      "about": { "@type": "Place", "name": "Croix-Rousse, Lyon" }
    },
    {
      "@type": "ItemList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "item": {
            "@type": "Restaurant",
            "name": "...",
            "address": "...",
            "geo": { "@type": "GeoCoordinates", "latitude": ..., "longitude": ... }
          }
        }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [...]
    }
  ]
}
```

### OG images

V1 : une image statique générique (`/og-default.jpg`) par type de page (ville, quartier, variation lexicale) → 4 variantes suffisent pour le MVP.
V2 : génération dynamique par ville au build (Satori ou canvas). Hors scope ici.

## SEO opérationnel

- `robots.txt` autorise tout (sauf `/app/` pour éviter que Google indexe la SPA client-side et publie des pages mal rendues).
- `sitemap.xml` listant toutes les pages statiques.
- Soumission manuelle à Google Search Console et Bing Webmaster Tools (hors code, action manuelle post-déploiement).
- Balise `<link rel="alternate" hreflang="fr">` sur toutes les pages.

## Emplacements AdSense

Sur chaque page de listing :
- Slot 1 : in-article, après l'intro (responsive, pas de fixed size)
- Slot 2 : in-feed, après la 3e terrasse
- Slot 3 : in-feed, après la 10e terrasse
- Slot 4 : responsive en sidebar desktop (sticky), invisible mobile

Tous via le composant `<AdSlot client="ca-pub-XXX" slot="YYY" />`. Pas d'interstitiels, pas d'overlays. Respect strict des guidelines AdSense pour éviter banissement.

Les IDs AdSense `client` et `slot` seront fournis par l'utilisateur après validation du compte AdSense (hors scope du plan technique).

## Hors scope V1

- OG images dynamiques par ville
- Avis / UGC utilisateurs
- Pages saisonnières (`/terrasses-hiver-<ville>`)
- Blog éditorial
- Migration complète de la SPA vers Astro
- Optim du bundle Vite (964 kB) — chantier séparé
- i18n (EN, ES, IT) — V3 si trafic justifie
- Internationalisation des villes (Barcelone, Rome, Lisbonne…) — V3

## Risques identifiés

1. **SPA déplacée de `/` vers `/app`** : tout lien extérieur vers `terrasse-au-soleil.fr` qui attendait la SPA va atterrir sur la landing Astro. Si Google a déjà indexé `/` comme SPA, on pourrait voir une régression temporaire. Mitigation : la nouvelle `/` est du contenu SEO-friendly, donc en absolu c'est un gain. Surveiller Search Console sur 2-3 semaines.
2. **Quotas Overpass** : Overpass a un rate limit serveur partagé. À 450 requêtes espacées de 1s, ~8min de build. Acceptable. Mitigation : cache Firestore 30 jours.
3. **Qualité des données OSM** : variable selon la ville. Le tag `outdoor_seating=yes` n'est pas toujours renseigné, on risque des pages maigres. Mitigation : fallback sans ce filtre (tous les cafés/bars/restos) + Gemini vérifie dans son prompt si l'établissement a vraisemblablement une terrasse.
4. **Contenu purement AI-généré** : Google peut pénaliser si l'intro Gemini est générique. Mitigation : le prompt intègre des coordonnées précises, orientation des rues principales, nom du quartier → contenu unique factuellement ancré. Pas de rédaction "fluff".
5. **AdSense refus d'approbation** : Google AdSense scanne avant approbation. Si les pages sont trop minces ou trop AI, refus possible. Mitigation : ne pas activer AdSense avant d'avoir au moins 30-50 pages en prod et quelques semaines d'indexation. Le code `<AdSlot>` reste invisible tant que les IDs ne sont pas fournis.

## Dépendances nouvelles

- `astro@latest`
- `@astrojs/react` (intégration React pour les "islands")
- `@astrojs/sitemap`
- `@astrojs/mdx` (pour la landing et éventuel contenu éditorial)
- `leaflet` + `react-leaflet` (déjà utilisé dans la SPA ? à vérifier)

Racine `package.json` devient un Astro project. L'ancien `package.json` de la SPA est déplacé dans `app/package.json`.

## Critères de succès V1

- Build complet sans erreur en < 15 minutes
- Toutes les pages statiques passent l'inspection Google Rich Results Test
- `sitemap.xml` valide et soumis
- Lighthouse SEO ≥ 95 sur 5 pages échantillon
- Au moins 20 pages indexées par Google 3 semaines après soumission du sitemap
- Zéro régression sur l'app `/app` (tests manuels : recherche, TTS, live assistant)
