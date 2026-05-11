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
} from '@babylonjs/core';
import { Game } from '../Game';
import { PlayerController } from '../player/PlayerController';
import { GameState } from '../StateMachine';
import { mergeAmmoForShipExtract } from '../persistence/raidExtract';
import { persistStationRaidExtract } from '../persistence/stationRaidPersist';
import { EnemyAI } from '../ai/EnemyAI';
import { placeBabylonModel } from '../loaders/BabylonHostedDecor';
import { BABYLON_ENV_SPECULAR } from '../loaders/BabylonAssetUrls';
import { applyBabylonIBL } from '../loaders/applyBabylonIBL';
import { createIndustrialBump, makePbrMetalPanel } from '../loaders/IndustrialMaterials';
import { doom3FacilityAmbient } from '../level/idTech4Inspired';
import { STATION_CRATE_SPAWNS, STATION_ENEMY_SPAWNS } from '../level/stationDefs';
import { environmentalSurgeActiveAt } from '../raid/raidEnvironment';
import { LootContainer } from '../loot/LootContainer';
import { STATION_STANDARD_CRATE } from '../loot/lootTables';
import { mergeRaidLootGrant } from '../loot/raidInventoryMerge';

export class StationScene {
  private game: Game;
  private descendingToMoon = false;

  constructor(game: Game) {
    this.game = game;
  }

