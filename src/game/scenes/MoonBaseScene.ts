import { Scene, Vector3, PointLight, MeshBuilder, Color4, HemisphericLight, PhysicsAggregate, PhysicsShapeType, Color3, PBRMaterial, NoiseProceduralTexture } from '@babylonjs/core';
import PBRMaterialFactory, { PBREnum } from '../PBRMaterialFactory';
import { Game } from '../Game';
import { PlayerController } from '../player/PlayerController';
import { EnemyAI } from '../ai/EnemyAI';
import { GameState } from '../StateMachine';
import { placeBabylonModel } from '../loaders/BabylonHostedDecor';
import { BABYLON_ENV_STUDIO } from '../loaders/BabylonAssetUrls';
import { applyBabylonIBL } from '../loaders/applyBabylonIBL';
import { LootContainer } from '../loot/LootContainer';
import { MOON_STANDARD_CRATE } from '../loot/lootTables';
import { mergeRaidLootGrant } from '../loot/raidInventoryMerge';
import { doom3RaidMoonIBL } from '../level/idTech4Inspired';
import { MOONBASE_CRATE_SPAWNS, MOONBASE_ENEMY_SPAWNS } from '../level/moonBaseDefs';
import { environmentalSurgeActiveAt } from '../raid/raidEnvironment';

export class MoonBaseScene {
  private game: Game;
  private triggeredStationReturn = false;

  constructor(game: Game) {
    this.game = game;
  }

