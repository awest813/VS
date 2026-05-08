import { Scene, Vector3, HemisphericLight, PointLight, MeshBuilder, StandardMaterial, Color3, Color4, PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core';
import { Game } from '../Game';
import { PlayerController } from '../player/PlayerController';

export class ShipScene {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  public async create(): Promise<Scene> {
    const scene = new Scene(this.game.engine);
    // Deep space black outside
    scene.clearColor = new Color4(0.01, 0.01, 0.02, 1);

    if (this.game.havokPlugin) {
      scene.enablePhysics(new Vector3(0, -9.81, 0), this.game.havokPlugin);
    }

    // Player Controller starts in the sleeping quarters / central hub
    const player = new PlayerController(this.game, scene, new Vector3(0, 2, 0));
    this.game.player = player;

    // Ambient Lighting
    const ambientLight = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.4;
    ambientLight.diffuse = new Color3(0.6, 0.7, 0.9);

    // Materials
    const floorMat = new StandardMaterial("shipFloorMat", scene);
    floorMat.diffuseColor = new Color3(0.2, 0.22, 0.25);
    floorMat.specularColor = new Color3(0.1, 0.1, 0.1);

    const wallMat = new StandardMaterial("shipWallMat", scene);
    wallMat.diffuseColor = new Color3(0.3, 0.32, 0.35);

    const accentMat = new StandardMaterial("accentMat", scene);
    accentMat.diffuseColor = new Color3(0.8, 0.4, 0.1); // Orange-ish industrial accent

    const glassMat = new StandardMaterial("glassMat", scene);
    glassMat.diffuseColor = new Color3(0.1, 0.5, 0.8);
    glassMat.alpha = 0.4;

    // --- Main Hall (10x20) ---
    const mainFloor = MeshBuilder.CreateBox("mainFloor", { width: 10, height: 0.5, depth: 20 }, scene);
    mainFloor.position.set(0, -0.25, 5);
    mainFloor.material = floorMat;
    new PhysicsAggregate(mainFloor, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const ceiling = MeshBuilder.CreateBox("ceiling", { width: 10, height: 0.5, depth: 20 }, scene);
    ceiling.position.set(0, 5, 5);
    ceiling.material = wallMat;
    new PhysicsAggregate(ceiling, PhysicsShapeType.BOX, { mass: 0 }, scene);

    // Side Walls
    const wallW = MeshBuilder.CreateBox("wallW", { width: 0.5, height: 5, depth: 20 }, scene);
    wallW.position.set(-5, 2.25, 5);
    wallW.material = wallMat;
    new PhysicsAggregate(wallW, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const wallE = MeshBuilder.CreateBox("wallE", { width: 0.5, height: 5, depth: 20 }, scene);
    wallE.position.set(5, 2.25, 5);
    wallE.material = wallMat;
    new PhysicsAggregate(wallE, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const wallS = MeshBuilder.CreateBox("wallS", { width: 10, height: 5, depth: 0.5 }, scene);
    wallS.position.set(0, 2.25, -5);
    wallS.material = wallMat;
    new PhysicsAggregate(wallS, PhysicsShapeType.BOX, { mass: 0 }, scene);

    // --- The Bridge (Front Window Area) ---
    const windowFrame = MeshBuilder.CreateBox("windowFrame", { width: 10, height: 1, depth: 0.5 }, scene);
    windowFrame.position.set(0, 0.5, 15);
    windowFrame.material = wallMat;
    new PhysicsAggregate(windowFrame, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const windowTop = MeshBuilder.CreateBox("windowTop", { width: 10, height: 1, depth: 0.5 }, scene);
    windowTop.position.set(0, 4.5, 15);
    windowTop.material = wallMat;
    new PhysicsAggregate(windowTop, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const windowGlass = MeshBuilder.CreateBox("windowGlass", { width: 10, height: 3, depth: 0.2 }, scene);
    windowGlass.position.set(0, 2.5, 15);
    windowGlass.material = glassMat;
    new PhysicsAggregate(windowGlass, PhysicsShapeType.BOX, { mass: 0 }, scene);

    // Bridge Lighting (Blue tint)
    const bridgeLight = new PointLight("bridgeLight", new Vector3(0, 4, 12), scene);
    bridgeLight.diffuse = new Color3(0.2, 0.6, 1.0);
    bridgeLight.intensity = 0.8;
    bridgeLight.range = 10;

    // Operations Console (Interactive)
    const consoleMat = new StandardMaterial("consoleMat", scene);
    consoleMat.diffuseColor = new Color3(0.15, 0.2, 0.25);
    consoleMat.emissiveColor = new Color3(0.0, 0.2, 0.4);

    const opsConsole = MeshBuilder.CreateBox("Operations Console", { width: 4, height: 1.2, depth: 1.5 }, scene);
    opsConsole.position.set(0, 0.6, 12);
    opsConsole.material = consoleMat;
    new PhysicsAggregate(opsConsole, PhysicsShapeType.BOX, { mass: 0 }, scene);

    // Console Screen
    const screen = MeshBuilder.CreatePlane("screen", { width: 3, height: 1.5 }, scene);
    screen.position.set(0, 1.5, 12.7);
    screen.rotation.x = Math.PI / 6; // Tilted slightly up
    const screenMat = new StandardMaterial("screenMat", scene);
    screenMat.emissiveColor = new Color3(0.0, 0.8, 1.0);
    screen.material = screenMat;

    opsConsole.metadata = {
      onInteract: () => {
        window.dispatchEvent(new CustomEvent('toggleShipUI'));
        document.exitPointerLock();
      }
    };
    screen.metadata = opsConsole.metadata; // Interacting with screen does the same

    // --- Armory / Stash Area ---
    // A recessed area on the left side
    const armoryLight = new PointLight("armoryLight", new Vector3(-3, 3, 2), scene);
    armoryLight.diffuse = new Color3(1.0, 0.8, 0.5);
    armoryLight.intensity = 0.8;

    const stashMat = new StandardMaterial("stashMat", scene);
    stashMat.diffuseColor = new Color3(0.25, 0.3, 0.25);

    const stashBox1 = MeshBuilder.CreateBox("Stash Container 1", { width: 1.5, height: 1, depth: 1.5 }, scene);
    stashBox1.position.set(-3.5, 0.5, 2);
    stashBox1.material = stashMat;
    new PhysicsAggregate(stashBox1, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const stashBox2 = MeshBuilder.CreateBox("Stash Container 2", { width: 1.5, height: 1, depth: 1.5 }, scene);
    stashBox2.position.set(-3.5, 1.5, 2);
    stashBox2.material = stashMat;
    new PhysicsAggregate(stashBox2, PhysicsShapeType.BOX, { mass: 0 }, scene);
    
    // Weapon Rack visual
    const rack = MeshBuilder.CreateBox("Weapon Rack", { width: 0.2, height: 3, depth: 2 }, scene);
    rack.position.set(-4.8, 1.5, 5);
    rack.material = accentMat;
    new PhysicsAggregate(rack, PhysicsShapeType.BOX, { mass: 0 }, scene);

    // --- Airlock / Departure Area ---
    const airlockMat = new StandardMaterial("airlockMat", scene);
    airlockMat.diffuseColor = new Color3(0.5, 0.1, 0.1);

    const airlockDoor = MeshBuilder.CreateBox("Airlock Door", { width: 3, height: 3.5, depth: 0.2 }, scene);
    airlockDoor.position.set(0, 1.75, -4.9);
    airlockDoor.material = airlockMat;
    new PhysicsAggregate(airlockDoor, PhysicsShapeType.BOX, { mass: 0 }, scene);
    
    const airlockLight = new PointLight("airlockLight", new Vector3(0, 4, -3), scene);
    airlockLight.diffuse = new Color3(1.0, 0.2, 0.2);
    airlockLight.intensity = 0.5;

    console.log("Detailed Ship Scene Loaded");
    return scene;
  }
}

