import {
  Scene,
  Vector3,
  HemisphericLight,
  PointLight,
  MeshBuilder,
  Color3,
  Color4,
  PhysicsAggregate,
  PhysicsShapeType,
  PBRMaterial,
  Mesh,
  Sound,
} from '@babylonjs/core';
import { Game } from '../Game';
import { PlayerController } from '../player/PlayerController';
import { GameState } from '../StateMachine';
import { placeBabylonModel } from '../loaders/BabylonHostedDecor';
import { BABYLON_ENV_STUDIO } from '../loaders/BabylonAssetUrls';
import { applyBabylonIBL } from '../loaders/applyBabylonIBL';
import { createIndustrialBump, createShipStarfield, makePbrMetalPanel } from '../loaders/IndustrialMaterials';
import { getContractDeployZone } from '../contracts/contractRules';

/**
 * ShipScene — the player hub aboard the ICV Relentless, a Meridian-class heavy freighter.
 *
 * Layout (top-down, Z = forward/bow):
 *   z  40 ─ Bow observation window
 *   z  30 ─ Bridge / ops console
 *   z  -10 ─ Aft cross-corridor
 *   z  -22 ─ Armory bay (port) | Engineering alcove (starboard)
 *   z  -34 to -42 ─ Airlock row: Alpha (port, station/moon) | Beta (starboard, planet outpost)
 */
export class ShipScene {
  private game: Game;
  private airlockAlphaMesh: Mesh | null = null;
  private airlockBetaMesh: Mesh | null = null;
  private alphaLight: PointLight | null = null;
  private betaLight: PointLight | null = null;

  constructor(game: Game) {
    this.game = game;
  }

