import { Scene, Vector3, PointLight, MeshBuilder, Color4, HemisphericLight, PhysicsAggregate, PhysicsShapeType, StandardMaterial, Color3, PBRMaterial, NoiseProceduralTexture } from '@babylonjs/core';
import { Game } from '../Game';
import { PlayerController } from '../player/PlayerController';
import { EnemyAI } from '../ai/EnemyAI';
import { GameState } from '../StateMachine';

export class MoonBaseScene {
  private game: Game;
  private triggeredStationReturn = false;

  constructor(game: Game) {
    this.game = game;
  }

  public async create(): Promise<Scene> {
    const scene = new Scene(this.game.engine);
    scene.clearColor = new Color4(0.02, 0.02, 0.02, 1);
    
    scene.fogMode = Scene.FOGMODE_EXP;
    scene.fogDensity = 0.03;
    scene.fogColor = new Color3(0.02, 0.02, 0.02);

    if (this.game.havokPlugin) {
      scene.enablePhysics(new Vector3(0, -9.81, 0), this.game.havokPlugin);
    }

    const player = new PlayerController(this.game, scene, new Vector3(0, 3, -15));
    this.game.player = player;

    // Ambient light (very dim)
    const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
    ambient.intensity = 0.15;

    const staticMeshes: import("@babylonjs/core").Mesh[] = [];

    // Procedural Grime Texture
    const grimeNoise = new NoiseProceduralTexture("grime", 512, scene);
    grimeNoise.octaves = 6;
    grimeNoise.persistence = 1.5;
    grimeNoise.animationSpeedFactor = 0; // Static grime

    const floorMat = new PBRMaterial("floorMat", scene);
    floorMat.albedoColor = new Color3(0.15, 0.15, 0.15);
    floorMat.metallic = 0.3;
    floorMat.roughness = 0.8;
    floorMat.bumpTexture = grimeNoise;

    const wallMat = new PBRMaterial("wallMat", scene);
    wallMat.albedoColor = new Color3(0.2, 0.22, 0.2);
    wallMat.metallic = 0.6;
    wallMat.roughness = 0.7;
    wallMat.bumpTexture = grimeNoise;

    // Helper to create a room
    const createRoom = (name: string, x: number, z: number, width: number, depth: number) => {
        const floor = MeshBuilder.CreateBox(`${name}_floor`, { width, height: 1, depth }, scene);
        floor.position.set(x, -0.5, z);
        floor.material = floorMat;
        new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0 }, scene);
        staticMeshes.push(floor);

        // Ceiling
        const ceiling = MeshBuilder.CreateBox(`${name}_ceil`, { width, height: 1, depth }, scene);
        ceiling.position.set(x, 5, z);
        ceiling.material = wallMat;
        new PhysicsAggregate(ceiling, PhysicsShapeType.BOX, { mass: 0 }, scene);

