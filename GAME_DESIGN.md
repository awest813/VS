# Void Sovereigns — Game Design Document

**Genre:** First-person extraction shooter · Survival horror action  
**Tone:** NASA-punk decay · Doom 3 atmosphere · S.T.A.L.K.E.R. systemic depth  
**Version:** 0.2 design draft  

---

## Table of Contents

1. [Vision & Pillars](#1-vision--pillars)  
2. [Setting & Lore Context](#2-setting--lore-context)  
3. [Core Loop](#3-core-loop)  
4. [Procedural Mission & Contract System](#4-procedural-mission--contract-system)  
5. [Zones & Environments](#5-zones--environments)  
6. [Combat System](#6-combat-system)  
7. [Weapons Catalog](#7-weapons-catalog)  
8. [Armor & Suits Catalog](#8-armor--suits-catalog)  
9. [Gadgets & Equipment](#9-gadgets--equipment)  
10. [Enemies & AI Behavior](#10-enemies--ai-behavior)  
11. [Player Progression](#11-player-progression)  
12. [Economy & Trading](#12-economy--trading)  
13. [Narrative Fragments & Atmosphere](#13-narrative-fragments--atmosphere)  
14. [Audio Design Philosophy](#14-audio-design-philosophy)  
15. [Technical Reference](#15-technical-reference)  

---

## 1. Vision & Pillars

### Elevator Pitch

You are a frontier contractor operating out of a cramped ship at the edge of the Void Relay network. The stations are failing, the moon installations are going dark, and something has been moving through the corridors long after the last official crew left. You take jobs because the credits pay for fuel and ammunition. You go in, you get it done, you get out—alive if possible.

**Doom 3** supplies the template for combat feel: flashlight-or-gun tension, tight corridors, oppressive ambience, sudden violence.  
**S.T.A.L.K.E.R.** supplies the structural grammar: faction economy, artifact hunting, anomalies, systemic NPC behavior, and the sense that the zone is indifferent to your survival.

### Design Pillars

| Pillar | Design Expression |
|--------|-------------------|
| **Tension over spectacle** | Surge lighting, scarce ammo, audio cues before visual contact |
| **Preparation matters** | Loadout choice, suit condition, and gadget selection all affect outcome |
| **Every run is different** | Procedural contracts, enemy patrol seeds, loot scatter, anomaly fields |
| **Consequence carries weight** | Dying drops your pack; persistent stash only if you extract green |
| **The zone breathes** | Ambient AI routines, faction patrols, and environmental hazards run whether or not you are nearby |

---

## 2. Setting & Lore Context

### The Void Relay Network

The Void Relay is a system of faster-than-light transit stations built during the Expansion era. Individual relay stacks are massive modular structures — docking bays, industrial corridors, pressurized transit spines — now in managed decline. The corporate authority that built them, **Meridian Transit Authority (MTA)**, sold maintenance contracts to frontier operators when budget pressures hit. Most operators folded. A few became scavengers.

### The Station Stack (primary zone)

Designation **VS-7 Thornfield** — a mid-tier relay stack on the lunar insertion arc. Last official crew abandoned the upper four levels after an undisclosed biohazard event. MTA still pays extraction contracts to avoid liability from the derelict. Power runs intermittently from a damaged fusion line. Gravity plating holds in most sections; full-null pockets appear where conduit runs have ruptured.

### The Lunar Spine (secondary zone)

A subsurface mining installation connected to VS-7 via a pressurized transit corridor. MTA used it to refuel relay craft. Now it is a warren of dark tunnels, research pods, and flooded pump stations. Faction scavengers have bases here. Something lives in the deep sections.

### Factions

| Faction | Role | Disposition |
|---------|------|-------------|
| **Thornfield Salvagers** | Competing contractors; will shoot on sight in contested zones | Hostile |
| **Relay Ghosts** | Former MTA crew who never left; erratic, territorial | Hostile unless greeted by faction rep |
| **Meridian Transit Authority** | Issues contracts, pays extraction fees, denies all anomalies | Neutral (contract issuer) |
| **The Unsanctioned** | Rogue operators running illegal artifact deals out of the deep spine | Hostile / tradeable |
| **Deep Fauna** | Biological and semi-mechanical entities from the anomaly event | Always hostile |

---

## 3. Core Loop

```
SHIP HUB
  │
  ├─ Operations console: accept contract → choose loadout & suit
  │
  └─ DEPLOY
       │
       ├─ STATION (VS-7 Thornfield)
       │    ├─ Navigate procedurally seeded layout
       │    ├─ Fight / evade / negotiate
       │    ├─ Complete contract objectives
       │    ├─ Loot containers, hostiles, anomaly fields
       │    └─ GREEN EXTRACT (aft beacon) → merges raid inventory → STATION CLEAR
       │
       ├─ LUNAR SPINE (via transit lift)
       │    ├─ Deeper zones, harder threats, better loot
       │    ├─ Anomaly fields with artifacts
       │    └─ GREEN EXTRACT (east corridor) → merges → back to STATION
       │
       └─ SHIP EXTRACT (return from station)
            ├─ Stash persisted to IndexedDB
            ├─ Contract payout evaluated
            ├─ Credits deposited
            └─ Repair / restock / upgrade → repeat
```

**Death:** Pack drops at death location. Player re-spawns aboard ship with starter kit. All raid inventory lost unless a faction ally or retrieval contract can recover it.

---

## 4. Procedural Mission & Contract System

### Contract Architecture

Contracts are generated from a weighted template pool seeded with zone state, faction reputation, and current run number. Each contract is composed of:

```
ContractTemplate
  ├─ ObjectiveSet       (1–3 objectives from pool)
  ├─ ConstraintSet      (time limits, suit requirements, exclusion zones)
  ├─ RewardTable        (credits, faction rep, rare loot, key items)
  └─ NarrativeTag       (flavor text, issuer voice line, lore fragment)
```

### Objective Pool

| Objective Type | Description | Scaling Variable |
|----------------|-------------|------------------|
| **Recover Item** | Find specific item placed in procedural container | Zone depth |
| **Clear Hostiles** | Eliminate N enemies of given type | Enemy tier |
| **Activate Terminal** | Power on / interface with station systems | Terminal count |
| **Escort Signal** | Keep distress beacon active against waves | Wave count |
| **Anomaly Survey** | Scan N anomalies without triggering them | Anomaly density |
| **Faction Delivery** | Bring item to a faction contact in-zone | Faction state |
| **Data Extraction** | Download logs from a protected server room | Guard density |
| **Sabotage Run** | Destroy MTA equipment; hostile faction issues this | Time pressure |
| **Artifact Recovery** | Extract a specific artifact class from the deep spine | Anomaly type |
| **Rival Neutralize** | Take out a named Thornfield Salvager boss | Named AI |

### Procedural Seeding

Each contract run seeds the following independently:

- **Container placement** — loot scatter uses weighted room-type buckets; quest items always placed beyond the main threat encounter
- **Enemy patrol routes** — navmesh waypoint shuffling + time-of-arrival offsets create unique patrol timings per run
- **Anomaly fields** — type, position, and radius rolled from zone-specific anomaly tables (see §10)
- **Faction presence** — Salvager or Ghost squad size and spawn rooms vary per seed
- **Power state** — corridor sections can be lit, surge-flickering, or dead per run; this changes valid paths and AI sight lines

### Constraint Modifiers

Contracts can carry optional constraints that increase payout multiplier:

| Constraint | Payout Bonus | Description |
|------------|-------------|-------------|
| `NO_MEDICAL` | ×1.4 | No medkit use allowed (tracked server-side) |
| `STEALTH` | ×1.6 | No hostile body count; AI awareness must stay below Detection Level 2 |
| `TIMED` | ×1.3–×2.0 | Hard clock; scales with zone depth |
| `SOLO_SUIT` | ×1.2 | Must deploy with a specific suit class |
| `ARTIFACT_INTACT` | ×1.8 | Quest artifact must have 100% integrity on extract |

### Contract Tiers

| Tier | Unlocked By | Typical Reward | Zone |
|------|------------|----------------|------|
| **Dock** | Default | 200–500 credits | Station upper levels |
| **Transit** | 3 Dock clears | 500–1 200 credits | Station mid / surface moon |
| **Deep Spine** | 5 Transit + faction rep | 1 200–4 000 credits | Lunar deep sections |
| **Black Warrant** | Unsanctioned rep | 4 000–12 000 + artifacts | Locked research pods |

---

## 5. Zones & Environments

### VS-7 Thornfield (Station)

| Section | Atmosphere | Threat Level | Notes |
|---------|-----------|-------------|-------|
| **Docking Arm** | Cold fluorescents, airlock groans | Low | Entry point; Salvager patrols |
| **Transfer Corridor** | Surge lighting, debris | Medium | Main combat artery |
| **Engineering Deck** | Total darkness, heat vents | Medium–High | Doom 3 reference point; flashlight-or-gun |
| **Command Ring** | Intermittent power, ghost audio | High | Relay Ghost territory |
| **Biohazard Seal** | Red emergency lighting, locked doors | Very High | Anomaly contamination; quest-gated |

### Lunar Spine (Moon)

| Section | Atmosphere | Threat Level | Notes |
|---------|-----------|-------------|-------|
| **Transit Corridor** | Low grey light, dust motes | Low–Medium | Transition from station |
| **Pump Station** | Flooded, electrical sparks | Medium | Anomaly fields near water |
| **Ore Processing** | Industrial clang, dust | Medium | Salvager base camp possible |
| **Research Pod Alpha** | Sterile white, broken glass | High | Data extraction objectives |
| **Deep Spine Core** | No light, anomaly glow | Extreme | Artifacts, Deep Fauna, Black Warrants |

### Environmental Hazards

| Hazard | Source | Effect | Counter |
|--------|--------|--------|---------|
| **Radiation field** | Reactor leak | HP drain per second | Rad-block suit module |
| **Surge arc** | Exposed conduit | Stagger + EMP (disables gadgets) | Surge insulation suit upgrade |
| **Pressure lock** | Ruptured hull | Suit integrity drain | Hull-rated suit tier 2+ |
| **Anomaly gravity well** | Void artifact | Pulls player + items | Bolt anchor gadget |
| **Anomaly fire geysers** | Thermal artifact | Burst damage + burning | Fire-resistant suit module |
| **Low-oxygen pocket** | Seal failure | Increasing stamina drain | O2 canister or suit scrubber |

---

## 6. Combat System

### Feel Reference

- **Doom 3:** Every corridor is a potential ambush box. Lighting is a resource. Reloading creates vulnerability windows. Monster closets (here: maintenance bay emergences) used sparingly for shock, not fatigue.
- **S.T.A.L.K.E.R.:** Enemies share information. A patrol that spots you calls others. Enemy factions fight each other independently. Economy of ammo means engagements must be deliberate.

### Core Mechanics

**Hitscan primaries** — instant ray cast, damage falloff modeled by range coefficient. No bullet travel time except for the plasma bolt secondary fire modes.

**Stamina** — sprint and melee share a stamina bar; suit upgrades extend it. Standing still regenerates stamina. Running while managing a contested firefight is a deliberate cost.

**Vitals persistence** — HP and suit integrity carry between station and moon within a single run. Medkits heal HP. Suit repair kits restore integrity. Radiation and bleeding are status effects that require item application to clear.

**Encumbrance** — backpack has a weight limit. Over-limit reduces sprint speed by 30%; at 150% limit, no sprint. Suits have different base carry limits.

**Flashlight** — toggleable. Consumes a battery cell over ~8 minutes. Battery cells are loot items. The engineering deck has no functional overhead lighting.

### Hit Locations

| Zone | Damage Multiplier | Notes |
|------|-------------------|-------|
| Head | ×2.5 | Helmets reduce incoming multiplier |
| Torso | ×1.0 | Armor plates absorb flat damage |
| Arms | ×0.7 | Arm armor reduces; disarm chance on unarmored hostiles |
| Legs | ×0.8 | Leg damage applies slow debuff above threshold |

### Status Effects

| Effect | Source | Player Remedy | Enemy Behavior Change |
|--------|--------|--------------|----------------------|
| **Bleeding** | Bullet wound (above bleed threshold) | Bandage item | Enemies who see blood spots can track |
| **Radiation** | Field exposure | Rad-flush injection | — |
| **Burning** | Fire anomaly, incendiary rounds | Fire-stop canister, movement | Enemies flee fire at low HP |
| **EMP** | Surge arc, EMP grenade | Wait 8 s or use surge suppressor | Mechanical enemies disabled 5 s |
| **Concussion** | Heavy explosive nearby | Wait; medkit clears faster | Stunned AI pauses action |

---

## 7. Weapons Catalog

### Design Intent

Weapons are graded across three axes: **damage**, **control** (accuracy / recoil), and **logistics** (ammo availability / reload speed). No single weapon dominates all three. Scarcity of ammo types is a systemic pressure — players carry one primary and one sidearm; the selection is a contract-prep decision.

Weapons can drop as **standard** (stock stats) or **modified** (procedural loot mod rolls on damage and fire rate — see `WeaponLootMods`). A third roll tier, **fractured**, indicates degraded baseline but with an extreme single stat spike.

---

### Primaries

#### P-01 · Assault Rifle `rifle_01`

| Stat | Value |
|------|-------|
| Fire mode | Full-auto |
| Damage (per hit) | 25 |
| Fire rate | 150 ms |
| Magazine | 30 rounds |
| Reload | 1.8 s |
| Effective range | 80 m |
| Ammo type | `5.56_std` |

**Role:** General-purpose mid-range control. Low recoil, predictable. The starting weapon. MTA issue; common in Salvager stashes.

**Lore:** Meridian Transit Authority standard-issue. Stamped "PROPERTY OF MTA SECURITY DIVISION" on the lower receiver, a designation that has not meant anything for years.

---

#### P-02 · Pump Shotgun `shotgun_01`

| Stat | Value |
|------|-------|
| Fire mode | Semi (pump cycle) |
| Damage (per pellet) | 15 |
| Pellets | 6 |
| Fire rate | 800 ms |
| Magazine | 8 shells |
| Reload | 2.2 s |
| Effective range | 15 m |
| Ammo type | `12g_buck` |

**Role:** CQB burst. Inside 10 m, a single shot is decisive. Engineering deck and maintenance bays favor this over the rifle. Falls off hard at range.

**Lore:** A salvage-market repeater with a sawn stock. Whoever shortened it optimized for corridors; they were right.

---

#### P-03 · Pulse Rifle `pulse_rifle`

| Stat | Value |
|------|-------|
| Fire mode | Full-auto |
| Damage (per hit) | 12 |
| Fire rate | 80 ms |
| Magazine | 60 cells |
| Reload | 2.0 s |
| Effective range | 65 m |
| Ammo type | `pulse_cell` |

**Role:** High rate of fire, shreds lightly armored targets. Cell ammo is rarer, so every pull costs. The emissive rail on the barrel bleeds blue light — a liability in dark sections.

**Lore:** Relay Ghost surplus. Designed for station internal security; the original selector had a stun mode that someone has wired out.

---

#### P-04 · Combat Carbine `carbine_mk2`

| Stat | Value |
|------|-------|
| Fire mode | Semi / 3-round burst (toggle) |
| Damage (per hit) | 32 |
| Fire rate | 200 ms (semi) / 180 ms burst |
| Magazine | 25 rounds |
| Reload | 1.6 s |
| Effective range | 100 m |
| Ammo type | `7.62_ap` |

**Role:** Longer range, harder hitting than the assault rifle. Armor-piercing rounds eat through Salvager plate. AP ammo is uncommon loot.

**Lore:** A pre-Decline MTA officer carbine. The fire-mode selector still clicks cleanly, which is more than can be said for most things on this stack.

---

#### P-05 · Thermal Lance `thermal_lance`

| Stat | Value |
|------|-------|
| Fire mode | Charge (hold trigger to charge, release to fire) |
| Damage | 80–240 (charge-dependent) |
| Fire rate | 2 400 ms (full charge cycle) |
| Magazine | 4 shots (thermal cells) |
| Reload | 3.0 s |
| Effective range | 50 m |
| Ammo type | `thermal_cell` |

**Role:** Anti-armor, anti-Deep-Fauna. Full charge one-shots most organic threats. The charge animation emits a heat shimmer — dangerous if heard by a patrol. Thermal cells are rare, expensive.

**Lore:** Mining equipment modified by the Unsanctioned for personal defense. The focusing crystal is held in place with industrial adhesive. Do not shake.

---

#### P-06 · Void Disruptor `void_disruptor`

| Stat | Value |
|------|-------|
| Fire mode | Burst (3-bolt spread) |
| Damage (per bolt) | 22 |
| Fire rate | 600 ms per burst |
| Magazine | 18 bolts |
| Reload | 2.5 s |
| Effective range | 40 m |
| Ammo type | `void_charge` |

**Role:** The only weapon that damages certain anomaly-imbued Deep Fauna effectively. Bolts travel at visible speed and arc slightly near gravity anomalies, making aim unpredictable in contaminated zones. Requires Unsanctioned rep to purchase.

**Lore:** Origin unknown. The casing is not a material in the station's manifest. Someone brought this through the Relay from somewhere else.

---

#### P-07 · Flechette SMG `smg_flechette`

| Stat | Value |
|------|-------|
| Fire mode | Full-auto |
| Damage (per hit) | 18 |
| Fire rate | 100 ms |
| Magazine | 40 rounds |
| Reload | 1.4 s |
| Effective range | 30 m |
| Ammo type | `9mm_std` |

**Role:** Fast ADS, low recoil, excellent for clearing grouped enemies in corridors. 9 mm is the most common ammo type; logistics-friendly. Damage drops off sharply past 30 m.

**Lore:** A lightweight personal defense weapon issued to MTA maintenance crews. This one has been field-modified with a forward grip cut from a cargo strap.

---

#### P-08 · Slug Cannon `slug_cannon`

| Stat | Value |
|------|-------|
| Fire mode | Semi |
| Damage (per slug) | 90 |
| Fire rate | 1 200 ms |
| Magazine | 5 slugs |
| Reload | 3.5 s |
| Effective range | 60 m |
| Ammo type | `20g_slug` |

**Role:** Single large projectile, massive stagger on hit. Forces enemy AI into a wounded-behavior state at ~40% HP. Slow and loud; alerts every patrol on the floor.

**Lore:** Station security used these to breach sealed cargo doors. Repurposed for everything else once the doors stopped needing breaching.

---

### Sidearms

#### S-01 · Station Pistol `pistol_std`

| Stat | Value |
|------|-------|
| Fire mode | Semi |
| Damage | 20 |
| Fire rate | 350 ms |
| Magazine | 12 rounds |
| Reload | 1.2 s |
| Ammo type | `9mm_std` |

**Role:** Emergency backup. Shares 9 mm with the SMG, making it tactically paired. Not a primary-replacement.

---

#### S-02 · Heavy Revolver `revolver_454`

| Stat | Value |
|------|-------|
| Fire mode | Semi (double action) |
| Damage | 55 |
| Fire rate | 500 ms |
| Magazine | 6 rounds |
| Reload | 2.8 s |
| Ammo type | `.454_mag` |

**Role:** High damage per shot, stagger on hit. Ammo is rare but heavy-hitting. Favored for named-boss contracts.

---

#### S-03 · Compact Pulse `pulse_compact`

| Stat | Value |
|------|-------|
| Fire mode | Semi |
| Damage | 16 |
| Fire rate | 300 ms |
| Magazine | 20 cells |
| Reload | 1.5 s |
| Ammo type | `pulse_cell` |

**Role:** Shares pulse cells with the Pulse Rifle. Lightweight, no emissive bleed in dark corridors. The only sidearm effective against anomaly-imbued targets.

---

### Weapon Modification System

Each weapon can accept up to **two modification slots** (unlocked via armory bench on ship). Mods are looted or purchased. Procedural loot rolls can apply `damageMod` and `fireRateMod` multipliers directly to stat baselines.

| Mod | Effect | Slot Type |
|-----|--------|-----------|
| **Extended Magazine** | +50% capacity | Magazine |
| **Suppressor** | Reduces detection range by 60%; −8% damage | Barrel |
| **AP Rounds** | Armor-piercing; +25% vs. armored, −10% vs. unarmored | Ammo conversion |
| **Thermal Sight** | Highlights warm targets through thin walls | Optic |
| **Laser Designator** | +15% hip-fire accuracy | Rail |
| **Void-Quench Liner** | Reduces void_charge arc variance by 40% | Special (Void Disruptor only) |
| **Heavy Bolt** | −20% fire rate, +35% damage and stagger | Internal |
| **Lightweight Frame** | −20% encumbrance weight, −10% stability | Frame |

---

## 8. Armor & Suits Catalog

### Design Intent

Suits are the primary expression of player identity and preparation. Each suit represents a philosophy: survivability, mobility, stealth, or hazard resistance. Suits degrade during runs; worn suits reduce their effective rating. Condition is persistent — a cracked chest plate from last run still cracks the same way this run unless you repaired it.

Suits have **modular upgrade slots** that accept physical components (purchased or looted). Upgrades are permanent once installed but can be swapped at the ship's suit bench.

---

### Suit Classes

#### A-01 · MTA Maintenance Coverall `suit_maintenance`

| Stat | Value |
|------|-------|
| Armor rating | 10 |
| Carry capacity | 20 kg |
| Suit integrity | 80 HP |
| Radiation resistance | None |
| Pressure rating | Unrated |
| Mobility | 100% |
| Upgrade slots | 1 |

**Role:** Starter suit. Minimal protection, maximum mobility. No environmental resistance. Good for stealth-constraint contracts where taking a hit is already a failure.

**Lore:** Standard-issue from the station's last operating crew rotation. The patches on the elbows are from someone else's run.

---

#### A-02 · Frontier Tactical Vest `suit_tac_vest`

| Stat | Value |
|------|-------|
| Armor rating | 25 |
| Carry capacity | 25 kg |
| Suit integrity | 120 HP |
| Radiation resistance | None |
| Pressure rating | Unrated |
| Mobility | 92% |
| Upgrade slots | 2 |

**Role:** Balanced starter progression. Absorbs a burst engagement without failing. The go-to for Dock-tier contracts.

**Lore:** Salvager salvage. Whoever owned this before bolted on an extra plate over the left shoulder — probably had a reason.

---

#### A-03 · Void Relay Heavy Plate `suit_heavy_plate`

| Stat | Value |
|------|-------|
| Armor rating | 45 |
| Carry capacity | 30 kg |
| Suit integrity | 200 HP |
| Radiation resistance | Low |
| Pressure rating | 1 atm variance |
| Mobility | 75% |
| Upgrade slots | 3 |

**Role:** Maximum survivability at a severe mobility cost. Effective for objectives requiring sustained presence in combat (escort, wave defense). A slow target in corridors.

**Lore:** MTA Security response gear. The weight rating label reads 41 kg — heavier now from the plating added after whatever happened on level 4.

---

#### A-04 · Ghost Operative Suit `suit_ghost_ops`

| Stat | Value |
|------|-------|
| Armor rating | 18 |
| Carry capacity | 22 kg |
| Suit integrity | 100 HP |
| Radiation resistance | None |
| Pressure rating | Unrated |
| Mobility | 108% |
| Stealth rating | +30% |
| Upgrade slots | 2 |

**Role:** Stealth and speed. Movement noise reduced. Step speed penalty removed. Effective for `STEALTH` constraint contracts and data extraction objectives. Glass cannon — one serious hit is a crisis.

**Lore:** Relay Ghost surplus; those who stayed on the station after the evacuation moved quietly. This suit helped them do it.

---

#### A-05 · Hazmat Shell `suit_hazmat`

| Stat | Value |
|------|-------|
| Armor rating | 20 |
| Carry capacity | 18 kg |
| Suit integrity | 150 HP |
| Radiation resistance | High |
| Pressure rating | 3 atm variance |
| Toxic resistance | Medium |
| Mobility | 80% |
| Upgrade slots | 2 |

**Role:** Deep Spine work. Radiation and anomaly contamination fields require this or better. Poor combat performance, but the biohazard seal and filter stack allow extended operation in environments that would otherwise kill in minutes.

**Lore:** Designed for reactor maintenance. The oxygen recycler works. The radiation counter still ticks in the sealed sections, which means the display is accurate, which is worse than if it were broken.

---

#### A-06 · Unsanctioned Composite `suit_unsanctioned`

| Stat | Value |
|------|-------|
| Armor rating | 38 |
| Carry capacity | 28 kg |
| Suit integrity | 170 HP |
| Radiation resistance | Medium |
| Pressure rating | 2 atm variance |
| Mobility | 87% |
| Upgrade slots | 4 |

**Role:** The best all-rounder in the catalog. Requires Unsanctioned faction reputation level 3 to purchase. High armor, moderate environmental resistance, best upgrade capacity. Rare loot drop in Black Warrant zones.

**Lore:** Built by the Unsanctioned from salvaged components of at least three different suit classes. The welder seams are impeccable. Whoever built this knew exactly what they needed to survive and built it precisely.

---

#### A-07 · Deep Spine Exoframe `suit_exoframe`

| Stat | Value |
|------|-------|
| Armor rating | 60 |
| Carry capacity | 40 kg |
| Suit integrity | 300 HP |
| Radiation resistance | Very High |
| Pressure rating | 6 atm variance |
| Anomaly resistance | Low–Medium (passive dampening) |
| Mobility | 62% |
| Upgrade slots | 5 |

**Role:** Endgame survivability. Required for certain Black Warrant objectives in the deep spine core. Extremely slow. Cannot sprint in standard configuration (sprint module upgrade available). Carrying this through a corridor ambush without tactical positioning is a mistake.

**Lore:** Three exist in known circulation. MTA denies manufacturing them. The exoframe's void-lattice underlayer absorbs a fraction of anomaly field energy — a material property not listed in any MTA specification.

---

### Suit Upgrade Modules

| Module | Compatible Suits | Effect |
|--------|-----------------|--------|
| **Surge Insulation** | All | EMP immunity; arc stagger immunity |
| **Rad-Block Liner** | All | Upgrades radiation resistance by one tier |
| **Sprint Assist** | Exoframe only | Restores sprint at −8% speed vs. baseline |
| **Stealth Padding** | Tac Vest, Ghost, Unsanctioned | +20% stealth rating |
| **Medkit Integration** | All | Reduces medkit apply time by 40% |
| **Expanded Rig** | All | +8 kg carry capacity |
| **Reactive Plates** | Heavy Plate, Exoframe | Reflects 10% melee damage to attacker |
| **O2 Scrubber Upgrade** | Hazmat, Exoframe | Extends O2 in low-oxygen pockets by 3× |
| **Void-Dampening Layer** | Unsanctioned, Exoframe | Increases anomaly resistance by one tier |
| **Trauma Pad** | Heavy Plate, Exoframe | Reduces bleeding chance by 60% |

---

## 9. Gadgets & Equipment

| Item | Slot | Use | Notes |
|------|------|-----|-------|
| **Medkit** | Consumable | +60 HP, clears bleeding | 3 s application |
| **Bandage** | Consumable | Clears bleeding only | 1.5 s |
| **Rad-Flush Injection** | Consumable | Clears radiation status | Instant |
| **Battery Cell** | Consumable | +8 min flashlight | Stackable ×5 |
| **Surge Suppressor** | Consumable | Clears EMP status instantly | Single use |
| **Fire-Stop Canister** | Consumable | Clears burning; 2 s spray | |
| **Concussive Pulse** | Gadget (G key) | 5 m AoE stagger; EMP vs. mechanical | 45 s cooldown |
| **Bolt Anchor** | Gadget | Counters gravity anomaly pull | 90 s cooldown |
| **Scanner** | Gadget | Highlights loot containers and anomaly types within 12 m | 1 s scan |
| **Motion Detector** | Gadget | Audio ping on moving targets within 8 m | Passive, battery drain |
| **Proximity Mine** | Deployable | Triggers on warm body, 40 damage + bleed | ×2 carry limit |
| **Smoke Canister** | Deployable | 8 s smoke cloud; blocks AI line-of-sight | Throwable |
| **Distraction Node** | Deployable | Draws patrol attention to planted location for 10 s | |

---

## 10. Enemies & AI Behavior

### Enemy Roster

#### E-01 · Station Drifter (Relay Ghost)

**Tier:** 1  
**HP:** 60  
**Armor:** None  
**Weapons:** Pistol, improvised melee  
**Behavior:** Patrol routes seeded per run. On detection: calls for backup via radio (30 s delay). Falls back to cover under fire. Surrenders at <20 HP if player does not fire for 3 s (faction rep interaction point).

---

#### E-02 · Thornfield Salvager (Regular)

**Tier:** 2  
**HP:** 90  
**Armor:** Tac Vest equivalent (absorbs 25 flat before HP damage)  
**Weapons:** Assault Rifle, Shotgun, Pistol  
**Behavior:** Squad-coordinated. Will flank if player holds position. Communicates position to squad leader. Lootable for ammo and credits.

---

#### E-03 · Thornfield Salvager (Heavy)

**Tier:** 3  
**HP:** 180  
**Armor:** Heavy Plate equivalent  
**Weapons:** Slug Cannon, SMG  
**Behavior:** Slow, advances under cover fire from regular. Takes reduced stagger. Calls in reinforcement drone if HP drops below 50%.

---

#### E-04 · MTA Security Drone (Mechanical)

**Tier:** 2  
**HP:** 120  
**Armor:** 30 flat (mechanical plating)  
**Attack:** Burst laser (30 damage per burst, 600 ms)  
**Behavior:** Patrols a fixed loop; switches to pursuit on visual. Vulnerable to EMP (5 s disable). Cannot be negotiated with. Returns to loop after 60 s of lost contact.

---

#### E-05 · Spine Crawler (Deep Fauna)

**Tier:** 3  
**HP:** 140  
**Armor:** Anomaly shell (standard rounds deal −30% damage; void_charge deals full)  
**Attack:** Lunge (60 damage), spit (15/s acid, 3 s duration)  
**Behavior:** Passive until within 6 m or loud activity. Pack behavior: one crawler alerts others within 20 m. Does not respect faction lines. Spawns in Deep Spine sections.

---

#### E-06 · Void Remnant (Deep Fauna — Elite)

**Tier:** 4  
**HP:** 350  
**Armor:** Anomaly lattice (immune to non-void weapons; Thermal Lance full damage; Void Disruptor ×1.5)  
**Attack:** Gravity pulse (AoE pull + 40 damage), void lash (melee, 80 damage)  
**Behavior:** Ambushes from out-of-sight cover. Teleports short distances when below 50% HP. One per seeded encounter; does not respawn in the same run. Boss-tier for Black Warrant contracts.

---

#### E-07 · Named Salvager Boss (Contract Target)

**Tier:** Contract-scaled  
**HP:** Base 240 + (tier × 80)  
**Behavior:** Unique AI routine per named target (procedurally assigned from a pool of 12 behavior archetypes: Sniper, Brawler, Commander, Medic, Flanker, etc.). Carries a guaranteed rare or epic loot drop. One per contract run.

---

### AI Systems

**Awareness Levels:**
1. **Unaware** — standard patrol  
2. **Suspicious** — heard something; investigates last-known  
3. **Alerted** — visual or confirmed audio; pursues; radios backup  
4. **Combat** — active engagement  
5. **Searching** — lost player; sweeps area for 90 s before returning to patrol  

**Faction Combat:** Salvagers and Relay Ghosts will engage each other if they meet in-zone. Player can exploit this. MTA drones shoot anything including other faction enemies.

---

## 11. Player Progression

### Reputation System

| Faction | Gain Method | Benefits at Higher Rep |
|---------|------------|------------------------|
| **MTA** | Complete MTA contracts, return survey data | Higher-tier contracts unlocked; armory discount |
| **Thornfield Salvagers** | Complete salvager side-jobs; do not kill their non-hostile members | Passage through Salvager-controlled sections; access to black-market ammo |
| **Relay Ghosts** | Leave supplies at Ghost stashes; answer distress signals | Safe passage; Ghost members reveal patrol routes |
| **Unsanctioned** | Deliver contraband; complete Black Warrant adjacent tasks | Void Disruptor purchase; Composite Suit access; artifact deals |

Rep is persistent across runs (stored in IndexedDB stash DB). Killing faction members reduces rep.

### Skill Progression

Skills are unlocked by **doing**, not by menu selection — the STALKER model:

| Skill | Unlock Condition | Effect |
|-------|-----------------|--------|
| **Field Reload** | Reload under fire 20 times | Reload time −15% |
| **Quiet Step** | Complete 5 STEALTH contracts | Movement noise −20% |
| **Anomaly Reader** | Scan 30 anomalies | Scanner range +6 m |
| **Trauma Response** | Apply 30 bandages mid-combat | Bleeding heal time −50% |
| **Heavy Carry** | Extract with overweight pack 10 times | Overweight speed penalty reduced to −15% |
| **Drone Killer** | Destroy 40 MTA drones | EMP gadget cooldown −20 s |
| **Void Walker** | Enter Deep Spine Core 5 times | Anomaly resistance passive +1 tier |

---

## 12. Economy & Trading

### Credits

Credits are the universal currency. Earned via:
- Contract payouts (on green extract to ship)
- Selling looted items at the armory/trade console
- Faction bounties (passive — turn in enemy tags at faction rep contact)

### Ship Armory

| Category | Available Items | Pricing |
|----------|----------------|---------|
| Weapons | All standard archetypes; rare mods occasionally stocked | Fixed price per archetype (see §7) |
| Suit repairs | Restore suit integrity to 100% | 0.5 credits/HP repaired |
| Suit upgrades | Module installation | 150–800 credits per module |
| Consumables | Medkits, bandages, battery cells, canisters | 20–80 credits each |
| Ammo | All standard types; void_charge and thermal_cell are expensive | 5–120 credits per unit |

### Faction Vendors

Each faction rep level 2+ unlocks an in-zone or ship-dockable vendor:

- **Salvager Black Market:** AP rounds, Heavy Bolt mod, discounted shotguns
- **Ghost Contact:** Motion detectors, distraction nodes, Ghost Operative Suit
- **Unsanctioned Dealer:** Void Disruptor, void_charge, Composite Suit, artifact appraisal
- **MTA Automated Kiosk:** Standard consumables at slight discount; accepts MTA data recovery as partial payment

### Artifacts

Artifacts recovered from Deep Spine anomaly fields are the highest-value items in the economy. Each artifact is unique and procedurally generated with 2–4 properties:

| Artifact Property Pool | Effect When Worn (suit slot) or Sold |
|------------------------|--------------------------------------|
| Void Lattice Fragment | Passive anomaly resistance; high sell value |
| Thermal Core | Suit heating system (counters low-O2 drain) |
| Gravity Damper | Immunity to gravity well pull |
| Pulse Echo | +5% pulse weapon damage |
| Spectral Band | Increases scanner passive radius |

Artifacts have **integrity** — damage in the field degrades integrity and lowers value. Selling a 100%-integrity artifact to the Unsanctioned Dealer pays 3–12× the standard vendor value.

---

## 13. Narrative Fragments & Atmosphere

### Diegetic Storytelling

Following the Doom 3 and STALKER model, story is found, not presented. Sources:

- **Terminal logs** — each terminal in the zone has text entries accessible via `E` interact. Entries are seeded from a pool per run; priority entries (contract-related) always placed. Non-priority entries are atmospheric world-building.
- **Audio fragments** — triggered by proximity; distress recordings, maintenance chatter, anomalous signal bursts. One-shot per run.
- **Environmental tells** — bloodstains indicating a direction of travel, barricaded doors with handwritten warnings, improvised campsites with faction-identifying items.
- **Body loot + notes** — enemy corpses occasionally carry handwritten notes that are fragments of larger narratives.

### Main Narrative Thread

Recovered across multiple runs through terminal logs and artifact descriptions:

> The biohazard event logged on VS-7 Level 4 was not biological. The official incident report sealed by MTA references a "relay resonance cascade" — an event that has no prior entry in the MTA incident taxonomy. The resonance did not kill the crew. It changed them. Some of them are still here. Some of them are still changing. The Void Relay doesn't just move ships between stars. Someone built it to move something else. They built it successfully.

This thread is optional and never mission-critical. Players who ignore terminals miss context but not mechanics. Players who pursue it unlock the Black Warrant contract tier and eventually the option to confront what is in the deep spine core.

---

## 14. Audio Design Philosophy

### Reference Points

- **Doom 3:** Near-silence punctuated by mechanical ambience. Monsters heard before seen. Footsteps communicate surface type (metal grating vs. flooded floor vs. debris).
- **STALKER:** Zone ambience layers: distant gunfire, wind through hull breaches, anomaly hum. Music is rare and diegetic (faction radio broadcasts, degraded PA system).

### Audio Rules

1. No non-diegetic combat music. Tension is ambient.
2. Enemy voice lines are heard before visual contact whenever possible.
3. Flashlight battery warning is audio-first (a rising electronic tone) before any UI indicator appears.
4. Suit integrity warnings are audio (creak/crack sounds) before suit condition UI flashes.
5. Anomaly fields have unique audio signatures — players can learn to identify field types by sound before scanning.
6. Extract beacon has a distinct, calm audio tone. It is the sound of success. It should feel immediately recognizable and never overused.

---

## 15. Technical Reference

### Stack

| Layer | Technology |
|-------|-----------|
| Runtime | TypeScript, Vite 5 |
| 3D Engine | Babylon.js 7 |
| Physics | Havok WASM |
| Pathfinding | Recast-Detour (navmesh) |
| UI | React 18 |
| Persistence | Dexie / IndexedDB |

### Data Flow

```
ContractTemplate (seeded) → ContractRules.ts → active contract state
                                                      │
LootTables.ts (per zone/room) → LootRoller → RaidLootGrant[]
                                                      │
WeaponDefinitions.ts (archetypes + mods) → WeaponController → HUD state
                                                      │
persistence/ (Dexie) ← raidInventoryMerge on green extract
```

### Procedural Contract Integration Points

- `contractRules.ts` — extend `CANONICAL_CONTRACT_SEEDS` with generated entries; add new objective types to `contractPayoutEligible`
- `lootTables.ts` — room-type buckets control quest item placement per seed
- `lootRoller.ts` — handles weighted picks and `damageMod`/`fireRateMod` rolls on weapon drops
- Enemy patrol seeds should be passed through the run-level RNG derived from the contract seed ID to ensure reproducible runs for diagnostic purposes

### Suit Integrity Persistence

Suit integrity at time of green extract is written to the stash DB alongside weapon and ammo state. The suit bench on the ship reads current integrity and calculates repair cost before the player's next deploy. Suits that reach 0 integrity mid-run apply a −50% armor rating penalty for the remainder of the run.

---

*Void Sovereigns GDD · Setting and terminology attribution: [Void Sovereigns Online](https://github.com/awest813/Void-Sovereigns-Online) (MIT) · FPS prototype design v0.2*
