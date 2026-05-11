import {
  Scene,
  Vector3,
  PointLight,
  MeshBuilder,
  Color4,
  HemisphericLight,
  PhysicsAggregate,
  PhysicsShapeType,
  Color3,
  PBRMaterial,
  NoiseProceduralTexture,
} from '@babylonjs/core';
import { Game } from '../Game';
import { PlayerController } from '../player/PlayerController';
import { EnemyAI } from '../ai/EnemyAI';
import { GameState } from '../StateMachine';
import { placeBabylonModel } from '../loaders/BabylonHostedDecor';
import { BABYLON_ENV_STUDIO } from '../loaders/BabylonAssetUrls';
import { applyBabylonIBL } from '../loaders/applyBabylonIBL';
import { LootContainer } from '../loot/LootContainer';
import { PLANET_STANDARD_CRATE } from '../loot/lootTables';
import { mergeRaidLootGrant } from '../loot/raidInventoryMerge';
import { planetOutpostAmbient } from '../level/idTech4Inspired';
import { PLANET_CRATE_SPAWNS, PLANET_ENEMY_SPAWNS } from '../level/planetDefs';
import { environmentalSurgeActiveAt } from '../raid/raidEnvironment';
import { mergeAmmoForShipExtract } from '../persistence/raidExtract';
import { persistStationRaidExtract } from '../persistence/stationRaidPersist';

export class PlanetScene {
  private game: Game;
  private extractPending = false;

  constructor(game: Game) {
    this.game = game;
  }

  public async create(): Promise<Scene> {
    const scene = new Scene(this.game.engine);
    // Venusian haze — thick orange-red atmosphere
    scene.clearColor = new Color4(0.22, 0.08, 0.03, 1);

    applyBabylonIBL(scene, BABYLON_ENV_STUDIO, {
      intensity: planetOutpostAmbient.intensity,
      exposure: planetOutpostAmbient.exposure,
      contrast: planetOutpostAmbient.contrast,
    });

    scene.fogMode = Scene.FOGMODE_EXP;
    scene.fogDensity = planetOutpostAmbient.fogDensity;
    scene.fogColor = new Color3(0.28, 0.1, 0.04);

    if (this.game.havokPlugin) {
      scene.enablePhysics(new Vector3(0, -9.81, 0), this.game.havokPlugin);
    }

    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    const ambientBase = planetOutpostAmbient.hemisphereIntensity;
    ambient.intensity = ambientBase;
    ambient.diffuse = new Color3(0.75, 0.38, 0.12);

    const staticMeshes: import('@babylonjs/core').Mesh[] = [];

    // Corroded grime for outpost surfaces
    const grimeNoise = new NoiseProceduralTexture('planetGrime', 512, scene);
    grimeNoise.octaves = 7;
    grimeNoise.persistence = 1.4;
    grimeNoise.animationSpeedFactor = 0;

    const floorMat = new PBRMaterial('planetFloor', scene);
    floorMat.albedoColor = new Color3(0.28, 0.16, 0.1);
    floorMat.metallic = 0.25;
    floorMat.roughness = 0.88;
    floorMat.bumpTexture = grimeNoise;

    const wallMat = new PBRMaterial('planetWall', scene);
    wallMat.albedoColor = new Color3(0.32, 0.2, 0.14);
    wallMat.metallic = 0.5;
    wallMat.roughness = 0.78;
    wallMat.bumpTexture = grimeNoise;

    const makeRoom = (name: string, x: number, z: number, w: number, d: number) => {
      const floor = MeshBuilder.CreateBox(`${name}_floor`, { width: w, height: 1, depth: d }, scene);
      floor.position.set(x, -0.5, z);
      floor.material = floorMat;
      new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0 }, scene);
      staticMeshes.push(floor);

      const ceiling = MeshBuilder.CreateBox(`${name}_ceil`, { width: w, height: 1, depth: d }, scene);
      ceiling.position.set(x, 5, z);
      ceiling.material = wallMat;
      new PhysicsAggregate(ceiling, PhysicsShapeType.BOX, { mass: 0 }, scene);

