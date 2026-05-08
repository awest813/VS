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
    const starfield = createShipStarfield(scene, 440);
    starfield.position.set(0, 2.5, 6);

    const floorMat = makePbrMetalPanel(scene, 'shipFloorMat', new Color3(0.16, 0.18, 0.22), bump, 0.42, 0.62);
    const wallMat = makePbrMetalPanel(scene, 'shipWallMat', new Color3(0.26, 0.28, 0.32), bump, 0.55, 0.58);
    const accentMat = makePbrMetalPanel(scene, 'shipAccentMat', new Color3(0.55, 0.28, 0.1), bump, 0.65, 0.45);

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

    const stashMat = makePbrMetalPanel(scene, 'stashMat', new Color3(0.18, 0.24, 0.2), bump, 0.5, 0.68);
    const airlockMat = makePbrMetalPanel(scene, 'airlockMat', new Color3(0.38, 0.12, 0.12), bump, 0.7, 0.38);
    airlockMat.emissiveColor = new Color3(0.08, 0.02, 0.02);

    const ambientLight = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.35;
    ambientLight.diffuse = new Color3(0.55, 0.62, 0.85);

    const mainFloor = MeshBuilder.CreateBox('mainFloor', { width: 10, height: 0.5, depth: 20 }, scene);
    mainFloor.position.set(0, -0.25, 5);
    mainFloor.material = floorMat;
    mainFloor.metadata = { ...(mainFloor.metadata ?? {}), surfaceSound: 'metal' };
    new PhysicsAggregate(mainFloor, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const ceiling = MeshBuilder.CreateBox('ceiling', { width: 10, height: 0.5, depth: 20 }, scene);
    ceiling.position.set(0, 5, 5);
    ceiling.material = wallMat;
    ceiling.isPickable = false;
    new PhysicsAggregate(ceiling, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const wallW = MeshBuilder.CreateBox('wallW', { width: 0.5, height: 5, depth: 20 }, scene);
    wallW.position.set(-5, 2.25, 5);
    wallW.material = wallMat;
    new PhysicsAggregate(wallW, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const wallE = MeshBuilder.CreateBox('wallE', { width: 0.5, height: 5, depth: 20 }, scene);
    wallE.position.set(5, 2.25, 5);
    wallE.material = wallMat;
    new PhysicsAggregate(wallE, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const wallS = MeshBuilder.CreateBox('wallS', { width: 10, height: 5, depth: 0.5 }, scene);
    wallS.position.set(0, 2.25, -5);
    wallS.material = wallMat;
    new PhysicsAggregate(wallS, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const windowFrame = MeshBuilder.CreateBox('windowFrame', { width: 10, height: 1, depth: 0.5 }, scene);
    windowFrame.position.set(0, 0.5, 15);
    windowFrame.material = wallMat;
    new PhysicsAggregate(windowFrame, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const windowTop = MeshBuilder.CreateBox('windowTop', { width: 10, height: 1, depth: 0.5 }, scene);
    windowTop.position.set(0, 4.5, 15);
    windowTop.material = wallMat;
    new PhysicsAggregate(windowTop, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const windowGlass = MeshBuilder.CreateBox('windowGlass', { width: 10, height: 3, depth: 0.2 }, scene);
    windowGlass.position.set(0, 2.5, 15);
    windowGlass.material = glassMat;
    windowGlass.isPickable = false;
    new PhysicsAggregate(windowGlass, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const bridgeLight = new PointLight('bridgeLight', new Vector3(0, 4, 12), scene);
    bridgeLight.diffuse = new Color3(0.25, 0.55, 1.0);
    bridgeLight.intensity = 1.1;
    bridgeLight.range = 14;

    const opsConsole = MeshBuilder.CreateBox('Operations console', { width: 4, height: 1.2, depth: 1.5 }, scene);
    opsConsole.position.set(0, 0.6, 12);
    opsConsole.material = consoleMat;
    new PhysicsAggregate(opsConsole, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const screen = MeshBuilder.CreatePlane('Operations HUD screen', { width: 3, height: 1.5 }, scene);
    screen.position.set(0, 1.5, 12.7);
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

    const armoryLight = new PointLight('armoryLight', new Vector3(-3, 3, 2), scene);
    armoryLight.diffuse = new Color3(1.0, 0.82, 0.55);
    armoryLight.intensity = 0.95;
    armoryLight.range = 12;

    const stashBox1 = MeshBuilder.CreateBox('Armory Crate A', { width: 1.5, height: 1, depth: 1.5 }, scene);
    stashBox1.position.set(-3.5, 0.5, 2);
    stashBox1.material = stashMat;
    new PhysicsAggregate(stashBox1, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const stashBox2 = MeshBuilder.CreateBox('Armory Crate B', { width: 1.5, height: 1, depth: 1.5 }, scene);
    stashBox2.position.set(-3.5, 1.5, 2);
    stashBox2.material = stashMat;
    new PhysicsAggregate(stashBox2, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const rack = MeshBuilder.CreateBox('Weapon Rack', { width: 0.2, height: 3, depth: 2 }, scene);
    rack.position.set(-4.8, 1.5, 5);
    rack.material = accentMat;
    new PhysicsAggregate(rack, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const airlockDoor = MeshBuilder.CreateBox('Airlock Door', { width: 3, height: 3.5, depth: 0.2 }, scene);
    airlockDoor.position.set(0, 1.75, -4.9);
    airlockDoor.material = airlockMat;
    new PhysicsAggregate(airlockDoor, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const airlockLight = new PointLight('airlockLight', new Vector3(0, 4, -3), scene);
    airlockLight.diffuse = new Color3(1.0, 0.25, 0.25);
    airlockLight.intensity = 0.65;
    airlockLight.range = 10;

    const player = new PlayerController(this.game, scene, new Vector3(0, 2, 0));
    this.game.player = player;

    await Promise.all([
      placeBabylonModel(scene, 'ExplodingBarrel.glb', {
        position: new Vector3(-3.8, 0.35, 2.9),
        scale: 0.38,
        rotationY: 0.4,
      }),
      placeBabylonModel(scene, 'ExplodingBarrel.glb', {
        position: new Vector3(4.25, 0.35, 7.8),
        scale: 0.33,
        rotationY: -0.85,
      }),
      placeBabylonModel(scene, 'marble.gltf', {
        position: new Vector3(2.1, 0.92, 12.6),
        scale: 0.45,
      }),
      placeBabylonModel(scene, 'BabylonShaderBall_Simple.gltf', {
        position: new Vector3(-4.55, 1.15, 5.1),
        scale: 0.055,
      }),
      placeBabylonModel(scene, 'seagulf.glb', {
        position: new Vector3(-1.2, 2.85, 14.25),
        scale: 0.022,
        rotationY: Math.PI * 0.15,
      }),
      placeBabylonModel(scene, 'solar_system.glb', {
        position: new Vector3(0.85, 1.85, 12.72),
        scale: 0.004,
        rotationY: -0.4,
      }),
    ]);

    return scene;
  }
}
