// Route + POI data for the SaBlava Kayak app.
//
// Two routes match Paper artboard 9UR-0 ("2 - See routes"):
//   - sud  → "Sud-Cova d'en Gispert" (south, sea caves)
//   - nord → "Nord-Fornells"         (north, cliffs toward Fornells)
//
// POI lists, geometry, and `conditions` thresholds are preserved from the
// Phase-1 dataset so later screens (route detail, POI detail) still have
// something to render. Coordinates are approximate hand-tuned around
// Aiguablava.

// 9 POIs for the Sud route, matching Paper artboard AZH-0 / AQB-0.
// Only POI 4 (Cova d'en Gispert) carries a rich description — the rest use
// the Paper placeholder ("Això es una descripció del primer punt.") via the
// "poi.description.placeholder" i18n key. `description: null` signals the
// renderer to fall back to that key.
const PLACEHOLDER_DESCRIPTION = null;

const POIS_SUD = [
  {
    id: "platja-aiguablava",
    type: "platja",
    typeIcon: "🏖",
    minutesFromStart: 0,
    coords: [3.2155, 41.9326],
    depthM: 2,
    shade: "matí",
    snorkel: 3,
    accessibility: "kayak,peu,cotxe",
    name: {
      ca: "Platja d'Aiguablava",
      es: "Playa de Aiguablava",
      en: "Aiguablava Beach",
      fr: "Plage d'Aiguablava",
    },
    description: PLACEHOLDER_DESCRIPTION,
    images: ["./assets/illustrations/aiguablava-paint.jpg"],
  },
  {
    id: "cala-ses-herbes",
    type: "cala",
    typeIcon: "🏖",
    minutesFromStart: 20,
    coords: [3.2178, 41.9333],
    depthM: 3,
    shade: "matí",
    snorkel: 3,
    accessibility: "kayak",
    name: {
      ca: "Cala de Ses Herbes",
      es: "Cala de Ses Herbes",
      en: "Ses Herbes Cove",
      fr: "Crique de Ses Herbes",
    },
    description: PLACEHOLDER_DESCRIPTION,
    images: ["./assets/illustrations/ses-herbes-paint.jpg"],
  },
  {
    id: "cala-des-tramadiu",
    type: "cala",
    typeIcon: "🏖",
    minutesFromStart: 40,
    coords: [3.219, 41.9335],
    depthM: 4,
    shade: "migdia",
    snorkel: 4,
    accessibility: "kayak",
    name: {
      ca: "Cala des Tramadiu",
      es: "Cala des Tramadiu",
      en: "Tramadiu Cove",
      fr: "Crique du Tramadiu",
    },
    description: PLACEHOLDER_DESCRIPTION,
    images: ["./assets/illustrations/cala-des-tramadiu-paint.jpg"],
  },
  {
    id: "cova-gispert",
    type: "cova",
    typeIcon: "🕳",
    minutesFromStart: 60,
    coords: [3.2208, 41.9337],
    depthM: 6,
    shade: "tot el dia",
    snorkel: 5,
    accessibility: "kayak",
    name: {
      ca: "Cova d'en Gispert",
      es: "Cueva d'en Gispert",
      en: "Gispert's Cave",
      fr: "Grotte d'en Gispert",
    },
    description: {
      ca: "Una cova marina de 18 metres de fondària amb sostre baix i aigua maragda dins. Entra a poc a poc i mantén el caiac al centre del túnel. Vigila amb les onades a la boca de la cova.",
      es: "Una cueva marina de 18 metros de profundidad con techo bajo y agua esmeralda. Entra despacio y mantén el kayak en el centro del túnel. Cuidado con el oleaje a la entrada.",
      en: "An 18-metre sea cave with low ceiling and emerald water inside. Enter slowly and keep the kayak centered. Watch the swell at the entrance.",
      fr: "Une grotte marine de 18 mètres au plafond bas et à l'eau émeraude. Entre doucement, garde le kayak au centre. Attention à la houle à l'entrée.",
    },
    images: ["./assets/illustrations/cova-gispert-paint.jpg"],
  },
  {
    id: "cova-bisbe",
    type: "cova",
    typeIcon: "🕳",
    minutesFromStart: 80,
    coords: [3.2225, 41.9339],
    depthM: 7,
    shade: "tot el dia",
    snorkel: 4,
    accessibility: "kayak",
    name: {
      ca: "Cova del Bisbe",
      es: "Cueva del Bisbe",
      en: "Bishop's Cave",
      fr: "Grotte de l'Évêque",
    },
    description: PLACEHOLDER_DESCRIPTION,
    images: ["./assets/illustrations/cova-bisbe-paint.jpg"],
  },
  {
    id: "cova-gavina",
    type: "cova",
    typeIcon: "🕳",
    minutesFromStart: 100,
    coords: [3.224, 41.9341],
    depthM: 6,
    shade: "tot el dia",
    snorkel: 4,
    accessibility: "kayak",
    name: {
      ca: "Cova de la Gavina",
      es: "Cueva de la Gaviota",
      en: "Seagull Cave",
      fr: "Grotte de la Mouette",
    },
    description: PLACEHOLDER_DESCRIPTION,
    images: ["./assets/illustrations/cova-gavina-paint.jpg"],
  },
  {
    id: "reg-arbres",
    type: "snorkel",
    typeIcon: "🤿",
    minutesFromStart: 120,
    coords: [3.2258, 41.9343],
    depthM: 8,
    shade: "tarda",
    snorkel: 5,
    accessibility: "kayak",
    name: {
      ca: "Reg del Arbres",
      es: "Reg del Arbres",
      en: "Reg del Arbres",
      fr: "Reg del Arbres",
    },
    description: PLACEHOLDER_DESCRIPTION,
    images: ["./assets/illustrations/reg-arbres-paint.jpg"],
  },
  {
    id: "cala-marquesa",
    type: "cala",
    typeIcon: "🏖",
    minutesFromStart: 140,
    coords: [3.2275, 41.9346],
    depthM: 4,
    shade: "matí",
    snorkel: 4,
    accessibility: "kayak,peu",
    name: {
      ca: "Cala Marquesa",
      es: "Cala Marquesa",
      en: "Marquesa Cove",
      fr: "Crique Marquesa",
    },
    description: PLACEHOLDER_DESCRIPTION,
    images: ["./assets/illustrations/cala-marquesa-paint.jpg"],
  },
  {
    id: "aigua-xelida",
    type: "cala",
    typeIcon: "🏖",
    minutesFromStart: 160,
    coords: [3.229, 41.9349],
    depthM: 5,
    shade: "matí",
    snorkel: 4,
    accessibility: "kayak",
    name: {
      ca: "Aigua Xelida",
      es: "Aigua Xelida",
      en: "Aigua Xelida",
      fr: "Aigua Xelida",
    },
    description: PLACEHOLDER_DESCRIPTION,
    images: ["./assets/illustrations/aigua-xelida-paint.jpg"],
  },
];