        return floor;
    };

    const createWall = (name: string, x: number, z: number, width: number, depth: number) => {
        const wall = MeshBuilder.CreateBox(name, { width, height: 5, depth }, scene);
        wall.position.set(x, 2, z);
        wall.material = wallMat;
        new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, scene);
        staticMeshes.push(wall);
        return wall;
    };

    // --- Layout ---
    // Start Room
    createRoom("StartRoom", 0, -15, 10, 10);
    createWall("Start_W", -5, -15, 1, 10);
    createWall("Start_E", 5, -15, 1, 10);
    createWall("Start_S", 0, -20, 10, 1);
    
    // Corridor N
    createRoom("CorridorN", 0, 0, 4, 20);
    createWall("CorrN_W", -2, 0, 1, 20);
    createWall("CorrN_E", 2, 0, 1, 20);

    // Central Hub
    createRoom("Hub", 0, 20, 20, 20);
    createWall("Hub_SW", -6, 10, 8, 1);
    createWall("Hub_SE", 6, 10, 8, 1);
    createWall("Hub_NW", -6, 30, 8, 1);
    createWall("Hub_NE", 6, 30, 8, 1);
    
    // West Room (Loot Room)
    createRoom("WestRoom", -20, 20, 20, 10);
    createWall("West_N", -20, 25, 20, 1);
    createWall("West_S", -20, 15, 20, 1);
    createWall("West_W", -30, 20, 1, 10);
    createWall("Hub_W_Top", -10, 23, 1, 4);
    createWall("Hub_W_Bot", -10, 17, 1, 4);

    // East Room (Extraction / Objective)
    createRoom("EastRoom", 20, 20, 20, 10);
    createWall("East_N", 20, 25, 20, 1);
    createWall("East_S", 20, 15, 20, 1);
    createWall("East_E", 30, 20, 1, 10);
    createWall("Hub_E_Top", 10, 23, 1, 4);
    createWall("Hub_E_Bot", 10, 17, 1, 4);

    // North Room (Deep Storage)
    createRoom("NorthRoom", 0, 45, 10, 30);
    createWall("North_W", -5, 45, 1, 30);
    createWall("North_E", 5, 45, 1, 30);
    createWall("North_N", 0, 60, 10, 1);

    // --- Lights ---
    const hubLight = new PointLight("hubLight", new Vector3(0, 4, 20), scene);
    hubLight.intensity = 0.8;
    hubLight.diffuse = new Color3(0.5, 0.8, 1);

    const westLight = new PointLight("westLight", new Vector3(-20, 4, 20), scene);
    westLight.intensity = 0.6;
    westLight.diffuse = new Color3(1, 0.5, 0.2); // Warm loot room

    const northLight = new PointLight("northLight", new Vector3(0, 4, 50), scene);
    northLight.intensity = 0.4;
    northLight.diffuse = new Color3(1, 0, 0); // Danger/Red

    // --- Loot Spawns ---
    const spawnCrate = (id: string, x: number, z: number, isObjective = false) => {
        const crate = MeshBuilder.CreateBox(id, { size: 1.2 }, scene);
        crate.position.set(x, 0.6, z);
        const mat = new PBRMaterial(id+"_mat", scene);
        mat.albedoColor = isObjective ? new Color3(1, 0.8, 0) : new Color3(0.4, 0.5, 0.4);
        mat.metallic = 0.5;
        mat.roughness = 0.5;
        crate.material = mat;
        new PhysicsAggregate(crate, PhysicsShapeType.BOX, { mass: 2 }, scene);
        
        crate.metadata = {
            onInteract: () => {
                if (!this.game.player) return;

                if (isObjective) {
                    this.game.player.inventory.push({ itemId: 'survey_drive', quantity: 1 });
                    console.log(`Looted: survey_drive`);
                } else {
                    // 20% chance for a weapon, else junk
                    if (Math.random() < 0.2) {
                        const weaponTypes = ['rifle_01', 'shotgun_01', 'pulse_rifle'];
                        const wType = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
                        // Generate randomized stats
                        const stats = {
                            damageMod: 0.8 + Math.random() * 0.4, // 0.8 to 1.2
                            fireRateMod: 0.8 + Math.random() * 0.4
                        };
                        this.game.player.inventory.push({ itemId: wType, quantity: 1, stats });
                        console.log(`Looted Rare Weapon: ${wType}`, stats);
                    } else {
                        const item = ['scrap_metal', 'copper_wire', 'medkit', 'ammo_9mm'][Math.floor(Math.random() * 4)];
                        const existing = this.game.player.inventory.find((i: any) => i.itemId === item);
                        if (existing) existing.quantity++;
                        else this.game.player.inventory.push({ itemId: item, quantity: 1 });
                        console.log(`Looted: ${item}`);
                    }
                }
                crate.dispose();
            }
        };
    };

    spawnCrate("crate_1", -18, 22);
    spawnCrate("crate_2", -22, 18);
    spawnCrate("crate_3", -25, 22);
    spawnCrate("crate_4", 0, 58, true); // Survey Drive in Deep Storage

    // --- Enemies ---
    if (this.game.navigationPlugin) {
        this.game.navigationPlugin.createNavMesh(staticMeshes, {
            cs: 0.2,
            ch: 0.2,
            walkableSlopeAngle: 35,
            walkableHeight: 1.5,
            walkableClimb: 0.5,
            walkableRadius: 1,
            maxEdgeLen: 12.,
            maxSimplificationError: 1.3,
            minRegionArea: 8,
            mergeRegionArea: 20,
            maxVertsPerPoly: 6,
            detailSampleDist: 6,
            detailSampleMaxError: 1,
        });
    }

    new EnemyAI(this.game, scene, new Vector3(0, 1, 5), false); // Melee in corridor
    new EnemyAI(this.game, scene, new Vector3(-5, 1, 20), true); // Ranged in hub
    new EnemyAI(this.game, scene, new Vector3(5, 1, 20), false); // Melee in hub
    new EnemyAI(this.game, scene, new Vector3(-20, 1, 20), true); // Ranged guarding west loot
    new EnemyAI(this.game, scene, new Vector3(0, 1, 40), true); // Ranged guarding deep storage
    new EnemyAI(this.game, scene, new Vector3(0, 1, 50), false); // Melee guarding deep storage

    // --- Extraction Zone ---
    // Extract in the East Room
    const extractZone = MeshBuilder.CreateBox("extractionZone", { width: 5, height: 5, depth: 5 }, scene);
    extractZone.position.set(25, 2.5, 20);
    const extractMat = new StandardMaterial("extractMat", scene);
    extractMat.diffuseColor = new Color3(0, 1, 0);
    extractMat.alpha = 0.3;
    extractZone.material = extractMat;
    extractZone.isPickable = false;

    scene.onBeforeRenderObservable.add(() => {
        if (this.game.player) {
            const dist = Vector3.Distance(this.game.player.mesh.position, extractZone.position);
            if (!this.triggeredStationReturn && dist < 3) {
                this.triggeredStationReturn = true;
                console.log("Extracting back to Station...");
                this.game.stateMachine.setState(GameState.STATION);
            }
        }
    });

    console.log("Expanded Moon Base Scene Loaded");
    return scene;
  }
}

