# Sa Blava — Aiguablava Kayak Routes

Mobile-first web app for Sa Blava kayak rentals at Platja d'Aiguablava, Costa Brava. Customers scan a QR code on the kayak, get a multilingual route guide with live weather and (Phase 2) GPS navigation.

## Status

- **Phase 1:** Shipped. Routes, POIs, weather widget, mascot, 4-language i18n, hand-drawn map fallback.
- **Phase 2:** In planning. GPS navigation, daily-code unlock, admin panel, Rive hero animation, Mapbox tile pre-caching. See [docs/PRD-phase2-gps-navigation.md](docs/PRD-phase2-gps-navigation.md).

## Local development

```bash
cd app
python server.py
```

Open http://localhost:5173.

## Structure

```
app/                          # The web app
  index.html
  js/                         # Vanilla JS modules (no bundler)
    config.js                 # Mapbox token, center, emergency phone
    data.js                   # Routes + POIs
    router.js                 # Hash router
    weather.js                # Open-Meteo integration
    map.js                    # Map (SVG fallback or Mapbox)
    screens/                  # Per-route screens
  styles/                     # CSS tokens, base, components
  rutes/                      # GPX route files
docs/                         # PRDs and technical notes
```

## Planning docs

Higher-level design and project planning (stylescapes, sprint plans, references, case study draft) live in the project owner's Obsidian vault under `Projects/SaBlava-Kayak/`. This repo is for code and the PRDs that drive code.
