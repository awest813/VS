# Void Sovereigns (FPS)

First-person **extraction** slice set in the **Void Sovereigns** universe: contract work on a failing station stack, a lunar storage line, and green extracts back to your ship. This repo is a **Babylon.js** + **React** + **Dexie** prototype — gameplay is real-time FPS, not the turn-based MMO in the canon project.

**World canon, lore bible, and phase history:** [github.com/awest813/Void-Sovereigns-Online](https://github.com/awest813/Void-Sovereigns-Online) (MIT). Tone and setting follow that material: **NASA-punk** hardware, declining **Void Relay** infrastructure, frontier contracts, slow-burn cosmic mystery.

## What you do here

- **Ship hub** — 3D bridge; operations console for contracts, stash/loadout, armory, docking.  
- **Raid loop** — Station ↔ moon base; backpack and vitals carry across; death drops the pack; station→ship extract persists stash via IndexedDB.  
- **Combat** — Hitscan primaries, navmesh AI, surge lighting, concussive pulse gadget, diegetic terminal fragments.

## Tech stack

| Area | Choice |
|------|--------|
| Runtime | TypeScript, Vite 5 |
| 3D | Babylon.js 7, Havok (WASM), Recast-Detour |
| UI | React 18 |
| Saves | Dexie / IndexedDB |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (port **3000**, `vite.config.ts`) |
| `npm run build` | `tsc` + production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm run test` / `npm run test:watch` | Vitest |

## Quick start

```bash
npm install
npm run dev
```

Click the canvas to lock the pointer. **Controls** (raid): WASD, Shift, Space, mouse, E interact, R reload, F flashlight, H medkit, G pulse.

## Project layout

```
src/
├── App.tsx                 # HUD, ship ops, surge / gadget / terminal UI
├── main.ts
├── game/                   # Game host, scenes, AI, contracts, persistence, loot, level defs
└── ui/uiTokens.ts
```

## Testing

```bash
npm run test
```

Uses `fake-indexeddb` for persistence tests (`vitest.setup.ts`).

## Saves

The IndexedDB database id is still `BunkerExtractionDB` internally so existing local saves keep working; only the product name and copy are rebranded.

## License

This FPS prototype does not yet declare a public license; the **canon** repository above is **MIT**. Attribute setting and terminology to **Void Sovereigns Online** when reusing lore.

---

*Version 0.1.0 · Not affiliated with the Phaser MMO repo beyond shared setting.*
