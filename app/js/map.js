// Map abstraction. Two modes:
//   1) Mapbox GL JS, when MAPBOX_TOKEN is set.
//   2) Hand-drawn nautical-chart SVG fallback (intentional, editorial style).
//
// Both modes render the same routes/POIs from data.js.

import { MAPBOX_TOKEN, MAPBOX_STYLE, AIGUABLAVA_CENTER } from "./config.js";
import { ROUTES, MARINA } from "./data.js";

// Bounding box used by the SVG fallback (lon/lat → x/y).
const BBOX = { lonMin: 3.205, lonMax: 3.235, latMin: 41.92, latMax: 41.945 };

function project(lon, lat, w, h) {
  const x = ((lon - BBOX.lonMin) / (BBOX.lonMax - BBOX.lonMin)) * w;
  const y = h - ((lat - BBOX.latMin) / (BBOX.latMax - BBOX.latMin)) * h;
  return [x, y];
}

function smoothPath(points, w, h) {
  if (points.length === 0) return "";
  const proj = points.map(([lon, lat]) => project(lon, lat, w, h));
  let d = `M ${proj[0][0].toFixed(2)} ${proj[0][1].toFixed(2)}`;
  for (let i = 1; i < proj.length; i++) {
    const [px, py] = proj[i - 1];
    const [cx, cy] = proj[i];
    const mx = (px + cx) / 2;
    const my = (py + cy) / 2;
    d += ` Q ${px.toFixed(2)} ${py.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(
      2
    )} T ${cx.toFixed(2)} ${cy.toFixed(2)}`;
  }
  return d;
}