  public async create(): Promise<Scene> {
    const scene = new Scene(this.game.engine);
    scene.clearColor = new Color4(0.02, 0.022, 0.045, 1);

    applyBabylonIBL(scene, BABYLON_ENV_SPECULAR, {
      intensity: 0.62,
      exposure: 0.9,
      contrast: 1.06,
    });

    if (this.game.havokPlugin) {
      scene.enablePhysics(new Vector3(0, -9.81, 0), this.game.havokPlugin);
    }

    const bump = createIndustrialBump(scene, 'stationPanelBump', 5);
    const floorMat = makePbrMetalPanel(scene, 'statFloorMat', new Color3(0.38, 0.4, 0.46), bump, 0.55, 0.72);
    const wallMat = makePbrMetalPanel(scene, 'statWallMat', new Color3(0.62, 0.64, 0.72), bump, 0.48, 0.62);

    const elevatorMat = new PBRMaterial('elevatorMat', scene);
    elevatorMat.albedoColor = new Color3(0.45, 0.22, 0.06);
    elevatorMat.metallic = 0.35;
    elevatorMat.roughness = 0.42;
    elevatorMat.emissiveColor = new Color3(1.35, 0.45, 0.06);
    elevatorMat.environmentIntensity = 1.05;

    const returnMat = new PBRMaterial('returnMat', scene);
    returnMat.albedoColor = new Color3(0.05, 0.35, 0.08);
    returnMat.alpha = 0.42;
    returnMat.emissiveColor = new Color3(0.12, 0.85, 0.28);
    returnMat.metallic = 0.2;
    returnMat.roughness = 0.35;
    returnMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;

    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    const baseAmbientIntensity = doom3FacilityAmbient.hemisphereIntensity;
    ambient.intensity = baseAmbientIntensity;
    ambient.diffuse = new Color3(0.72, 0.76, 0.88);

    const navMeshes: import('@babylonjs/core').Mesh[] = [];

    const floor = MeshBuilder.CreateBox('floor', { width: 15, height: 1, depth: 40 }, scene);
    floor.position.y = -0.5;
    floor.material = floorMat;
    floor.metadata = { ...(floor.metadata ?? {}), surfaceSound: 'metal' };
    new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0 }, scene);
    navMeshes.push(floor);

    const wallL = MeshBuilder.CreateBox('wallL', { width: 0.5, height: 5, depth: 40 }, scene);
    wallL.position.x = -7.5;
    wallL.position.y = 2.5;
    wallL.material = wallMat;
    new PhysicsAggregate(wallL, PhysicsShapeType.BOX, { mass: 0 }, scene);
    navMeshes.push(wallL);

    const wallR = MeshBuilder.CreateBox('wallR', { width: 0.5, height: 5, depth: 40 }, scene);
    wallR.position.x = 7.5;
    wallR.position.y = 2.5;
    wallR.material = wallMat;
    new PhysicsAggregate(wallR, PhysicsShapeType.BOX, { mass: 0 }, scene);
    navMeshes.push(wallR);

    const rimCool = new PointLight('rimCool', new Vector3(6, 3.8, -5), scene);
    rimCool.diffuse = new Color3(0.65, 0.78, 1);
    const rimCoolBaseIntensity = 0.35;
    rimCool.intensity = rimCoolBaseIntensity;
    rimCool.range = 28;

    const redLight = new PointLight('redLight', new Vector3(0, 4, 10), scene);
    redLight.diffuse = new Color3(1, 0.2, 0.15);
    redLight.specular = new Color3(1, 0.4, 0.35);
    const redLightPulseHigh = 0.92;
    const redLightPulseLow = 0.18;

    const elevator = MeshBuilder.CreateBox('elevator', { width: 4, height: 4, depth: 4 }, scene);
    elevator.position.set(0, 2, 18);
    elevator.material = elevatorMat;
    elevator.isPickable = false;

    const returnZone = MeshBuilder.CreateBox('returnZone', { width: 4, height: 4, depth: 4 }, scene);
    returnZone.position.set(0, 2, -18);
    returnZone.material = returnMat;
    returnZone.isPickable = false;

    const loreTerminal = MeshBuilder.CreateBox('StationArchiveTerminal', { width: 1.2, height: 1.6, depth: 0.35 }, scene);
    loreTerminal.position.set(-6.85, 1.25, 8);
    loreTerminal.material = wallMat;
    loreTerminal.metadata = {
      hudLabel: 'Archive terminal',
      onInteract: () => {
        window.dispatchEvent(
          new CustomEvent('raidLorePing', { detail: { segmentId: 'station_ops_net' } })
        );
      },
    };

    // Build a station-specific navmesh before spawning AI so they don't pathfind on a stale
    // moonbase grid (`MoonBaseScene` builds its own; without this the corridor pathing is wrong).
    if (this.game.navigationPlugin) {
      this.game.navigationPlugin.createNavMesh(navMeshes, {
        cs: 0.2,
        ch: 0.2,
        walkableSlopeAngle: 35,
        walkableHeight: 1.5,
        walkableClimb: 0.5,
        walkableRadius: 1,
        maxEdgeLen: 12,
        maxSimplificationError: 1.3,
        minRegionArea: 6,
        mergeRegionArea: 20,
        maxVertsPerPoly: 6,
        detailSampleDist: 6,
        detailSampleMaxError: 1,
      });
    }

    for (const s of STATION_ENEMY_SPAWNS) {
      new EnemyAI(this.game, scene, new Vector3(s.x, s.y ?? 1, s.z), {
        ranged: s.ranged,
        behavior: s.behavior,
      });
    }

    // Loot containers scattered through the corridor
    const crateMat = new PBRMaterial('statCrateMat', scene);
    crateMat.albedoColor = new Color3(0.3, 0.34, 0.38);
    crateMat.metallic = 0.6;
    crateMat.roughness = 0.55;

    for (const cdef of STATION_CRATE_SPAWNS) {
      const crate = MeshBuilder.CreateBox(cdef.meshId, { size: 1.1 }, scene);
      crate.position.set(cdef.x, 0.55, cdef.z);
      crate.material = crateMat;
      new PhysicsAggregate(crate, PhysicsShapeType.BOX, { mass: 2 }, scene);

      const lootContainer = LootContainer.fromTable(STATION_STANDARD_CRATE);
      crate.metadata = {
        hudLabel: 'Supply crate',
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
          window.dispatchEvent(
            new CustomEvent('raidLootPicked', {
              detail: { itemId: grant.itemId, quantity: grant.quantity, isObjective: false },
            })
          );
          if (lootContainer.isEmpty) {
            crate.dispose();
          }
        },
      };
    }

    const player = new PlayerController(this.game, scene, new Vector3(0, 3, 0));
    this.game.player = player;

    scene.onBeforeRenderObservable.add(() => {
      const surge = environmentalSurgeActiveAt(Date.now());
      this.game.raidEnvironmentalSurge = surge;
      ambient.intensity = baseAmbientIntensity * (surge ? 0.45 : 1);
      rimCool.intensity = rimCoolBaseIntensity * (surge ? 0.52 : 1);
      const pulse = Math.sin(Date.now() / 200) > 0 ? redLightPulseHigh : redLightPulseLow;
      redLight.intensity = pulse * (surge ? 0.62 : 1);
    });

    await Promise.all([
      placeBabylonModel(scene, 'ExplodingBarrel.glb', {
        position: new Vector3(6.2, 0.45, -4),
        scale: 0.42,
      }),
      placeBabylonModel(scene, 'ExplodingBarrel.glb', {
        position: new Vector3(-6.35, 0.45, 6),
        scale: 0.4,
        rotationY: Math.PI / 3,
      }),
      placeBabylonModel(scene, 'shaderBall.glb', {
        position: new Vector3(0, 0.95, -10),
        scale: 0.08,
      }),
      placeBabylonModel(scene, 'clothFolds.glb', {
        position: new Vector3(-5.8, 0.12, 14),
        scale: 0.04,
        rotationY: -0.5,
      }),
      placeBabylonModel(scene, 'marble.gltf', {
        position: new Vector3(5.95, 0.82, -2),
        scale: 0.38,
        rotationY: 0.55,
      }),
    ]);

    scene.onBeforeRenderObservable.add(() => {
      if (!this.game.player) return;
      const playerPos = this.game.player.mesh.position;

      if (!this.descendingToMoon && Vector3.Distance(playerPos, elevator.position) < 3) {
        this.descendingToMoon = true;
        console.log('Descending to Moon Base...');
        this.game.stateMachine.setState(GameState.MOON_BASE);
      }

      if (Vector3.Distance(playerPos, returnZone.position) < 3) {
        if (this.game.stationExtractPending) return;
        this.game.stationExtractPending = true;
        console.log('Extracting to Ship...');

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
            console.log('Inventory saved to stash!');
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
            console.error('Failed to save inventory', err);
          } finally {
            this.game.stationExtractPending = false;
            this.game.stateMachine.setState(GameState.SHIP);
          }
        })();
      }
    });

    console.log('Station Scene Loaded');
    return scene;
  }
}