const POIS_NORD = [
  {
    id: "far-aiguablava",
    type: "mirador",
    typeIcon: "🗼",
    minutesFromStart: 25,
    coords: [3.217, 41.9298],
    depthM: 7,
    shade: "no",
    snorkel: 3,
    accessibility: "kayak",
    name: {
      ca: "Far d'Aiguablava",
      es: "Faro de Aiguablava",
      en: "Aiguablava Lighthouse",
      fr: "Phare d'Aiguablava",
    },
    description: {
      ca: "El far d'Aiguablava domina el cap des de 35 metres d'alçada. Vista en picat sobre el caiac — moment ideal per fer una foto.",
      es: "El faro domina el cabo desde 35 metros de altura. Vista en picado sobre el kayak — momento ideal para una foto.",
      en: "The lighthouse stands 35m above the cape. Dramatic view down to the kayak — prime photo moment.",
      fr: "Le phare domine le cap à 35m. Vue plongeante sur le kayak — moment photo idéal.",
    },
    images: [
      "./assets/illustrations/reg-arbres-paint.jpg",
      "./assets/illustrations/cala-marquesa-paint.jpg",
    ],
  },
  {
    id: "penya-cap-blanc",
    type: "penya",
    typeIcon: "🪨",
    minutesFromStart: 60,
    coords: [3.219, 41.9268],
    depthM: 18,
    shade: "matí",
    snorkel: 4,
    accessibility: "kayak",
    name: {
      ca: "Penya-segats de Cap Blanc",
      es: "Acantilados de Cap Blanc",
      en: "Cap Blanc Cliffs",
      fr: "Falaises du Cap Blanc",
    },
    description: {
      ca: "Els penya-segats de Cap Blanc cauen 60 metres fins al mar. Pala suau i mantén distància de 8 metres a la paret — hi ha desprenirments ocasionals.",
      es: "Los acantilados de Cap Blanc caen 60 metros hasta el mar. Palada suave y mantén 8m de distancia — hay desprendimientos ocasionales.",
      en: "The Cap Blanc cliffs drop 60m to the sea. Easy paddling, keep 8m off the wall — occasional rockfall.",
      fr: "Les falaises du Cap Blanc plongent à 60m. Pagaie souple, garde 8m de distance — chutes de pierres occasionnelles.",
    },
    images: [
      "./assets/illustrations/cala-marquesa-paint.jpg",
      "./assets/illustrations/cova-bisbe-paint.jpg",
    ],
  },
  {
    id: "tres-forats",
    type: "cova",
    typeIcon: "🕳",
    minutesFromStart: 95,
    coords: [3.2212, 41.9239],
    depthM: 9,
    shade: "tot el dia",
    snorkel: 5,
    accessibility: "kayak",
    name: {
      ca: "Cova dels Tres Forats",
      es: "Cueva de los Tres Agujeros",
      en: "Three Holes Cave",
      fr: "Grotte des Trois Trous",
    },
    description: {
      ca: "Tres entrades naturals il·luminen una cambra interior de 12 metres d'amplada. Llum blava espectacular cap a les 11 del matí. Entra només amb mar plana.",
      es: "Tres entradas naturales iluminan una cámara de 12 metros. Luz azul espectacular hacia las 11 de la mañana. Entrar solo con mar en calma.",
      en: "Three natural openings light up a 12m chamber. Spectacular blue light around 11am. Only enter on flat sea.",
      fr: "Trois ouvertures naturelles illuminent une chambre de 12m. Lumière bleue spectaculaire vers 11h. Entrer uniquement par mer calme.",
    },
    images: [
      "./assets/illustrations/cova-gavina-paint.jpg",
      "./assets/illustrations/cova-bisbe-paint.jpg",
    ],
  },
  {
    id: "cala-aiguafreda",
    type: "cala",
    typeIcon: "🏖",
    minutesFromStart: 130,
    coords: [3.2238, 41.9213],
    depthM: 3,
    shade: "matí",
    snorkel: 4,
    accessibility: "kayak,peu",
    name: {
      ca: "Cala Aiguafreda",
      es: "Cala Aiguafreda",
      en: "Aiguafreda Cove",
      fr: "Crique d'Aiguafreda",
    },
    description: {
      ca: "Cala recòndita de pedres rodones i aigua glacial — d'aquí el nom. Pausa obligada a meitat de la ruta. Hi ha una font d'aigua dolça al penya-segat est.",
      es: "Cala recóndita de cantos rodados y agua helada — de ahí el nombre. Parada obligada a mitad de la ruta. Hay una fuente de agua dulce en el acantilado este.",
      en: "Hidden cove with rounded pebbles and ice-cold water — hence the name. A must-stop midway. Freshwater spring on the eastern cliff.",
      fr: "Crique cachée aux galets ronds et eau glacée — d'où le nom. Halte obligatoire. Source d'eau douce sur la falaise est.",
    },
    images: [
      "./assets/illustrations/aigua-xelida-paint.jpg",
      "./assets/illustrations/cala-des-tramadiu-paint.jpg",
    ],
  },
  {
    id: "fornells",
    type: "port",
    typeIcon: "⚓",
    minutesFromStart: 165,
    coords: [3.2262, 41.9201],
    depthM: 22,
    shade: "no",
    snorkel: 2,
    accessibility: "kayak",
    name: {
      ca: "Fornells",
      es: "Fornells",
      en: "Fornells",
      fr: "Fornells",
    },
    description: {
      ca: "Punt més extrem de la ruta — el petit port de Fornells. Mar oberta cap a llevant. Tomba i torna cap al moll; el viatge de tornada té el vent a favor en general.",
      es: "El punto más extremo de la ruta — el pequeño puerto de Fornells. Mar abierta al este. Da la vuelta — el viaje de regreso suele tener viento a favor.",
      en: "The furthest point — the small harbour of Fornells. Open sea to the east. Turn back — the return leg usually has tailwind.",
      fr: "Le point le plus éloigné — le petit port de Fornells. Mer ouverte vers l'est. Demi-tour — le retour est généralement vent arrière.",
    },
    images: [
      "./assets/illustrations/reg-arbres-paint.jpg",
      "./assets/illustrations/aiguablava-paint.jpg",
    ],
  },
];