export function renderFallbackMap(container) {
  const W = 390;
  const H = 600;
  const svgNS = "http://www.w3.org/2000/svg";

  const routePaths = ROUTES.map((r) => ({
    id: r.id,
    color: r.color,
    d: smoothPath(r.geometry, W, H),
  }));

  const [mx, my] = project(MARINA.coords[0], MARINA.coords[1], W, H);

  const poiMarkers = ROUTES.flatMap((r) =>
    r.geometry.slice(1).map(([lon, lat], i) => {
      const [x, y] = project(lon, lat, W, H);
      return { x, y, n: i + 1, color: r.color, route: r.id };
    })
  );

  container.innerHTML = `
    <svg class="fallback-map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="${svgNS}">
      <defs>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#dbeae4"/>
          <stop offset="55%" stop-color="#c8dde0"/>
          <stop offset="100%" stop-color="#b5cdd2"/>
        </linearGradient>
        <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f3ead8"/>
          <stop offset="100%" stop-color="#e7d8b9"/>
        </linearGradient>
        <pattern id="topo" x="0" y="0" width="42" height="42" patternUnits="userSpaceOnUse">
          <path d="M 0 21 Q 10 14 21 21 T 42 21" stroke="#cbb98e" stroke-width="0.6" fill="none" opacity="0.45"/>
          <path d="M 0 35 Q 10 28 21 35 T 42 35" stroke="#cbb98e" stroke-width="0.5" fill="none" opacity="0.3"/>
          <path d="M 0 7 Q 10 0 21 7 T 42 7" stroke="#cbb98e" stroke-width="0.5" fill="none" opacity="0.3"/>
        </pattern>
        <filter id="paper" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 0.93  0 0 0 0 0.89  0 0 0 0 0.81  0 0 0 0.06 0"/>
          <feComposite in2="SourceGraphic" operator="in"/>
          <feComposite in2="SourceGraphic" operator="over"/>
        </filter>
      </defs>

      <!-- sea -->
      <rect width="${W}" height="${H}" fill="url(#sea)"/>

      <!-- subtle hatch on water -->
      <g opacity="0.12" stroke="#5a8090" stroke-width="0.5" fill="none">
        ${Array.from({ length: 18 })
          .map(
            (_, i) =>
              `<path d="M ${i * 28} ${H - 80 + (i % 2) * 6} q 30 -8 60 0 t 60 0 t 60 0 t 60 0"/>`
          )
          .join("")}
      </g>

      <!-- land mass — Aiguablava bay coastline -->
      <path d="
        M -10 -10
        L ${W + 10} -10
        L ${W + 10} 110
        C 360 130, 320 160, 290 145
        C 255 128, 235 145, 215 160
        C 192 178, 170 168, 148 175
        C 128 182, 110 200, 90 218
        C 70 234, 50 240, 32 260
        C 18 278, 8 295, -10 305
        Z
      " fill="url(#land)"/>
      <path d="
        M -10 -10
        L ${W + 10} -10
        L ${W + 10} 110
        C 360 130, 320 160, 290 145
        C 255 128, 235 145, 215 160
        C 192 178, 170 168, 148 175
        C 128 182, 110 200, 90 218
        C 70 234, 50 240, 32 260
        C 18 278, 8 295, -10 305
        Z
      " fill="url(#topo)" opacity="0.55"/>

      <!-- second headland (Cap de Begur side) -->
      <path d="
        M ${W + 10} 380
        C 350 360, 330 395, 318 420
        C 308 442, 298 470, 305 500
        C 312 530, 330 560, 360 580
        L ${W + 10} ${H + 10}
        Z
      " fill="url(#land)"/>
      <path d="
        M ${W + 10} 380
        C 350 360, 330 395, 318 420
        C 308 442, 298 470, 305 500
        C 312 530, 330 560, 360 580
        L ${W + 10} ${H + 10}
        Z
      " fill="url(#topo)" opacity="0.5"/>

      <!-- pine dot clusters -->
      <g fill="#5b8060" opacity="0.55">
        ${[
          [54, 90],
          [72, 130],
          [110, 80],
          [148, 120],
          [188, 100],
          [240, 70],
          [285, 105],
          [332, 75],
          [338, 440],
          [355, 480],
          [322, 525],
        ]
          .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.8"/>`)
          .join("")}
      </g>

      <!-- coastline accent (where land meets sea) -->
      <path d="
        M -10 305
        C 8 295, 18 278, 32 260
        C 50 240, 70 234, 90 218
        C 110 200, 128 182, 148 175
        C 170 168, 192 178, 215 160
        C 235 145, 255 128, 290 145
        C 320 160, 360 130, ${W + 10} 110
      " stroke="#a98e57" stroke-width="1.2" fill="none" opacity="0.7"/>

      <path d="
        M ${W + 10} 380
        C 350 360, 330 395, 318 420
        C 308 442, 298 470, 305 500
        C 312 530, 330 560, 360 580
      " stroke="#a98e57" stroke-width="1.2" fill="none" opacity="0.6"/>

      <!-- bathymetric contours -->
      <g fill="none" stroke="#7896a0" stroke-width="0.7" opacity="0.25" stroke-dasharray="2 4">
        <path d="M 0 250 Q 100 240 200 255 T 390 250"/>
        <path d="M 0 320 Q 100 310 200 325 T 390 320"/>
        <path d="M 0 410 Q 100 400 200 415 T 390 410"/>
      </g>

      <!-- routes -->
      <g class="routes-layer" stroke-linecap="round" stroke-linejoin="round" fill="none">
        ${routePaths
          .map(
            (r) => `
            <path d="${r.d}" stroke="${r.color}" stroke-width="6" opacity="0.18"/>
            <path d="${r.d}" stroke="${r.color}" stroke-width="3" stroke-dasharray="0 8 6 0" stroke-linecap="round">
              <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1.6s" repeatCount="indefinite"/>
            </path>
            <path d="${r.d}" stroke="${r.color}" stroke-width="2.4" stroke-dasharray="6 6">
              <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="2.2s" repeatCount="indefinite"/>
            </path>`
          )
          .join("")}
      </g>

      <!-- POI markers -->
      <g class="poi-layer">
        ${poiMarkers
          .map(
            (p) => `
            <circle cx="${p.x}" cy="${p.y}" r="9" fill="#fff" stroke="${p.color}" stroke-width="2"/>
            <circle cx="${p.x}" cy="${p.y}" r="3" fill="${p.color}"/>
          `
          )
          .join("")}
      </g>

      <!-- marina (you are here) -->
      <g class="marina">
        <circle cx="${mx}" cy="${my}" r="22" fill="#0B6E8C" opacity="0.18">
          <animate attributeName="r" from="14" to="26" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="${mx}" cy="${my}" r="9" fill="#fff" stroke="#0B6E8C" stroke-width="3"/>
        <circle cx="${mx}" cy="${my}" r="4" fill="#0B6E8C"/>
      </g>

      <!-- compass rose -->
      <g transform="translate(${W - 46} ${H - 96})" opacity="0.7">
        <circle r="22" fill="#fff" stroke="#a98e57" stroke-width="0.8" opacity="0.85"/>
        <path d="M 0 -18 L 4 0 L 0 18 L -4 0 Z" fill="#0A4D6B"/>
        <path d="M -18 0 L 0 4 L 18 0 L 0 -4 Z" fill="#0A4D6B" opacity="0.55"/>
        <text y="-26" text-anchor="middle" font-family="Alegreya" font-size="10" fill="#0A4D6B" font-style="italic">N</text>
      </g>
    </svg>
  `;
}

export function renderMapboxMap(container) {
  // Returns an instance + a cleanup function.
  if (typeof mapboxgl === "undefined") {
    return null;
  }
  mapboxgl.accessToken = MAPBOX_TOKEN;

  const map = new mapboxgl.Map({
    container,
    style: MAPBOX_STYLE,
    center: AIGUABLAVA_CENTER,
    zoom: 13.5,
    pitch: 0,
    attributionControl: false,
    interactive: true,
  });

  map.on("load", () => {
    for (const r of ROUTES) {
      map.addSource(`route-${r.id}`, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: r.geometry },
        },
      });

      map.addLayer({
        id: `route-${r.id}-glow`,
        type: "line",
        source: `route-${r.id}`,
        paint: {
          "line-color": r.color,
          "line-width": 8,
          "line-opacity": 0.18,
          "line-blur": 4,
        },
      });

      map.addLayer({
        id: `route-${r.id}-line`,
        type: "line",
        source: `route-${r.id}`,
        paint: {
          "line-color": r.color,
          "line-width": 3.5,
          "line-dasharray": [2, 1.5],
        },
      });

      // POI markers
      r.geometry.slice(1).forEach(([lon, lat], i) => {
        const el = document.createElement("div");
        el.className = "poi-marker";
        el.innerHTML = `<span style="background:${r.color}"></span>`;
        el.style.cssText = `width:18px;height:18px;border-radius:50%;background:#fff;border:2px solid ${r.color};display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.25)`;
        el.firstElementChild.style.cssText = `width:6px;height:6px;border-radius:50%`;
        new mapboxgl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
      });
    }

    // marina pulsing dot
    const marinaEl = document.createElement("div");
    marinaEl.style.cssText = `width:18px;height:18px;border-radius:50%;background:#0B6E8C;border:3px solid #fff;box-shadow:0 0 0 0 rgba(11,110,140,0.5);animation:emergency-pulse 2s ease-out infinite`;
    new mapboxgl.Marker({ element: marinaEl })
      .setLngLat(MARINA.coords)
      .addTo(map);
  });

  return map;
}

