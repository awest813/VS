# Bunker Extraction - Single Player FPS

A Doom 3-style single-player extraction shooter built with Babylon.js, Vite, and React. 

In *Bunker Extraction*, you take on contracts to infiltrate corporate stations and abandoned moon bases. Scavenge for loot, survive encounters with hostile security drones, and extract safely to upgrade your loadout.

## Tech Stack
- **Engine**: Babylon.js 7.0+
- **Physics**: Havok (WASM)
- **Framework**: React 18+ (UI Overlay & Terminal)
- **Build Tool**: Vite
- **Database**: Dexie.js (IndexedDB for persistent saves)

## Features (Core MVP)
- **Interactive Ship Hub:** A physical 3D starting hub where you can view your armory, operate the mission terminal, and prepare for drops.
- **Dynamic Combat:** Recoil and smooth recovery physics, hitscan weapon system, and enemy AI that tracks, chases, and performs melee attacks.
- **Persistent Economy & Stash:** Loot gathered during raids (scrap, wire, ammo) is saved to an IndexedDB database via Dexie. Junk can be sold for credits.
- **Contracts System:** Accept specific missions at the Ship Terminal (e.g., retrieving a Survey Drive), and receive credit payouts upon successful extraction.
- **Multi-Zone Level Design:** Seamlessly travel from the Ship to the Station, take the elevator down to the sprawling Moon Base, and find extraction zones to return home.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Development Roadmap

### Phase 1: Core Systems (Completed)
- [x] Basic Babylon.js scene management
- [x] FPS Controller & Havok Physics integration
- [x] React UI overlay for HUD
- [x] SaveDB implementation using Dexie

### Phase 2: Gameplay Loop (Completed)
- [x] Physical Ship Hub environment
- [x] Functional extraction mechanics
- [x] Inventory persistence across level transitions
- [x] Economy: Selling junk and receiving contract payouts

### Phase 3: Progression & Arsenal (Completed)
- [x] **The Shop:** A terminal in the Ship Hub to spend credits on new weapons and ammo.
- [x] **Weapon Variety:** Added Shotgun and Pulse Rifle with unique stats and firing mechanics.
- [x] **Loot Variety:** Randomly generated damage and fire-rate modifiers on looted weapons.

### Phase 4: Enemy AI & Navigation (Completed)
- [x] Recast NavMesh for intelligent pathfinding
- [x] Animated 3D Enemy Models (Idle, Chase, Attack, Death)
- [x] Advanced AI: Ranged enemies that fire physical projectiles

### Phase 5: Atmosphere & Polish (Completed)
- [x] Flashlight battery drain and recharge mechanics
- [x] Grimy procedural PBR textures for the Moon Base
- [x] Spatial audio for footsteps and weapon firing

### Phase 6: Expansion & Scaling (Next Up)
- [ ] **Procedural Generation:** BSP-based random dungeon generation for the Moon Base.
- [ ] **Boss Fights:** Large scale boss encounters guarding high-tier loot.
- [ ] **Consumables:** Fully implementing Medkit usage and throwable grenades.

## Project Structure
- `src/game/`: Core game logic and engine coordinator.
- `src/game/scenes/`: Babylon.js scene definitions (ShipHub, Station, MoonBase).
- `src/game/player/`: Player controller, movement, and weapons.
- `src/game/ai/`: Enemy state machines, pathfinding, and behaviors.
- `src/game/persistence/`: Local save database using Dexie.
- `src/App.tsx`: React UI overlay and Ship Terminal interface.
- `src/main.ts`: Entry point.