      return floor;
    };

    const makeWall = (name: string, x: number, z: number, w: number, d: number) => {
      const wall = MeshBuilder.CreateBox(name, { width: w, height: 5, depth: d }, scene);
      wall.position.set(x, 2, z);
      wall.material = wallMat;
      new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, scene);
      staticMeshes.push(wall);
      return wall;
    };

    // --- Layout: entry airlock → corridor → lab hub → deep lab ---

    // Entry airlock / decompression chamber
    makeRoom('Entry', 0, -12, 10, 10);
    makeWall('Entry_W', -5, -12, 1, 10);
    makeWall('Entry_E', 5, -12, 1, 10);
    makeWall('Entry_S', 0, -17, 10, 1);

    // North corridor
    makeRoom('Corridor', 0, 2, 6, 20);
    makeWall('Corr_W', -3, 2, 1, 20);
    makeWall('Corr_E', 3, 2, 1, 20);

    // Lab hub (wider central room)
    makeRoom('LabHub', 0, 22, 22, 18);
    makeWall('Hub_SW', -7, 13, 8, 1);
    makeWall('Hub_SE', 7, 13, 8, 1);
    makeWall('Hub_NW', -7, 31, 8, 1);
    makeWall('Hub_NE', 7, 31, 8, 1);
    makeWall('Hub_W', -11, 22, 1, 18);
    makeWall('Hub_E', 11, 22, 1, 18);

    // West side room (storage)
    makeRoom('WestLab', -20, 22, 16, 10);
    makeWall('WLab_W', -28, 22, 1, 10);
    makeWall('WLab_N', -20, 27, 16, 1);
    makeWall('WLab_S', -20, 17, 16, 1);

    // East side room (comms/equipment)
    makeRoom('EastLab', 20, 22, 16, 10);
    makeWall('ELab_E', 28, 22, 1, 10);
    makeWall('ELab_N', 20, 27, 16, 1);
    makeWall('ELab_S', 20, 17, 16, 1);

    // Deep lab / objective room
    makeRoom('DeepLab', 0, 48, 12, 24);
    makeWall('Deep_W', -6, 48, 1, 24);
    makeWall('Deep_E', 6, 48, 1, 24);
    makeWall('Deep_N', 0, 60, 12, 1);

    // --- Lighting ---
    const entryLight = new PointLight('entryLight', new Vector3(0, 4, -12), scene);
    entryLight.diffuse = new Color3(0.9, 0.45, 0.1);
    const entryLightBase = 0.7;
    entryLight.intensity = entryLightBase;
    entryLight.range = 14;

    const hubLight = new PointLight('hubLight', new Vector3(0, 4, 22), scene);
    hubLight.diffuse = new Color3(0.85, 0.38, 0.08);
    const hubLightBase = 0.65;
    hubLight.intensity = hubLightBase;
    hubLight.range = 20;

    const westLight = new PointLight('westLight', new Vector3(-20, 4, 22), scene);
    westLight.diffuse = new Color3(1.0, 0.52, 0.15);
    const westLightBase = 0.5;
    westLight.intensity = westLightBase;
    westLight.range = 14;

    const deepLight = new PointLight('deepLight', new Vector3(0, 4, 50), scene);
    deepLight.diffuse = new Color3(1.0, 0.22, 0.08);
    const deepLightBase = 0.45;
    deepLight.intensity = deepLightBase;
    deepLight.range = 18;

    scene.onBeforeRenderObservable.add(() => {
      const surge = environmentalSurgeActiveAt(Date.now());
      this.game.raidEnvironmentalSurge = surge;
      ambient.intensity = ambientBase * (surge ? 0.35 : 1);
      hubLight.intensity = hubLightBase * (surge ? 0.4 : 1);
      westLight.intensity = westLightBase * (surge ? 0.42 : 1);
      deepLight.intensity = deepLightBase * (surge ? 0.48 : 1);
    });

    // --- Lore terminal ---
    const loreTerminal = MeshBuilder.CreateBox('OutpostTerminal', { width: 1.2, height: 1.6, depth: 0.35 }, scene);
    loreTerminal.position.set(-2.5, 1.25, -11);
    loreTerminal.material = wallMat;
    loreTerminal.metadata = {
      hudLabel: 'Outpost terminal',
      onInteract: () => {
        window.dispatchEvent(
          new CustomEvent('raidLorePing', { detail: { segmentId: 'planet_outpost_log' } })
        );
      },
    };

    // --- Loot crates ---
    const spawnCrate = (id: string, x: number, z: number, isObjective = false) => {
      const crate = MeshBuilder.CreateBox(id, { size: 1.2 }, scene);
      crate.position.set(x, 0.6, z);
      const mat = new PBRMaterial(`${id}_mat`, scene);
      mat.albedoColor = isObjective ? new Color3(1, 0.75, 0) : new Color3(0.42, 0.28, 0.2);
      mat.metallic = 0.5;
      mat.roughness = 0.55;
      mat.bumpTexture = grimeNoise;
      crate.material = mat;
      new PhysicsAggregate(crate, PhysicsShapeType.BOX, { mass: 2 }, scene);

      const lootContainer = isObjective
        ? LootContainer.fromGrants([{ itemId: 'beacon_core', quantity: 1 }])
        : LootContainer.fromTable(PLANET_STANDARD_CRATE);

      crate.metadata = {
        hudLabel: isObjective ? 'Beacon core crate' : 'Salvage crate',
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
          console.log('Looted from planet container:', grant);
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

    for (const cdef of PLANET_CRATE_SPAWNS) {
      spawnCrate(cdef.meshId, cdef.x, cdef.z, !!cdef.objective);
    }

    // --- Nav mesh + enemies ---
    if (this.game.navigationPlugin) {
      this.game.navigationPlugin.createNavMesh(staticMeshes, {
        cs: 0.2,
        ch: 0.2,
        walkableSlopeAngle: 35,
        walkableHeight: 1.5,
        walkableClimb: 0.5,
        walkableRadius: 1,
        maxEdgeLen: 12,
        maxSimplificationError: 1.3,
        minRegionArea: 8,
        mergeRegionArea: 20,
        maxVertsPerPoly: 6,
        detailSampleDist: 6,
        detailSampleMaxError: 1,
      });
    }

    for (const edef of PLANET_ENEMY_SPAWNS) {
      new EnemyAI(this.game, scene, new Vector3(edef.x, 1, edef.z), {
        ranged: edef.ranged,
        behavior: edef.behavior,
      });
    }

    // --- Extraction zone (back to freighter) ---
    const extractZone = MeshBuilder.CreateBox('extractionZone', { width: 6, height: 5, depth: 6 }, scene);
    extractZone.position.set(0, 2.5, -15);
    const extractMat = new PBRMaterial('extractMat', scene);
    extractMat.albedoColor = new Color3(0.04, 0.25, 0.08);
    extractMat.alpha = 0.34;
    extractMat.emissiveColor = new Color3(0.15, 0.85, 0.28);
    extractMat.metallic = 0.15;
    extractMat.roughness = 0.4;
    extractMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    extractZone.material = extractMat;
    extractZone.isPickable = false;

    scene.onBeforeRenderObservable.add(() => {
      if (!this.game.player) return;
      const dist = Vector3.Distance(this.game.player.mesh.position, extractZone.position);
      if (!this.extractPending && dist < 3.5) {
        this.extractPending = true;
        console.log('Extracting from planet to freighter...');

        const weapon = this.game.player.weapon;
        const inventory = mergeAmmoForShipExtract(
          [...this.game.player.inventory],
          weapon?.currentAmmo ?? 0,
          weapon?.reserveAmmo ?? 0
        );

        void (async () => {
          try {
            const result = await persistStationRaidExtract({
              inventory,
              stationKillsSinceDock: this.game.enemiesKilledStation,
            });
            console.log('Planet extract: inventory saved.');
            window.dispatchEvent(
              new CustomEvent('raidExtractComplete', {
                detail: {
                  paidContractTitle: result.paidContractTitle,
                  paidContractReward: result.paidContractReward,
                  itemCount: inventory.length,
                },
              })
            );
          } catch (err) {
            console.error('Failed to save planet inventory', err);
          } finally {
            this.extractPending = false;
            this.game.stateMachine.setState(GameState.SHIP);
          }
        })();
      }
    });

    // --- Decorative props ---
    await Promise.all([
      placeBabylonModel(scene, 'ExplodingBarrel.glb', {
        position: new Vector3(-2.8, 0.38, -11.5),
        scale: 0.4,
        rotationY: 0.8,
      }),
      placeBabylonModel(scene, 'ExplodingBarrel.glb', {
        position: new Vector3(18.5, 0.38, 21.5),
        scale: 0.38,
        rotationY: -0.6,
      }),
      placeBabylonModel(scene, 'marble.gltf', {
        position: new Vector3(2.2, 1.85, -11.5),
        scale: 0.48,
      }),
    ]);

    const player = new PlayerController(this.game, scene, new Vector3(0, 3, -12));
    this.game.player = player;

    console.log('Planet Outpost Scene Loaded');
    return scene;
  }
}