export const ROUTES = [
  {
    id: "sud",
    name: {
      ca: "Sud-Cova d'en Gispert",
      es: "Sur-Cova d'en Gispert",
      en: "South-Cova d'en Gispert",
      fr: "Sud-Cova d'en Gispert",
    },
    tagline: {
      ca: "Del moll a les coves de Cap Blanc.",
      es: "Del muelle a las cuevas de Cap Blanc.",
      en: "From the jetty to the Cap Blanc sea caves.",
      fr: "Du ponton aux grottes du Cap Blanc.",
    },
    description: {
      ca: "Això es una descripció breu de la ruta A.",
      es: "Esta es una descripción breve de la ruta A.",
      en: "This is a short description of route A.",
      fr: "Ceci est une brève description de la route A.",
    },
    color: "#1B6B8A",
    distanceKm: 4.2,
    durationHours: 2,
    difficulty: "medium",
    conditions: {
      wind: { ok: 12, caution: 18 },
      wave: { ok: 0.5, caution: 0.8 },
    },
    poiCount: POIS_SUD.length,
    image: "./assets/illustrations/ruta-sud.png",
    cardImage: "./assets/illustrations/ruta-sud.png",
    mapImage: "./assets/illustrations/map-paint-ruta-sud.jpg",
    mapVectorPattern: "./assets/vectors/ruta-sud-vector-poi{i}.svg",
    pois: POIS_SUD,
    geometry: POIS_SUD.map((p) => p.coords),
  },
  {
    id: "nord",
    name: {
      ca: "Nord-Fornells",
      es: "Norte-Fornells",
      en: "North-Fornells",
      fr: "Nord-Fornells",
    },
    tagline: {
      ca: "Penya-segats del Cap de Begur fins a Fornells.",
      es: "Acantilados del Cap de Begur hasta Fornells.",
      en: "Cap de Begur cliffs all the way to Fornells.",
      fr: "Falaises du Cap de Begur jusqu'à Fornells.",
    },
    description: {
      ca: "Això es una descripció breu de la ruta B.",
      es: "Esta es una descripción breve de la ruta B.",
      en: "This is a short description of route B.",
      fr: "Ceci est une brève description de la route B.",
    },
    color: "#1B6B8A",
    distanceKm: 6.8,
    durationHours: 3.5,
    difficulty: "hard",
    conditions: {
      wind: { ok: 10, caution: 15 },
      wave: { ok: 0.4, caution: 0.7 },
    },
    poiCount: POIS_NORD.length,
    image: "./assets/illustrations/ruta-nord.png",
    cardImage: "./assets/illustrations/ruta-nord.png",
    // Nord placeholder: real nord map + vector are not yet authored, so we
    // temporarily reuse the sud assets for screen 3 rendering. Replace these
    // two lines once map-paint-ruta-nord.jpg + ruta-nord-vector-poi*.svg land.
    mapImage: "./assets/illustrations/map-paint-ruta-sud.jpg",
    mapVectorPattern: "./assets/vectors/ruta-sud-vector-poi{i}.svg",
    pois: POIS_NORD,
    geometry: [
      [3.2155, 41.9326],
      [3.217, 41.9298],
      [3.219, 41.9268],
      [3.2212, 41.9239],
      [3.2238, 41.9213],
      [3.2262, 41.9201],
    ],
  },
];

export function findRoute(id) {
  return ROUTES.find((r) => r.id === id);
}

export const MARINA = {
  name: "Sa Blava — Moll d'Aiguablava",
  coords: [3.2155, 41.9326],
};