  public async create(): Promise<Scene> {
    const scene = new Scene(this.game.engine);
    scene.clearColor = new Color4(0.01, 0.012, 0.03, 1);

    applyBabylonIBL(scene, BABYLON_ENV_STUDIO, {
      intensity: 0.88,
      exposure: 0.96,
      contrast: 1.05,
    });

    if (this.game.havokPlugin) {
      scene.enablePhysics(new Vector3(0, -9.81, 0), this.game.havokPlugin);
    }

    const bump = createIndustrialBump(scene, 'shipDeckBump', 4);
    const starfield = createShipStarfield(scene, 560);
    starfield.position.set(0, 3, 42);

    // ── Materials ──────────────────────────────────────────────────────────────
    const floorMat  = makePbrMetalPanel(scene, 'shipFloorMat',  new Color3(0.14, 0.16, 0.20), bump, 0.42, 0.62);
    const wallMat   = makePbrMetalPanel(scene, 'shipWallMat',   new Color3(0.24, 0.26, 0.30), bump, 0.55, 0.58);
    const accentMat = makePbrMetalPanel(scene, 'shipAccentMat', new Color3(0.52, 0.26, 0.08), bump, 0.65, 0.45);
    const cargoBulk = makePbrMetalPanel(scene, 'cargoBulkMat',  new Color3(0.18, 0.2, 0.24),  bump, 0.48, 0.7);
    const stashMat  = makePbrMetalPanel(scene, 'stashMat',      new Color3(0.18, 0.24, 0.20), bump, 0.5, 0.68);

    const airlockAlphaMat = new PBRMaterial('airlockAlphaMat', scene);
    airlockAlphaMat.albedoColor = new Color3(0.38, 0.12, 0.12);
    airlockAlphaMat.metallic = 0.7;
    airlockAlphaMat.roughness = 0.38;
    airlockAlphaMat.emissiveColor = new Color3(0.22, 0.04, 0.04);

    const airlockBetaMat = new PBRMaterial('airlockBetaMat', scene);
    airlockBetaMat.albedoColor = new Color3(0.12, 0.22, 0.38);
    airlockBetaMat.metallic = 0.7;
    airlockBetaMat.roughness = 0.38;
    airlockBetaMat.emissiveColor = new Color3(0.04, 0.08, 0.22);

    const glassMat = new PBRMaterial('shipGlassMat', scene);
    glassMat.albedoColor = new Color3(0.08, 0.28, 0.48);
    glassMat.alpha = 0.38;
    glassMat.metallic = 0.02;
    glassMat.roughness = 0.08;
    glassMat.indexOfRefraction = 1.45;
    glassMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;

    const consoleMat = new PBRMaterial('consoleMat', scene);
    consoleMat.albedoColor = new Color3(0.1, 0.14, 0.18);
    consoleMat.metallic = 0.75;
    consoleMat.roughness = 0.35;
    consoleMat.emissiveColor = new Color3(0.02, 0.05, 0.12);

    const screenMat = new PBRMaterial('screenMat', scene);
    screenMat.emissiveColor = new Color3(0.15, 0.75, 0.95);
    screenMat.metallic = 0;
    screenMat.roughness = 1;

    const kioskMat  = makePbrMetalPanel(scene, 'kioskMat',  new Color3(0.30, 0.22, 0.14), bump, 0.55, 0.50);
    const lockerMat = makePbrMetalPanel(scene, 'lockerMat', new Color3(0.16, 0.20, 0.24), bump, 0.58, 0.65);
    const tableMat  = makePbrMetalPanel(scene, 'tableMat',  new Color3(0.22, 0.20, 0.18), bump, 0.62, 0.60);

    const noticeMat = new PBRMaterial('noticeMat', scene);
    noticeMat.albedoColor  = new Color3(0.18, 0.36, 0.28);
    noticeMat.metallic     = 0.15;
    noticeMat.roughness    = 0.80;
    noticeMat.emissiveColor = new Color3(0.04, 0.14, 0.08);

    // ── Helpers ────────────────────────────────────────────────────────────────
    const addBox = (
      name: string,
      opts: { width: number; height: number; depth: number },
      pos: Vector3,
      mat: PBRMaterial,
      mass = 0,
      pickable = true,
    ) => {
      const m = MeshBuilder.CreateBox(name, opts, scene);
      m.position.copyFrom(pos);
      m.material = mat;
      m.isPickable = pickable;
      new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass }, scene);
      return m;
    };

    // ── MAIN FREIGHTER STRUCTURE ───────────────────────────────────────────────
    // The ship is ~44 units wide and ~74 units long (z: -34 → 40).
    const SHIP_W  = 44;   // total interior width
    const SHIP_H  = 8;    // ceiling height
    const CEIL_Y  = SHIP_H - 0.5;  // 7.5

    // --- Cargo Bay: z -10 → 30, full width ---
    const cargoFloor = MeshBuilder.CreateBox('cargoFloor', { width: SHIP_W, height: 1, depth: 40 }, scene);
    cargoFloor.position.set(0, -0.5, 10);
    cargoFloor.material = floorMat;
    cargoFloor.metadata = { ...(cargoFloor.metadata ?? {}), surfaceSound: 'metal' };
    new PhysicsAggregate(cargoFloor, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const cargoCeiling = MeshBuilder.CreateBox('cargoCeiling', { width: SHIP_W, height: 1, depth: 40 }, scene);
    cargoCeiling.position.set(0, CEIL_Y, 10);
    cargoCeiling.material = cargoBulk;
    cargoCeiling.isPickable = false;
    new PhysicsAggregate(cargoCeiling, PhysicsShapeType.BOX, { mass: 0 }, scene);

    // Cargo bay port/starboard walls (full height)
    addBox('cargoWallW', { width: 1, height: SHIP_H, depth: 40 }, new Vector3(-21.5, SHIP_H / 2, 10), wallMat);
    addBox('cargoWallE', { width: 1, height: SHIP_H, depth: 40 }, new Vector3(21.5, SHIP_H / 2, 10), wallMat);

    // Cargo bay aft wall (z = -10)
    addBox('cargoAft', { width: SHIP_W, height: SHIP_H, depth: 1 }, new Vector3(0, SHIP_H / 2, -10), wallMat);

    // Large structural pillars in the cargo bay (port and starboard, two rows)
    const pillarOpts = { width: 1.5, height: SHIP_H, depth: 1.5 };
    const pillarPositions: [number, number][] = [
      [-15, -2], [-15, 10], [-15, 22],
      [ 15, -2], [ 15, 10], [ 15, 22],
    ];
    pillarPositions.forEach(([px, pz], i) => {
      addBox(`pillar_${i}`, pillarOpts, new Vector3(px, SHIP_H / 2, pz), cargoBulk);
    });

    // Raised catwalk along the port wall (x = -18, z = -5 → 28)
    const catWalk = MeshBuilder.CreateBox('catwalk', { width: 3, height: 0.25, depth: 33 }, scene);
    catWalk.position.set(-18, 3.5, 11.5);
    catWalk.material = accentMat;
    new PhysicsAggregate(catWalk, PhysicsShapeType.BOX, { mass: 0 }, scene);

    // Catwalk railings
    addBox('railN', { width: 3, height: 1, depth: 0.15 }, new Vector3(-18, 4.5, 28.1), accentMat, 0, false);
    addBox('railS', { width: 3, height: 1, depth: 0.15 }, new Vector3(-18, 4.5, -4.9), accentMat, 0, false);
    addBox('railOut', { width: 0.15, height: 1, depth: 33 }, new Vector3(-16.6, 4.5, 11.5), accentMat, 0, false);

    // --- Bridge Corridor: z 30 → 40, narrowed to 18 wide ---
    const bridgeFloor = MeshBuilder.CreateBox('bridgeFloor', { width: 18, height: 1, depth: 10 }, scene);
    bridgeFloor.position.set(0, -0.5, 35);
    bridgeFloor.material = floorMat;
    bridgeFloor.metadata = { ...(bridgeFloor.metadata ?? {}), surfaceSound: 'metal' };
    new PhysicsAggregate(bridgeFloor, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const bridgeCeiling = MeshBuilder.CreateBox('bridgeCeiling', { width: 18, height: 1, depth: 10 }, scene);
    bridgeCeiling.position.set(0, CEIL_Y, 35);
    bridgeCeiling.material = wallMat;
    bridgeCeiling.isPickable = false;
    new PhysicsAggregate(bridgeCeiling, PhysicsShapeType.BOX, { mass: 0 }, scene);

    addBox('bridgeWallW', { width: 1, height: SHIP_H, depth: 10 }, new Vector3(-9, SHIP_H / 2, 35), wallMat);
    addBox('bridgeWallE', { width: 1, height: SHIP_H, depth: 10 }, new Vector3(9, SHIP_H / 2, 35), wallMat);
    // Bridge ─ cargo bay transition walls (port/starboard extensions)
    addBox('bridgeWingWW', { width: 12, height: SHIP_H, depth: 1 }, new Vector3(-16, SHIP_H / 2, 30), wallMat);
    addBox('bridgeWingEE', { width: 12, height: SHIP_H, depth: 1 }, new Vector3(16, SHIP_H / 2, 30), wallMat);

    // Panoramic bow window
    const winFrame = MeshBuilder.CreateBox('bowWinFrame', { width: 18, height: 1, depth: 1 }, scene);
    winFrame.position.set(0, 0.5, 40);
    winFrame.material = wallMat;
    new PhysicsAggregate(winFrame, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const winTop = MeshBuilder.CreateBox('bowWinTop', { width: 18, height: 1, depth: 1 }, scene);
    winTop.position.set(0, CEIL_Y, 40);
    winTop.material = wallMat;
    new PhysicsAggregate(winTop, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const winGlass = MeshBuilder.CreateBox('bowGlass', { width: 18, height: 6, depth: 0.2 }, scene);
    winGlass.position.set(0, 3.75, 40);
    winGlass.material = glassMat;
    winGlass.isPickable = false;
    new PhysicsAggregate(winGlass, PhysicsShapeType.BOX, { mass: 0 }, scene);

    // --- Aft Cross-Corridor: z -10 → -22, full width ---
    const aftFloor = MeshBuilder.CreateBox('aftFloor', { width: SHIP_W, height: 1, depth: 12 }, scene);
    aftFloor.position.set(0, -0.5, -16);
    aftFloor.material = floorMat;
    aftFloor.metadata = { ...(aftFloor.metadata ?? {}), surfaceSound: 'metal' };
    new PhysicsAggregate(aftFloor, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const aftCeiling = MeshBuilder.CreateBox('aftCeiling', { width: SHIP_W, height: 1, depth: 12 }, scene);
    aftCeiling.position.set(0, CEIL_Y, -16);
    aftCeiling.material = cargoBulk;
    aftCeiling.isPickable = false;
    new PhysicsAggregate(aftCeiling, PhysicsShapeType.BOX, { mass: 0 }, scene);

    addBox('aftWallW', { width: 1, height: SHIP_H, depth: 12 }, new Vector3(-21.5, SHIP_H / 2, -16), wallMat);
    addBox('aftWallE', { width: 1, height: SHIP_H, depth: 12 }, new Vector3(21.5, SHIP_H / 2, -16), wallMat);

    // --- Armory Bay (port aft): x -22 → -10, z -22 → -34 ---
    const armoryFloor = MeshBuilder.CreateBox('armoryFloor', { width: 12, height: 1, depth: 12 }, scene);
    armoryFloor.position.set(-16, -0.5, -28);
    armoryFloor.material = floorMat;
    new PhysicsAggregate(armoryFloor, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const armoryCeil = MeshBuilder.CreateBox('armoryCeil', { width: 12, height: 1, depth: 12 }, scene);
    armoryCeil.position.set(-16, CEIL_Y, -28);
    armoryCeil.material = wallMat;
    armoryCeil.isPickable = false;
    new PhysicsAggregate(armoryCeil, PhysicsShapeType.BOX, { mass: 0 }, scene);

    addBox('armoryWallW',  { width: 1, height: SHIP_H, depth: 12 }, new Vector3(-22, SHIP_H / 2, -28), wallMat);
    addBox('armoryWallN',  { width: 12, height: SHIP_H, depth: 1 }, new Vector3(-16, SHIP_H / 2, -22), wallMat);
    addBox('armoryWallS',  { width: 12, height: SHIP_H, depth: 1 }, new Vector3(-16, SHIP_H / 2, -34), wallMat);

    // Armory contents: stash crates + weapon racks
    const stashInteract = {
      hudLabel: 'Open Stash & Loadout',
      onInteract: () => {
        window.dispatchEvent(new CustomEvent('toggleShipUI'));
        document.exitPointerLock();
      }
    };

    const cA = addBox('ArmCrateA', { width: 1.6, height: 1.0, depth: 1.6 }, new Vector3(-20, 0.5, -26), stashMat, 0);
    const cB = addBox('ArmCrateB', { width: 1.6, height: 1.0, depth: 1.6 }, new Vector3(-20, 1.5, -26), stashMat, 0);
    const cC = addBox('ArmCrateC', { width: 1.6, height: 1.0, depth: 1.6 }, new Vector3(-20, 0.5, -29), stashMat, 0);
    cA.metadata = stashInteract;
    cB.metadata = stashInteract;
    cC.metadata = stashInteract;
    
    addBox('Weapon Rack', { width: 0.2, height: 4, depth: 4 }, new Vector3(-21.5, 2, -32), accentMat);

    // --- Engineering Alcove (starboard aft): x 10 → 22, z -22 → -34 ---
    const engFloor = MeshBuilder.CreateBox('engFloor', { width: 12, height: 1, depth: 12 }, scene);
    engFloor.position.set(16, -0.5, -28);
    engFloor.material = floorMat;
    new PhysicsAggregate(engFloor, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const engCeil = MeshBuilder.CreateBox('engCeil', { width: 12, height: 1, depth: 12 }, scene);
    engCeil.position.set(16, CEIL_Y, -28);
    engCeil.material = wallMat;
    engCeil.isPickable = false;
    new PhysicsAggregate(engCeil, PhysicsShapeType.BOX, { mass: 0 }, scene);

    addBox('engWallE', { width: 1, height: SHIP_H, depth: 12 }, new Vector3(22, SHIP_H / 2, -28), wallMat);
    addBox('engWallN', { width: 12, height: SHIP_H, depth: 1 }, new Vector3(16, SHIP_H / 2, -22), wallMat);
    addBox('engWallS', { width: 12, height: SHIP_H, depth: 1 }, new Vector3(16, SHIP_H / 2, -34), wallMat);

    // Engineering: large reactor block + console
    addBox('ReactorBlock', { width: 4, height: 4, depth: 4 }, new Vector3(18, 2, -30), cargoBulk);
    addBox('EngConsole', { width: 3.5, height: 1, depth: 1.2 }, new Vector3(13, 0.6, -25), consoleMat);

    // ── CARGO BAY — extra freight atmosphere ───────────────────────────────────
    // Stack A — starboard mid bay, near pillar
    addBox('FreightStkA0', { width: 1.6, height: 1.0, depth: 1.6 }, new Vector3(13.5, 0.5, 14.0), stashMat);
    addBox('FreightStkA1', { width: 1.6, height: 1.0, depth: 1.6 }, new Vector3(13.5, 1.5, 14.0), stashMat);
    addBox('FreightStkA2', { width: 1.6, height: 0.8, depth: 1.4 }, new Vector3(13.5, 0.4, 12.0), cargoBulk);
    // Stack B — starboard forward
    addBox('FreightStkB0', { width: 1.8, height: 1.0, depth: 1.8 }, new Vector3(17.0, 0.5, 24.0), cargoBulk);
    addBox('FreightStkB1', { width: 1.8, height: 1.0, depth: 1.8 }, new Vector3(17.0, 1.5, 24.0), cargoBulk);
    // Stack C — port forward bay
    addBox('FreightStkC0', { width: 2.0, height: 1.2, depth: 2.0 }, new Vector3(-8.0, 0.6, 25.0), cargoBulk);
    addBox('FreightStkC1', { width: 2.0, height: 1.2, depth: 2.0 }, new Vector3(-8.0, 1.8, 25.0), stashMat);
    // Stack D — port mid cargo lane
    addBox('FreightStkD0', { width: 1.7, height: 1.0, depth: 1.7 }, new Vector3(-12.2, 0.5, 7.8), stashMat);
    addBox('FreightStkD1', { width: 1.7, height: 1.0, depth: 1.7 }, new Vector3(-12.2, 1.5, 7.8), cargoBulk);
    addBox('FreightStkD2', { width: 1.3, height: 0.8, depth: 1.3 }, new Vector3(-10.7, 0.4, 8.9), cargoBulk);
    // Stack E — starboard aft cargo lane
    addBox('FreightStkE0', { width: 1.5, height: 1.0, depth: 1.5 }, new Vector3(11.6, 0.5, 3.8), cargoBulk);
    addBox('FreightStkE1', { width: 1.5, height: 1.0, depth: 1.5 }, new Vector3(11.6, 1.5, 3.8), stashMat);
    // Barrel cluster on starboard aft (extra hazard dressing)
    addBox('SatBrl0', { width: 0.8, height: 0.8, depth: 0.8 }, new Vector3(19.0, 0.4, -2.0), cargoBulk);
    addBox('SatBrl1', { width: 0.8, height: 0.8, depth: 0.8 }, new Vector3(19.8, 0.4, -2.8), cargoBulk);

    // ── SUPPLY POST — Marta's Surplus (cargo bay, starboard aft) ──────────────
    const supplyCounter = addBox(
      'Supply Post',
      { width: 3.0, height: 1.1, depth: 1.2 },
      new Vector3(8.0, 0.55, -4.0),
      kioskMat,
    );
    supplyCounter.metadata = {
      hudLabel: "Supply Post — Marta's Surplus",
      onInteract: () => {
        window.dispatchEvent(new CustomEvent('openMerchant', { detail: { merchantId: 'supply_post' } }));
        document.exitPointerLock();
      },
    };
    // Back-panel riser for the counter
    addBox('SupplyRiser', { width: 3.0, height: 2.2, depth: 0.18 }, new Vector3(8.0, 1.1, -4.7), kioskMat, 0, false);
    // Small screen on the counter top
    const supplyScreen = MeshBuilder.CreatePlane('SupplyScreen', { width: 1.4, height: 0.7 }, scene);
    supplyScreen.position.set(8.0, 1.3, -4.55);
    supplyScreen.rotation.x = -Math.PI / 10;
    supplyScreen.material = screenMat;
    supplyScreen.isPickable = false;

    // ── CREW NOTICE BOARD (cargo bay aft wall, z = -10) ───────────────────────
    const noticeBoard = MeshBuilder.CreateBox(
      'Crew Notice Board',
      { width: 2.0, height: 1.4, depth: 0.15 },
      scene,
    );
    noticeBoard.position.set(-5.0, 2.8, -9.92);
    noticeBoard.material = noticeMat;
    noticeBoard.metadata = {
      hudLabel: 'Crew Notice Board',
      onInteract: () => {
        window.dispatchEvent(new CustomEvent('showCrewNotice'));
        document.exitPointerLock();
      },
    };
    new PhysicsAggregate(noticeBoard, PhysicsShapeType.BOX, { mass: 0 }, scene);
    // Bracket trim around the board
    addBox('NoticeBracketT', { width: 2.2, height: 0.1, depth: 0.1 }, new Vector3(-5.0, 3.58, -9.85), accentMat, 0, false);
    addBox('NoticeBracketB', { width: 2.2, height: 0.1, depth: 0.1 }, new Vector3(-5.0, 2.05, -9.85), accentMat, 0, false);

    // ── AFT CROSS-CORRIDOR — crew atmosphere ───────────────────────────────────
    // Mess table + benches (starboard half)
    addBox('MessTableTop',  { width: 2.4, height: 0.10, depth: 1.0 }, new Vector3( 6.0, 0.92, -16.0), tableMat, 0, false);
    addBox('MessTableBase', { width: 0.18, height: 0.9, depth: 0.8 }, new Vector3( 6.0, 0.45, -16.0), cargoBulk, 0, false);
    addBox('MessBenchN',    { width: 2.0, height: 0.10, depth: 0.4 }, new Vector3( 6.0, 0.50, -14.8), tableMat, 0, false);
    addBox('MessBenchS',    { width: 2.0, height: 0.10, depth: 0.4 }, new Vector3( 6.0, 0.50, -17.2), tableMat, 0, false);
    // Locker bank — port aft corridor wall
    addBox('LockerBank',   { width: 0.28, height: 2.0, depth: 7.0 }, new Vector3(-20.6, 1.0, -16.0), lockerMat, 0, false);
    // Individual locker doors (vertical seams)
    for (let i = 0; i < 6; i++) {
      addBox(`LockerSeam${i}`, { width: 0.32, height: 0.06, depth: 1.0 }, new Vector3(-20.7, 1.1, -12.5 + i * 1.15), accentMat, 0, false);
    }

    // ── QUARTERMASTER DESK — Sgt. Hendrix (armory port bay) ───────────────────
    const qmDesk = addBox(
      'Quartermaster',
      { width: 3.2, height: 1.1, depth: 1.0 },
      new Vector3(-13.0, 0.55, -28.5),
      kioskMat,
    );
    qmDesk.metadata = {
      hudLabel: 'Quartermaster — Sgt. Hendrix',
      onInteract: () => {
        window.dispatchEvent(new CustomEvent('openMerchant', { detail: { merchantId: 'quartermaster' } }));
        document.exitPointerLock();
      },
    };
    // Back-panel riser
    addBox('QMDeskRiser', { width: 3.2, height: 2.0, depth: 0.18 }, new Vector3(-13.0, 1.0, -29.1), kioskMat, 0, false);
    // Small terminal on QM desk
    const qmScreen = MeshBuilder.CreatePlane('QMScreen', { width: 1.2, height: 0.65 }, scene);
    qmScreen.position.set(-13.0, 1.3, -28.95);
    qmScreen.rotation.x = -Math.PI / 10;
    qmScreen.material = screenMat;
    qmScreen.isPickable = false;

    // Bridge side workstations (navigation + relay diagnostics)
    addBox('BridgeStationPort', { width: 2.2, height: 1.0, depth: 1.1 }, new Vector3(-6.0, 0.5, 34.7), consoleMat);
    addBox('BridgeStationStar', { width: 2.2, height: 1.0, depth: 1.1 }, new Vector3(6.0, 0.5, 34.7), consoleMat);
    addBox('BridgeStationPortPanel', { width: 1.5, height: 0.75, depth: 0.08 }, new Vector3(-6.0, 1.25, 35.2), screenMat, 0, false);
    addBox('BridgeStationStarPanel', { width: 1.5, height: 0.75, depth: 0.08 }, new Vector3(6.0, 1.25, 35.2), screenMat, 0, false);

    // Airlock staging lockers and prep crates
    addBox('AirlockPrepLockerPort', { width: 0.35, height: 2.2, depth: 2.2 }, new Vector3(-17.8, 1.1, -36.0), lockerMat, 0, false);
    addBox('AirlockPrepLockerStar', { width: 0.35, height: 2.2, depth: 2.2 }, new Vector3(17.8, 1.1, -36.0), lockerMat, 0, false);
    addBox('AirlockPrepCratePort', { width: 1.2, height: 0.8, depth: 1.2 }, new Vector3(-14.8, 0.4, -36.2), stashMat, 0, false);
    addBox('AirlockPrepCrateStar', { width: 1.2, height: 0.8, depth: 1.2 }, new Vector3(14.8, 0.4, -36.2), stashMat, 0, false);

    // --- Airlock Row: z -34, full width ---
    const airFloor = MeshBuilder.CreateBox('airlockFloor', { width: SHIP_W, height: 1, depth: 8 }, scene);
    airFloor.position.set(0, -0.5, -38);
    airFloor.material = floorMat;
    new PhysicsAggregate(airFloor, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const airCeil = MeshBuilder.CreateBox('airlockCeil', { width: SHIP_W, height: 1, depth: 8 }, scene);
    airCeil.position.set(0, CEIL_Y, -38);
    airCeil.material = wallMat;
    airCeil.isPickable = false;
    new PhysicsAggregate(airCeil, PhysicsShapeType.BOX, { mass: 0 }, scene);

    addBox('airWallW', { width: 1, height: SHIP_H, depth: 8 }, new Vector3(-21.5, SHIP_H / 2, -38), wallMat);
    addBox('airWallE', { width: 1, height: SHIP_H, depth: 8 }, new Vector3(21.5, SHIP_H / 2, -38), wallMat);
    // Aft stern wall
    addBox('sternWall', { width: SHIP_W, height: SHIP_H, depth: 1 }, new Vector3(0, SHIP_H / 2, -42.5), wallMat);

    // Airlock Alpha (port — Station/Moon) door
    const airlockAlpha = MeshBuilder.CreateBox('Airlock Alpha — Station', { width: 6, height: 4, depth: 0.3 }, scene);
    airlockAlpha.position.set(-10, 2, -41.5);
    airlockAlpha.material = airlockAlphaMat;
    airlockAlpha.metadata = {
      hudLabel: 'AIRLOCK ALPHA (PORT)',
      onInteract: () => {
        const contracts = this.game.contracts;
        const active = contracts.find(c => c.isActive && !c.isCompleted);
        const zone = active ? getContractDeployZone(active.title) : null;
        if (zone === 'station_chain') {
          this.game.stateMachine.setState(GameState.STATION);
        } else {
          window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Airlock Alpha locked — Select a Station/Moon contract first.' } }));
        }
      }
    };
    new PhysicsAggregate(airlockAlpha, PhysicsShapeType.BOX, { mass: 0 }, scene);
    this.airlockAlphaMesh = airlockAlpha;

    // Airlock Beta (starboard — Planet) door
    const airlockBeta = MeshBuilder.CreateBox('Airlock Beta — Planet', { width: 6, height: 4, depth: 0.3 }, scene);
    airlockBeta.position.set(10, 2, -41.5);
    airlockBeta.material = airlockBetaMat;
    airlockBeta.metadata = {
      hudLabel: 'AIRLOCK BETA (STARBOARD)',
      onInteract: () => {
        const contracts = this.game.contracts;
        const active = contracts.find(c => c.isActive && !c.isCompleted);
        const zone = active ? getContractDeployZone(active.title) : null;
        if (zone === 'planet') {
          this.game.stateMachine.setState(GameState.PLANET);
        } else {
          window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Airlock Beta locked — Select a Planet contract first.' } }));
        }
      }
    };
    new PhysicsAggregate(airlockBeta, PhysicsShapeType.BOX, { mass: 0 }, scene);
    this.airlockBetaMesh = airlockBeta;

    // Airlock divider bulkhead (between alpha and beta)
    addBox('airlockDiv', { width: 1, height: SHIP_H, depth: 8 }, new Vector3(0, SHIP_H / 2, -38), wallMat);

    // Airlock signage strips
    const alphaSigns = MeshBuilder.CreateBox('AlphaSignStrip', { width: 6, height: 0.25, depth: 0.05 }, scene);
    alphaSigns.position.set(-10, 4.5, -41.4);
    alphaSigns.material = airlockAlphaMat;

    const betaSigns = MeshBuilder.CreateBox('BetaSignStrip', { width: 6, height: 0.25, depth: 0.05 }, scene);
    betaSigns.position.set(10, 4.5, -41.4);
    betaSigns.material = airlockBetaMat;

    // ── OPERATIONS CONSOLE (bridge) ────────────────────────────────────────────
    const opsConsole = MeshBuilder.CreateBox('Operations console', { width: 5, height: 1.2, depth: 1.8 }, scene);
    opsConsole.position.set(0, 0.6, 36);
    opsConsole.material = consoleMat;
    new PhysicsAggregate(opsConsole, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const screen = MeshBuilder.CreatePlane('Operations HUD screen', { width: 3.8, height: 1.9 }, scene);
    screen.position.set(0, 1.6, 36.9);
    screen.rotation.x = Math.PI / 6;
    screen.material = screenMat;

    const uiMeta = {
      hudLabel: 'Operations console',
      onInteract: () => {
        window.dispatchEvent(new CustomEvent('toggleShipUI'));
        document.exitPointerLock();
      },
    };
    opsConsole.metadata = uiMeta;
    screen.metadata = uiMeta;

    // Ambient ship hum — uses the Babylon.js playground sound CDN
    new Sound('shipHum', 'https://playground.babylonjs.com/sounds/wind.wav', scene, null, {
      loop: true,
      autoplay: true,
      volume: 0.12,
    });

    // ── LIGHTING ───────────────────────────────────────────────────────────────
    // Ambient
    const ambientLight = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.32;
    ambientLight.diffuse = new Color3(0.52, 0.60, 0.88);

    // Bridge — blue-white work light
    const bridgeLight = new PointLight('bridgeLight', new Vector3(0, 6, 35), scene);
    bridgeLight.diffuse = new Color3(0.22, 0.52, 1.0);
    bridgeLight.intensity = 1.2;
    bridgeLight.range = 18;

    // Cargo bay — industrial amber
    const cargoLightFwd = new PointLight('cargoLightFwd', new Vector3(0, 6, 20), scene);
    cargoLightFwd.diffuse = new Color3(1.0, 0.82, 0.52);
    cargoLightFwd.intensity = 1.0;
    cargoLightFwd.range = 22;

    const cargoLightAft = new PointLight('cargoLightAft', new Vector3(0, 6, 0), scene);
    cargoLightAft.diffuse = new Color3(0.9, 0.78, 0.55);
    cargoLightAft.intensity = 0.85;
    cargoLightAft.range = 22;

    // Armory — warm amber
    const armoryLight = new PointLight('armoryLight', new Vector3(-16, 5.5, -27), scene);
    armoryLight.diffuse = new Color3(1.0, 0.8, 0.52);
    armoryLight.intensity = 0.9;
    armoryLight.range = 14;

    // Engineering — cool teal
    const engLight = new PointLight('engLight', new Vector3(16, 5.5, -27), scene);
    engLight.diffuse = new Color3(0.4, 0.85, 0.9);
    engLight.intensity = 0.75;
    engLight.range = 14;

    // Airlock Alpha — red danger
    const alphaLight = new PointLight('alphaLight', new Vector3(-10, 5.5, -38), scene);
    alphaLight.diffuse = new Color3(1.0, 0.22, 0.22);
    alphaLight.intensity = 0.75;
    alphaLight.range = 12;
    this.alphaLight = alphaLight;

    // Airlock Beta — blue orbital
    const betaLight = new PointLight('betaLight', new Vector3(10, 5.5, -38), scene);
    betaLight.diffuse = new Color3(0.22, 0.55, 1.0);
    betaLight.intensity = 0.75;
    betaLight.range = 12;
    this.betaLight = betaLight;

    // Supply Post — warm golden accent
    const supplyLight = new PointLight('supplyLight', new Vector3(8, 4, -4), scene);
    supplyLight.diffuse = new Color3(1.0, 0.88, 0.55);
    supplyLight.intensity = 0.7;
    supplyLight.range = 9;

    // Quartermaster — warm amber over armory counter
    const qmLight = new PointLight('qmLight', new Vector3(-13, 5, -28), scene);
    qmLight.diffuse = new Color3(1.0, 0.82, 0.52);
    qmLight.intensity = 0.6;
    qmLight.range = 9;

    // Notice board — soft green highlight
    const noticeLight = new PointLight('noticeLight', new Vector3(-5, 4, -10), scene);
    noticeLight.diffuse = new Color3(0.38, 0.88, 0.55);
    noticeLight.intensity = 0.42;
    noticeLight.range = 7;

    // ── PLAYER ─────────────────────────────────────────────────────────────────
    const player = new PlayerController(this.game, scene, new Vector3(0, 2, 5));
    this.game.player = player;

    // ── NPC POPULATION ────────────────────────────────────────────────────────
    Promise.all([
      // Marta — Supply Post
      placeBabylonModel(scene, 'HVGirl.glb', {
        position: new Vector3(8.0, 0.05, -5.5),
        scale: 1.0,
        rotationY: Math.PI,
        useMeshesRoot: true
      }),
      // Sgt. Hendrix — Quartermaster
      placeBabylonModel(scene, 'Dude.babylon', {
        position: new Vector3(-13.0, 0.05, -30.2),
        scale: 0.05,
        rotationY: 0,
        useMeshesRoot: false // Dude.babylon is on models root
      }),
      // Kaelen — Tech Specialist (Engineering Corridor)
      placeBabylonModel(scene, 'HVGirl.glb', {
        position: new Vector3(-8.5, 0.05, -12.5),
        scale: 1.0,
        rotationY: -Math.PI / 2,
        useMeshesRoot: true
      }),
      // Crew member in mess hall
      placeBabylonModel(scene, 'HVGirl.glb', {
        position: new Vector3(6.0, 0.05, -18.2),
        scale: 1.0,
        rotationY: 0,
        useMeshesRoot: true
      }),

      // ── PROPS ──────────────────────────────────────────────────────────────────
      // Cargo bay — exploding barrels clustered near pillars
      placeBabylonModel(scene, 'ExplodingBarrel.glb', {
        position: new Vector3(-13.5, 0.38, 3),
        scale: 0.42,
        rotationY: 0.5,
      }),
      placeBabylonModel(scene, 'ExplodingBarrel.glb', {
        position: new Vector3(14.2, 0.38, 8.5),
        scale: 0.4,
        rotationY: -0.8,
      }),
      placeBabylonModel(scene, 'ExplodingBarrel.glb', {
        position: new Vector3(-14.0, 0.38, 21.5),
        scale: 0.38,
        rotationY: 1.2,
      }),
      placeBabylonModel(scene, 'ExplodingBarrel.glb', {
        position: new Vector3(13.5, 0.38, 23),
        scale: 0.40,
        rotationY: -0.3,
      }),
      // Bridge display globe
      placeBabylonModel(scene, 'marble.glb', {
        position: new Vector3(2.4, 1.9, 36.8),
        scale: 0.48,
      }),
      // Solar system holo on bridge console
      placeBabylonModel(scene, 'solar_system.glb', {
        position: new Vector3(-1.2, 1.88, 36.8),
        scale: 0.004,
        rotationY: -0.4,
      }),
      // Shader ball in armory (equipment display)
      placeBabylonModel(scene, 'shaderBall.glb', {
        position: new Vector3(-19.8, 1.18, -31),
        scale: 0.058,
      }),
      // Seagull model on cargo bay catwalk (character/atmosphere)
      placeBabylonModel(scene, 'seagulf.glb', {
        position: new Vector3(-17.5, 4.15, 14),
        scale: 0.022,
        rotationY: Math.PI * 0.6,
      }),
      // Supply post details
      placeBabylonModel(scene, 'clothFolds.glb', {
        position: new Vector3(8.3, 1.08, -3.75),
        scale: 0.08,
        rotationY: -0.35,
      }),
      placeBabylonModel(scene, 'shaderBall.glb', {
        position: new Vector3(7.4, 1.12, -3.8),
        scale: 0.06,
        rotationY: 0.7,
      }),
      // Quartermaster desk details
      placeBabylonModel(scene, 'shaderBall.glb', {
        position: new Vector3(-12.6, 1.12, -28.25),
        scale: 0.055,
        rotationY: -0.9,
      }),
      placeBabylonModel(scene, 'shaderBall.glb', {
        position: new Vector3(-13.4, 1.1, -28.1),
        scale: 0.036,
        rotationY: 0.35,
      }),
      // Crew space details
      placeBabylonModel(scene, 'emoji_heart.glb', {
        position: new Vector3(-5.0, 2.95, -9.72),
        scale: 0.03,
        rotationY: Math.PI,
      }),
      placeBabylonModel(scene, 'marble.glb', {
        position: new Vector3(5.8, 1.02, -16.0),
        scale: 0.18,
      }),
    ]).catch(e => console.warn('[ShipScene] Some models failed to load:', e));

    // ── MEDICAL BAY (Starboard, z=30) ──────────────────────────────────────────
    addBox('MedBayFloor', { width: 8, height: 0.1, depth: 6 }, new Vector3(17, 0.05, 33), floorMat);
    const medBed = addBox('MedBed', { width: 1.2, height: 0.8, depth: 2.2 }, new Vector3(17, 0.45, 33), tableMat);
    medBed.metadata = {
      hudLabel: 'Medical Bed — Bio-Diagnostics',
      onInteract: () => {
        window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Bio-signature nominal. Suit integrity confirmed.' } }));
      }
    };
    const medScreen = MeshBuilder.CreatePlane('MedScreen', { width: 1.2, height: 0.8 }, scene);
    medScreen.position.set(17, 1.8, 35.8);
    medScreen.rotation.x = -Math.PI / 10;
    medScreen.material = screenMat;

    // ── PERSONAL STASH (Aft Corridor) ──────────────────────────────────────────
    const stashCrate = addBox('Personal Stash', { width: 1.0, height: 1.0, depth: 1.0 }, new Vector3(-12, 0.5, -16), stashMat);
    stashCrate.metadata = {
      hudLabel: 'Personal Stash — Secured',
      onInteract: () => {
        window.dispatchEvent(new CustomEvent('toggleShipUI'));
        document.exitPointerLock();
      }
    };

    // ── MISSION FEEDBACK LOOP ──────────────────────────────────────────────────
    scene.onBeforeRenderObservable.add(() => {
      const active = this.game.contracts.find(c => c.isActive && !c.isCompleted);
      const zone = active ? getContractDeployZone(active.title) : null;
      const pulse = 0.4 + Math.sin(Date.now() / 300) * 0.5;

      if (zone === 'station_chain') {
        if (this.alphaLight) this.alphaLight.intensity = 0.4 + pulse * 1.5;
        if (this.betaLight) this.betaLight.intensity = 0.25;
      } else if (zone === 'planet') {
        if (this.betaLight) this.betaLight.intensity = 0.4 + pulse * 1.5;
        if (this.alphaLight) this.alphaLight.intensity = 0.25;
      } else {
        if (this.alphaLight) this.alphaLight.intensity = 0.75;
        if (this.betaLight) this.betaLight.intensity = 0.75;
      }
    });

    return scene;
  }
}
