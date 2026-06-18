// Route + POI data for the SaBlava Kayak app.
//
// Two routes match Paper artboard 9UR-0 ("2 - See routes"):
//   - sud  → "Sud-Cova d'en Gispert" (south, sea caves)
//   - nord → "Nord-Fornells"         (north, cliffs toward Fornells)
//
// POI lists, geometry, and `conditions` thresholds are preserved from the
// Phase-1 dataset so later screens (route detail, POI detail) still have
// something to render. Sud-route coordinates come from a hand-measured GPS
// log (DMS converted to decimal degrees). Nord-route coords are still
// approximate placeholders.

import { TRACK_SUD } from "./track-sud.js";
import { TRACK_NORD } from "./track-nord.js";

// 9 POIs for the Sud route, matching Paper artboard AZH-0 / AQB-0.
// Descriptions are authored in Catalan only; the renderer falls back to the
// "poi.description.placeholder" i18n key for any language that is missing.
// `description: null` keeps the placeholder for POIs without a write-up yet.
const PLACEHOLDER_DESCRIPTION = null;

const POIS_SUD = [
  {
    id: "platja-aiguablava",
    type: "platja",
    typeIcon: "🏖",
    minutesFromStart: 0,
    coords: [3.216217, 41.934067],
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
    thumbnail: "./assets/illustrations/ruta-sud/poi1-aiguablava-paint.jpg",
    gallery: [
      { type: "image", src: "./assets/photos/poi1-pl-aiguablava/aiguablava-0.jpg" },
      { type: "image", src: "./assets/photos/poi1-pl-aiguablava/aiguablava-1.jpg" },
      { type: "image", src: "./assets/photos/poi1-pl-aiguablava/Aiguablava-2.jpg" },
      { type: "image", src: "./assets/photos/poi1-pl-aiguablava/Aiguablava-25.jpg" },
      { type: "image", src: "./assets/photos/poi1-pl-aiguablava/aiguablava-begur-4.jpg" },
    ],
  },
  {
    id: "cala-ses-herbes",
    type: "cala",
    typeIcon: "🏖",
    minutesFromStart: 20,
    coords: [3.218867, 41.932333],
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
    description: {
      ca: "Cala de roques.",
    },
    thumbnail: "./assets/illustrations/ruta-sud/poi-2-ses-herbes-paint.jpg",
    gallery: [
      { type: "image", src: "./assets/photos/poi2-ses-herbes/ses-herbes-1.jpg" },
    ],
  },
  {
    id: "cala-des-tramadiu",
    type: "cala",
    typeIcon: "🏖",
    minutesFromStart: 40,
    coords: [3.215333, 41.92925],
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
    description: {
      ca: "Platja de roques sense accés per terra. Precaució: Esllabissades.",
    },
    thumbnail: "./assets/illustrations/ruta-sud/poi-3-cala-des-tramadiu-paint.jpg",
    gallery: [
      { type: "image", src: "./assets/photos/poi-3-cala-des-tramadiu/tramadiu-1.jpg" },
    ],
  },
  {
    id: "cova-gispert",
    type: "cova",
    typeIcon: "🕳",
    minutesFromStart: 60,
    coords: [3.2175, 41.9276],
    depthM: 6,
    shade: "tot el dia",
    snorkel: 5,
    accessibility: "kayak",
    name: {
      ca: "Cova d'en Gispert",
      es: "Cueva Gispert",
      en: "Gispert's Cave",
      fr: "Grotte d'en Gispert",
    },
    description: {
      ca: "Cova molt profunda, d'uns 150 m de profunditat.\n\nCal portar frontal per arribar al fons de la cova. Un cop al fons hi ha un roc que li diuen «la taula» al que es pot donar la volta. En aquest punt hi ha una sala amb formacions molt maques.\n\nSi volem, encara es poden recórrer uns metres de cova passada la taula per una escletxa estreta.\n\nL'entrada a la cova, encara que molt visible, no crida excessivament l'atenció. Cal anar atent seguint la costa, portar el track a un GPS o memoritzar la forma de l'entrada (vegeu la foto).\n\nDos dies a l'any el sol es reflecteix al fons de la cova quan surt. Un dels dies és entre el 20 i el 23 d'agost i l'altre cap al 20 o 21 d'abril.",
    },
    thumbnail: "./assets/illustrations/ruta-sud/poi-4-cova-gispert-paint.jpg",
    gallery: [
      { type: "image", src: "./assets/photos/poi-4-cova-gispert/gispert-1.jpg" },
      { type: "image", src: "./assets/photos/poi-4-cova-gispert/gispert-2.jpg" },
      { type: "image", src: "./assets/photos/poi-4-cova-gispert/gispert-3.jpg" },
      { type: "image", src: "./assets/photos/poi-4-cova-gispert/gispert-4.jpg" },
      { type: "image", src: "./assets/photos/poi-4-cova-gispert/gispert-5.jpg" },
      { type: "image", src: "./assets/photos/poi-4-cova-gispert/gispert-6.jpg" },
      {
        type: "video",
        src: "./assets/photos/poi-4-cova-gispert/gispert-7.mp4",
        poster: "./assets/photos/poi-4-cova-gispert/gispert-6.jpg",
      },
      { type: "image", src: "./assets/photos/poi-4-cova-gispert/gispert-8.jpg" },
    ],
  },
  {
    id: "cova-bisbe",
    type: "cova",
    typeIcon: "🕳",
    minutesFromStart: 80,
    coords: [3.2183, 41.927133],
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
    description: {
      ca: "Cova no molt gran, però molt maca, al peu d'un alt penya-segat, fàcil de distingir per una gran taca groga que hi ha a l'esquerra de l'entrada.",
    },
    thumbnail: "./assets/illustrations/ruta-sud/poi-5cova-bisbe-paint.jpg",
    gallery: [
      { type: "image", src: "./assets/photos/poi-5-cova-bisbe/bisbe-1.jpg" },
      { type: "image", src: "./assets/photos/poi-5-cova-bisbe/bisbe-2.jpg" },
    ],
  },
  {
    id: "cova-gavina",
    type: "cova",
    typeIcon: "🕳",
    minutesFromStart: 100,
    coords: [3.217417, 41.925233],
    depthM: 6,
    shade: "tot el dia",
    snorkel: 4,
    accessibility: "kayak",
    name: {
      ca: "Cova de Sa Gavina",
      es: "Cueva de Sa Gavina",
      en: "Sa Gavina Cave",
      fr: "Grotte de Sa Gavina",
    },
    description: {
      ca: "Profunda cova de 60 m de llarg i 10 d'alçada. Després d'una sala alta i allargada continua uns 15 m per una galeria estreta però sense problemes per passar. Si no fos per la curta distància amb la Cova d'en Gispert, segur que seria una cova molt destacada.\n\nQuan vam anar-hi al juliol, vam passar dos cops per la cova i els dos cops hi havia una gavina solitària a pocs metres de l'entrada.",
    },
    thumbnail: "./assets/illustrations/ruta-sud/poi-6-cova-gavina-paint.jpg",
    gallery: [
      { type: "image", src: "./assets/photos/poi-6-cova-gavina/gavina-1.jpg" },
      { type: "image", src: "./assets/photos/poi-6-cova-gavina/gavina-2.jpg" },
      { type: "image", src: "./assets/photos/poi-6-cova-gavina/gavina-3.jpg" },
      { type: "image", src: "./assets/photos/poi-6-cova-gavina/gavina-4.jpg" },
      {
        type: "video",
        src: "./assets/photos/poi-6-cova-gavina/gavina-5.mp4",
        poster: "./assets/photos/poi-6-cova-gavina/gavina-4.jpg",
      },
      {
        type: "video",
        src: "./assets/photos/poi-6-cova-gavina/gavina-6.mp4",
        poster: "./assets/photos/poi-6-cova-gavina/gavina-4.jpg",
      },
    ],
  },
  {
    id: "reg-arbres",
    type: "snorkel",
    typeIcon: "🤿",
    minutesFromStart: 120,
    coords: [3.21715, 41.92475],
    depthM: 8,
    shade: "tarda",
    snorkel: 5,
    accessibility: "kayak",
    name: {
      ca: "Rec dels Arbres",
      es: "Rec dels Arbres",
      en: "Rec dels Arbres",
      fr: "Rec dels Arbres",
    },
    description: {
      ca: "Pas estret navegable.\n\nUn dels millors freus de la Costa Brava. Cal anar atents per no saltar-ho, especialment si naveguem cap al Nord. Té parets altes i és força llarg i estret, però sense problemes per passar amb qualsevol caiac.",
    },
    thumbnail: "./assets/illustrations/ruta-sud/poi-7-reg-arbres-paint.jpg",
    gallery: [
      { type: "image", src: "./assets/photos/poi-7-rec-dels-arbres/rec-arbres-1.jpg" },
      { type: "image", src: "./assets/photos/poi-7-rec-dels-arbres/rec-arbres-2.jpg" },
      { type: "image", src: "./assets/photos/poi-7-rec-dels-arbres/rec-arbres-3.jpg" },
    ],
  },
  {
    id: "cala-marquesa",
    type: "cala",
    typeIcon: "🏖",
    minutesFromStart: 140,
    coords: [3.216317, 41.924133],
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
    description: {
      ca: "Tipus: avarada (parada), codolar, bivac.",
    },
    thumbnail: "./assets/illustrations/ruta-sud/poi-8-cala-marquesa-paint.jpg",
    gallery: [
      { type: "image", src: "./assets/photos/poi-8-cala-marquesa/marquesa-1.jpg" },
      { type: "image", src: "./assets/photos/poi-8-cala-marquesa/marquesa-2.jpg" },
      { type: "image", src: "./assets/photos/poi-8-cala-marquesa/marquesa-3.jpg" },
      { type: "image", src: "./assets/photos/poi-8-cala-marquesa/marquesa-4.jpg" },
      { type: "image", src: "./assets/photos/poi-8-cala-marquesa/marquesa-5.jpg" },
    ],
  },
  {
    id: "aigua-xelida",
    type: "cala",
    typeIcon: "🏖",
    minutesFromStart: 160,
    coords: [3.215683, 41.92145],
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
    description: {
      ca: "Aquí va viure Sebastià Puig, l'Hermòs, amic de Josep Pla i que surt en un dels seus llibres.",
    },
    thumbnail: "./assets/illustrations/ruta-sud/poi-9-aigua-xelida-paint.jpg",
    gallery: [
      { type: "image", src: "./assets/photos/poi-9-aigua-xelida/aigua-xelida-1.jpg" },
      { type: "image", src: "./assets/photos/poi-9-aigua-xelida/aigua-xelida-2.jpg" },
      { type: "image", src: "./assets/photos/poi-9-aigua-xelida/aigua-xelida-3.jpg" },
      { type: "image", src: "./assets/photos/poi-9-aigua-xelida/xelida-4.jpeg" },
    ],
  },
];