  public async create(): Promise<Scene> {
    const scene = new Scene(this.game.engine);
    scene.clearColor = new Color4(0.02, 0.02, 0.02, 1);

    applyBabylonIBL(scene, BABYLON_ENV_STUDIO, {
      intensity: doom3RaidMoonIBL.intensity,
      exposure: doom3RaidMoonIBL.exposure,
      contrast: doom3RaidMoonIBL.contrast,
    });

    scene.fogMode = Scene.FOGMODE_EXP;
    scene.fogDensity = doom3RaidMoonIBL.fogDensity;
    scene.fogColor = new Color3(0.02, 0.02, 0.02);

    if (this.game.havokPlugin) {
      scene.enablePhysics(new Vector3(0, -9.81, 0), this.game.havokPlugin);
    }

    /** Low fill light — see `idTech4Inspired.doom3RaidMoonIBL`; point lights + flashlight read. */
    const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
    const moonAmbientBase = doom3RaidMoonIBL.hemisphereIntensity;
    ambient.intensity = moonAmbientBase;

    const staticMeshes: import("@babylonjs/core").Mesh[] = [];

    // Procedural Grime Texture
    const grimeNoise = new NoiseProceduralTexture("grime", 512, scene);
    grimeNoise.octaves = 6;
    grimeNoise.persistence = 1.5;
    grimeNoise.animationSpeedFactor = 0; // Static grime

    const pbrFactory = new PBRMaterialFactory(scene);
    const floorMat = pbrFactory.create(PBREnum.Metal_Plate_15, { uScale: 8, vScale: 8, pScale: 0.04 });
    const wallMat = pbrFactory.create(PBREnum.Metal_Plate_41, { uScale: 4, vScale: 2, pScale: 0.02 });

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
    const hubLightBase = 0.8;
    hubLight.intensity = hubLightBase;
    hubLight.diffuse = new Color3(0.5, 0.8, 1);

    const westLight = new PointLight("westLight", new Vector3(-20, 4, 20), scene);
    const westLightBase = 0.6;
    westLight.intensity = westLightBase;
    westLight.diffuse = new Color3(1, 0.5, 0.2); // Warm loot room

    const northLight = new PointLight("northLight", new Vector3(0, 4, 50), scene);
    const northLightBase = 0.4;
    northLight.intensity = northLightBase;
    northLight.diffuse = new Color3(1, 0, 0); // Danger/Red

    scene.onBeforeRenderObservable.add(() => {
      const now = Date.now();
      const surge = environmentalSurgeActiveAt(now);
      this.game.raidEnvironmentalSurge = surge;
      
      let intensityMul = 1;
      if (surge) {
        const flicker = Math.sin(now / 50) * Math.cos(now / 80);
        intensityMul = flicker > 0.3 ? 0.35 : flicker > -0.2 ? 0.12 : 0.01;
      }

      ambient.intensity = moonAmbientBase * intensityMul;
      hubLight.intensity = hubLightBase * (surge ? intensityMul * 0.6 : 1);
      westLight.intensity = westLightBase * (surge ? intensityMul * 0.7 : 1);
      northLight.intensity = northLightBase * (surge ? intensityMul * 0.8 : 1);
    });

    // --- Loot Spawns ---
    const spawnCrate = (id: string, x: number, z: number, isObjective = false) => {
        const crate = MeshBuilder.CreateBox(id, { size: 1.2 }, scene);
        crate.position.set(x, 0.6, z);
        const mat = new PBRMaterial(id+"_mat", scene);
        mat.albedoColor = isObjective ? new Color3(1, 0.8, 0) : new Color3(0.4, 0.5, 0.4);
        mat.metallic = 0.5;
        mat.roughness = 0.5;
        mat.bumpTexture = grimeNoise;
        crate.material = mat;
        new PhysicsAggregate(crate, PhysicsShapeType.BOX, { mass: 2 }, scene);
        
        const lootContainer = isObjective
          ? LootContainer.fromGrants([{ itemId: 'survey_drive', quantity: 1 }])
          : LootContainer.fromTable(MOON_STANDARD_CRATE);

        crate.metadata = {
          hudLabel: isObjective ? 'Survey drive crate' : 'Salvage crate',
          type: 'loot_container',
          lootContainer,
          onInteract: () => {
            if (!this.game.player) return;

            const grant = lootContainer.takeNext();
            if (!grant) {
              crate.dispose();
              return;
            }
            mergeRaidLootGrant(this.game.raidInventory, grant);
            console.log('Looted from container:', grant, lootContainer.lootTableId ?? 'fixed');
            window.dispatchEvent(
              new CustomEvent('raidLootPicked', {
                detail: {
                  itemId: grant.itemId,
                  quantity: grant.quantity,
                  isObjective: !!isObjective,
                },
              })
            );
            if (lootContainer.isEmpty) {
              crate.dispose();
            }
          },
        };
    };

    for (const cdef of MOONBASE_CRATE_SPAWNS) {
      spawnCrate(cdef.meshId, cdef.x, cdef.z, !!cdef.objective);
    }

    const dataConsole = MeshBuilder.CreateBox('MoonDataConsole', { width: 1.6, height: 1.2, depth: 0.6 }, scene);
    dataConsole.position.set(-2, 1, 45); // North Room
    const consoleMat = new PBRMaterial('consoleMat', scene);
    consoleMat.albedoColor = new Color3(0.12, 0.12, 0.12);
    consoleMat.emissiveColor = new Color3(0.4, 0.1, 0.05); // Red glow
    dataConsole.material = consoleMat;
    dataConsole.metadata = {
      hudLabel: 'Secure data console',
      onInteract: () => {
        if (!this.game.dataRecoveredIds.includes('moon_intel_01')) {
          this.game.dataRecoveredIds.push('moon_intel_01');
          window.dispatchEvent(new CustomEvent('raidLorePing', { detail: { segmentId: 'intel_downloaded' } }));
        }
      }
    };

    Promise.all([
      placeBabylonModel(scene, 'ExplodingBarrel.glb', {
        position: new Vector3(-20.5, 0.38, 19.25),
        scale: 0.42,
        rotationY: 0.6,
      }),
      placeBabylonModel(scene, 'ExplodingBarrel.glb', {
        position: new Vector3(23.75, 0.38, 18.85),
        scale: 0.4,
      }),
      placeBabylonModel(scene, 'marble.glb', {
        position: new Vector3(3.2, 1.85, -14.75),
        scale: 0.55,
      }),
      placeBabylonModel(scene, 'emoji_heart.glb', {
        position: new Vector3(26.85, 1.35, 20.95),
        scale: 0.35,
      }),
      placeBabylonModel(scene, 'shaderBall.glb', {
        position: new Vector3(-24.85, 0.85, 20.95),
        scale: 0.06,
      }),
      placeBabylonModel(scene, 'ExplodingBarrel.glb', {
        position: new Vector3(-0.95, 0.38, 22),
        scale: 0.38,
        rotationY: -1.15,
      }),
      placeBabylonModel(scene, 'pinkEnergyBall.glb', {
        position: new Vector3(0, 4.15, 20),
        scale: 0.035,
      }, 'TrailMeshSpell'),
    ]);

    const player = new PlayerController(this.game, scene, new Vector3(0, 3, -15));
    this.game.player = player;

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

    for (const edef of MOONBASE_ENEMY_SPAWNS) {
      new EnemyAI(this.game, scene, new Vector3(edef.x, 1, edef.z), {
        ranged: edef.ranged,
        behavior: edef.behavior,
      });
    }

    // --- Extraction Zone ---
    // Extract in the East Room
    const extractZone = MeshBuilder.CreateBox("extractionZone", { width: 5, height: 5, depth: 5 }, scene);
    extractZone.position.set(25, 2.5, 20);
    const extractMat = new PBRMaterial("extractMat", scene);
    extractMat.albedoColor = new Color3(0.04, 0.25, 0.08);
    extractMat.alpha = 0.34;
    extractMat.emissiveColor = new Color3(0.15, 0.85, 0.28);
    extractMat.metallic = 0.15;
    extractMat.roughness = 0.4;
    extractMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
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