export function mountMap(container) {
  if (MAPBOX_TOKEN && MAPBOX_TOKEN.length > 0) {
    container.innerHTML = "";
    return renderMapboxMap(container);
  }
  renderFallbackMap(container);
  return null;
}

// Focused mini-map for Screens 3 + 4. Shows a single route's geometry,
// optionally with one POI highlighted. Renders an SVG even when Mapbox is
// available — the static stylized view fits the panel better at this size.
export function renderFocusedRouteMap(container, route, options = {}) {
  if (!route) return;
  const W = 360;
  const H = options.height || 200;
  const focusedPoiId = options.focusedPoiId || null;

  const proj = (lon, lat) => project(lon, lat, W, H);
  const linePath = smoothPath(route.geometry, W, H);
  const [mx, my] = proj(MARINA.coords[0], MARINA.coords[1]);
  const pois = route.pois || [];

  container.innerHTML = `
    <svg class="fallback-map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mini-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#dbeae4"/>
          <stop offset="100%" stop-color="#bfd6db"/>
        </linearGradient>
        <linearGradient id="mini-land" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f1e7d4"/>
          <stop offset="100%" stop-color="#e3d2af"/>
        </linearGradient>
      </defs>

      <rect width="${W}" height="${H}" fill="url(#mini-sea)"/>

      <!-- coastline silhouette (simplified) -->
      <path d="
        M -10 -10
        L ${W + 10} -10
        L ${W + 10} 36
        C 320 50, 280 60, 240 56
        C 200 52, 170 65, 140 70
        C 110 75, 80 75, 50 86
        C 30 94, 10 100, -10 110
        Z
      " fill="url(#mini-land)"/>

      <path d="
        M ${W + 10} ${H - 50}
        C ${W - 30} ${H - 60}, ${W - 60} ${H - 30}, ${W - 50} ${H + 10}
        L ${W + 10} ${H + 10}
        Z
      " fill="url(#mini-land)"/>

      <!-- route line -->
      <path d="${linePath}" stroke="${route.color}" stroke-width="6" fill="none" opacity="0.18" stroke-linecap="round"/>
      <path d="${linePath}" stroke="${route.color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="4 5">
        <animate attributeName="stroke-dashoffset" from="0" to="-9" dur="1.6s" repeatCount="indefinite"/>
      </path>

      <!-- numbered POI markers -->
      ${pois
        .map((p, i) => {
          const [x, y] = proj(p.coords[0], p.coords[1]);
          const isFocused = focusedPoiId && p.id === focusedPoiId;
          return `
            <g>
              <circle cx="${x}" cy="${y}" r="${isFocused ? 16 : 13}" fill="#fff" stroke="${route.color}" stroke-width="${isFocused ? 3 : 2}"/>
              <text x="${x}" y="${y + 4}" text-anchor="middle" font-family="Alegreya" font-weight="700" font-size="${isFocused ? 13 : 11}" fill="${route.color}">${i + 1}</text>
              ${isFocused ? `<circle cx="${x}" cy="${y}" r="22" fill="${route.color}" opacity="0.18"><animate attributeName="r" from="14" to="26" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.4" to="0" dur="1.8s" repeatCount="indefinite"/></circle>` : ""}
            </g>
          `;
        })
        .join("")}

      <!-- marina -->
      <g>
        <circle cx="${mx}" cy="${my}" r="6" fill="#fff" stroke="#0B6E8C" stroke-width="2.5"/>
        <circle cx="${mx}" cy="${my}" r="2.5" fill="#0B6E8C"/>
      </g>
    </svg>
  `;
}
