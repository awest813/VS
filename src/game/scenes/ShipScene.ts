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
} from '@babylonjs/core';
import { Game } from '../Game';
import { PlayerController } from '../player/PlayerController';
import { placeBabylonModel } from '../loaders/BabylonHostedDecor';
import { BABYLON_ENV_STUDIO } from '../loaders/BabylonAssetUrls';
import { applyBabylonIBL } from '../loaders/applyBabylonIBL';
import { createIndustrialBump, createShipStarfield, makePbrMetalPanel } from '../loaders/IndustrialMaterials';

/**
 * ShipScene — the player hub aboard the ICV Relentless, a Meridian-class heavy freighter.
 *
 * Layout (top-down, Z = forward/bow):
 *   z  60 ─ Bow observation bay
 *   z  40 ─ Bridge / ops console
 *   z  10 ─ Mid-ship: main cargo bay (wide, tall)
 *   z -10 ─ Aft cross-corridor
 *   z -22 ─ Armory bay (port) | Engineering alcove (starboard)
 *   z -32 ─ Airlock row: Alpha (port, station/moon) | Beta (starboard, planet outpost)
 */
export class ShipScene {
  private game: Game;

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
    addBox('ArmCrateA', { width: 1.6, height: 1.0, depth: 1.6 }, new Vector3(-20, 0.5, -26), stashMat, 0);
    addBox('ArmCrateB', { width: 1.6, height: 1.0, depth: 1.6 }, new Vector3(-20, 1.5, -26), stashMat, 0);
    addBox('ArmCrateC', { width: 1.6, height: 1.0, depth: 1.6 }, new Vector3(-20, 0.5, -29), stashMat, 0);
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
    new PhysicsAggregate(airlockAlpha, PhysicsShapeType.BOX, { mass: 0 }, scene);

    // Airlock Beta (starboard — Planet) door
    const airlockBeta = MeshBuilder.CreateBox('Airlock Beta — Planet', { width: 6, height: 4, depth: 0.3 }, scene);
    airlockBeta.position.set(10, 2, -41.5);
    airlockBeta.material = airlockBetaMat;
    new PhysicsAggregate(airlockBeta, PhysicsShapeType.BOX, { mass: 0 }, scene);

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

    // Airlock Beta — blue orbital
    const betaLight = new PointLight('betaLight', new Vector3(10, 5.5, -38), scene);
    betaLight.diffuse = new Color3(0.22, 0.55, 1.0);
    betaLight.intensity = 0.75;
    betaLight.range = 12;

    // ── PLAYER ─────────────────────────────────────────────────────────────────
    const player = new PlayerController(this.game, scene, new Vector3(0, 2, 5));
    this.game.player = player;

    // ── PROPS ──────────────────────────────────────────────────────────────────
    await Promise.all([
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
      placeBabylonModel(scene, 'marble.gltf', {
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
      placeBabylonModel(scene, 'BabylonShaderBall_Simple.gltf', {
        position: new Vector3(-19.8, 1.18, -31),
        scale: 0.058,
      }),
      // Seagull model on cargo bay catwalk (character/atmosphere)
      placeBabylonModel(scene, 'seagulf.glb', {
        position: new Vector3(-17.5, 4.15, 14),
        scale: 0.022,
        rotationY: Math.PI * 0.6,
      }),
    ]);

    return scene;
  }
}