// DMS → decimal helper (minutes′ only, no seconds).
// e.g. dms(41, 56.168) → 41.93613
const dms = (deg, min) => deg + min / 60;

const POIS_NORD = [
  {
    id: "platja-aiguablava",
    type: "platja",
    typeIcon: "🏖",
    minutesFromStart: 0,
    coords: [3.216217, 41.934067],
    depthM: 2,
    shade: "matí",
    snorkel: 3,
    accessibility: "kayak",
    name: {
      ca: "Platja d'Aiguablava",
      es: "Playa de Aiguablava",
      en: "Aiguablava Beach",
      fr: "Plage d'Aiguablava",
    },
    description: PLACEHOLDER_DESCRIPTION,
    thumbnail: "./assets/illustrations/ruta-nord/poi1-aiguablava-paint.jpg",
    gallery: [],
  },
  {
    id: "port-esclanya",
    type: "port",
    typeIcon: "⚓",
    minutesFromStart: 15,
    coords: [dms(3, 12.857), dms(41, 56.168)],
    depthM: 3,
    shade: "matí",
    snorkel: 2,
    accessibility: "kayak",
    name: {
      ca: "Port d'Esclanyà",
      es: "Puerto de Esclanyà",
      en: "Port d'Esclanyà",
      fr: "Port d'Esclanyà",
    },
    description: PLACEHOLDER_DESCRIPTION,
    thumbnail: "./assets/illustrations/ruta-nord/poi2-port-esclanya-paint.jpg",
    gallery: [],
  },
  {
    id: "platja-malaret",
    type: "platja",
    typeIcon: "🏖",
    minutesFromStart: 25,
    coords: [dms(3, 12.929), dms(41, 56.277)],
    depthM: 2,
    shade: "matí",
    snorkel: 3,
    accessibility: "kayak",
    name: {
      ca: "Platja d'en Malaret",
      es: "Playa Malaret",
      en: "Malaret Beach",
      fr: "Plage Malaret",
    },
    description: PLACEHOLDER_DESCRIPTION,
    thumbnail: "./assets/illustrations/ruta-nord/poi3-platja-del-malaret-paint.jpg",
    gallery: [],
  },
  {
    id: "port-ses-orats",
    type: "port",
    typeIcon: "⚓",
    minutesFromStart: 35,
    coords: [dms(3, 12.949), dms(41, 56.295)],
    depthM: 3,
    shade: "matí",
    snorkel: 2,
    accessibility: "kayak",
    name: {
      ca: "Port de Ses Orats",
      es: "Puerto de Ses Orats",
      en: "Port de Ses Orats",
      fr: "Port de Ses Orats",
    },
    description: PLACEHOLDER_DESCRIPTION,
    thumbnail: "./assets/illustrations/ruta-nord/poi4-port-ses-orats-paint.jpg",
    gallery: [],
  },
  {
    id: "illa-blanca",
    type: "mirador",
    typeIcon: "🏝",
    minutesFromStart: 50,
    coords: [dms(3, 13.084), dms(41, 56.275)],
    depthM: 5,
    shade: "migdia",
    snorkel: 4,
    accessibility: "kayak",
    name: {
      ca: "Illa Blanca",
      es: "Isla Blanca",
      en: "Illa Blanca",
      fr: "Illa Blanca",
    },
    description: PLACEHOLDER_DESCRIPTION,
    thumbnail: "./assets/illustrations/ruta-nord/poi5-illa-blanca-paint.jpg",
    gallery: [],
  },
  {
    id: "platja-nestasia",
    type: "platja",
    typeIcon: "🏖",
    minutesFromStart: 65,
    coords: [dms(3, 13.055), dms(41, 56.397)],
    depthM: 2,
    shade: "matí",
    snorkel: 3,
    accessibility: "kayak",
    name: {
      ca: "Platja de n'Estasia",
      es: "Playa de Estasia",
      en: "N'Estasia Beach",
      fr: "Plage de n'Estasia",
    },
    description: PLACEHOLDER_DESCRIPTION,
    thumbnail: "./assets/illustrations/ruta-nord/poi6-platja-nestesia-paint.jpg",
    gallery: [],
  },
  {
    id: "platja-fonda",
    type: "platja",
    typeIcon: "🏖",
    minutesFromStart: 80,
    coords: [dms(3, 13.045), dms(41, 56.503)],
    depthM: 3,
    shade: "migdia",
    snorkel: 3,
    accessibility: "kayak",
    name: {
      ca: "Platja Fonda",
      es: "Playa Fonda",
      en: "Platja Fonda",
      fr: "Platja Fonda",
    },
    description: PLACEHOLDER_DESCRIPTION,
    thumbnail: "./assets/illustrations/ruta-nord/poi7-platja-fonda-paint.jpg",
    gallery: [],
  },
  {
    id: "es-falco",
    type: "mirador",
    typeIcon: "🦅",
    minutesFromStart: 110,
    coords: [dms(3, 13.636), dms(41, 56.869)],
    depthM: 8,
    shade: "tarda",
    snorkel: 4,
    accessibility: "kayak",
    name: {
      ca: "Es Falcó",
      es: "Es Falcó",
      en: "Es Falcó",
      fr: "Es Falcó",
    },
    description: PLACEHOLDER_DESCRIPTION,
    thumbnail: "./assets/illustrations/ruta-nord/poi8-ses-falco-paint.jpg",
    gallery: [],
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
    image: "./assets/illustrations/ruta-sud/ruta-sud.png",
    cardImage: "./assets/illustrations/ruta-sud/ruta-sud.png",
    // Illustrated route map = a base JPG per duration + one SVG overlay per
    // POI stacked on top. Only the overlay swaps as the carousel scrolls; the
    // base changes when the duration changes. {i} is the 1-based POI index.
    mapByDuration: {
      "1h": {
        base: "./assets/illustrations/mapa-ruta/ruta-sud/map-ruta-sud-base-1hora.jpg",
        overlay: "./assets/illustrations/mapa-ruta/ruta-sud/map-ruta-sud-{i}-1hora.svg",
      },
      "1h30": {
        base: "./assets/illustrations/mapa-ruta/ruta-sud/map-ruta-sud-base-2hores-90-mins.jpg",
        overlay: "./assets/illustrations/mapa-ruta/ruta-sud/map-ruta-sud-{i}-2hores-90-mins.svg",
      },
      "2h": {
        base: "./assets/illustrations/mapa-ruta/ruta-sud/map-ruta-sud-base-2hores-90-mins.jpg",
        overlay: "./assets/illustrations/mapa-ruta/ruta-sud/map-ruta-sud-{i}-2hores-90-mins.svg",
      },
      "3h": {
        base: "./assets/illustrations/mapa-ruta/ruta-sud/map-ruta-base-3h.jpg",
        overlay: "./assets/illustrations/mapa-ruta/ruta-sud/map-ruta-sud-{i}.svg",
      },
    },
    durations: {
      available: ["1h", "1h30", "2h", "3h"],
      countByDuration: { "1h": 5, "1h30": 8, "2h": 8, "3h": 9 },
      countByHours: { 1: 5, 1.5: 8, 2: 8, 3: 9 },
      default: "3h",
    },
    pois: POIS_SUD,
    geometry: POIS_SUD.map((p) => p.coords),
    track: TRACK_SUD,
    // Bounding box [minLon, minLat, maxLon, maxLat] used for Mapbox tile
    // pre-caching. Padded slightly beyond the furthest POI coords so tiles
    // cover the full coastal corridor the paddler will see.
    bbox: [3.207, 41.918, 3.237, 41.940],
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
    distanceKm: 4.8,
    durationHours: 2,
    difficulty: "medium",
    conditions: {
      wind: { ok: 10, caution: 15 },
      wave: { ok: 0.4, caution: 0.7 },
    },
    poiCount: POIS_NORD.length,
    image: "./assets/illustrations/ruta-nord/ruta-nord.png",
    cardImage: "./assets/illustrations/ruta-nord/ruta-nord.png",
    mapByDuration: {
      "1h": {
        base: "./assets/illustrations/mapa-ruta/ruta-nord/map-ruta-nord-base-1-hora.jpg",
        overlay: "./assets/illustrations/mapa-ruta/ruta-nord/map-ruta-nord-{i}-1-hora.svg",
      },
      "1h30": {
        base: "./assets/illustrations/mapa-ruta/ruta-nord/map-ruta-nord-base-1-hora.jpg",
        overlay: "./assets/illustrations/mapa-ruta/ruta-nord/map-ruta-nord-{i}-1-hora.svg",
      },
      "2h": {
        base: "./assets/illustrations/mapa-ruta/ruta-nord/map-ruta-base-2h.jpg",
        overlay: "./assets/illustrations/mapa-ruta/ruta-nord/map-ruta-nord-{i}.svg",
      },
    },
    durations: {
      available: ["1h", "1h30", "2h"],
      countByDuration: { "1h": 7, "1h30": 7, "2h": 8 },
      countByHours: { 1: 7, 1.5: 7, 2: 8 },
      default: "1h",
    },
    pois: POIS_NORD,
    geometry: POIS_NORD.map((p) => p.coords),
    track: TRACK_NORD,
    // Bounding box [minLon, minLat, maxLon, maxLat].
    bbox: [3.210, 41.930, 3.235, 41.952],
  },
];

export function findRoute(id) {
  return ROUTES.find((r) => r.id === id);
}

export const MARINA = {
  name: "Sa Blava — Moll d'Aiguablava",
  coords: [3.2155, 41.9326],
};
