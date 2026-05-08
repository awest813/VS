import { Scene, Vector3, PointLight, MeshBuilder, Color4, HemisphericLight, PhysicsAggregate, PhysicsShapeType, StandardMaterial, Color3 } from '@babylonjs/core';
import { Game } from '../Game';
import { PlayerController } from '../player/PlayerController';
import { GameState } from '../StateMachine';
import { db, type Contract } from '../persistence/SaveDB';
import { mergeAmmoForShipExtract } from '../persistence/raidExtract';
import { EnemyAI } from '../ai/EnemyAI';

const STATION_HOSTILES_FOR_DEBRIS_CONTRACT = 2;

export class StationScene {
  private game: Game;
  private descendingToMoon = false;

  constructor(game: Game) {
    this.game = game;
  }

  public async create(): Promise<Scene> {
    const scene = new Scene(this.game.engine);
    // Station is cold, silent, corporate
    scene.clearColor = new Color4(0.02, 0.02, 0.05, 1);
    
    // Enable Physics
    if (this.game.havokPlugin) {
      scene.enablePhysics(new Vector3(0, -9.81, 0), this.game.havokPlugin);
    }

    // Player Controller
    const player = new PlayerController(this.game, scene, new Vector3(0, 3, 0));
    this.game.player = player;

    // Ambient light
    const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
    ambient.intensity = 0.3;

    // Materials
    const floorMat = new StandardMaterial("floorMat", scene);
    floorMat.diffuseColor = new Color3(0.5, 0.5, 0.6); // Grey/blue corporate
    const wallMat = new StandardMaterial("wallMat", scene);
    wallMat.diffuseColor = new Color3(0.7, 0.7, 0.8);

    // Corridor
    const floor = MeshBuilder.CreateBox("floor", { width: 15, height: 1, depth: 40 }, scene);
    floor.position.y = -0.5;
    floor.material = floorMat;
    new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const wallL = MeshBuilder.CreateBox("wallL", { width: 0.5, height: 5, depth: 40 }, scene);
    wallL.position.x = -7.5;
    wallL.position.y = 2.5;
    wallL.material = wallMat;
    new PhysicsAggregate(wallL, PhysicsShapeType.BOX, { mass: 0 }, scene);

    const wallR = MeshBuilder.CreateBox("wallR", { width: 0.5, height: 5, depth: 40 }, scene);
    wallR.position.x = 7.5;
    wallR.position.y = 2.5;
    wallR.material = wallMat;
    new PhysicsAggregate(wallR, PhysicsShapeType.BOX, { mass: 0 }, scene);

    // Blinking Emergency Lights
    const redLight = new PointLight("redLight", new Vector3(0, 4, 10), scene);
    redLight.diffuse = new Color3(1, 0, 0);
    redLight.intensity = 1;
    scene.onBeforeRenderObservable.add(() => {
      redLight.intensity = Math.sin(Date.now() / 200) > 0 ? 1 : 0.1;
    });

    // Descent Elevator (To Moon Base)
    const elevatorMat = new StandardMaterial("elevatorMat", scene);
    elevatorMat.diffuseColor = new Color3(1, 0.5, 0); // Orange
    const elevator = MeshBuilder.CreateBox("elevator", { width: 4, height: 4, depth: 4 }, scene);
    elevator.position.set(0, 2, 18);
    elevator.material = elevatorMat;
    elevator.isPickable = false;

    // Extraction Zone (Back to Ship)
    const returnMat = new StandardMaterial("returnMat", scene);
    returnMat.diffuseColor = new Color3(0, 1, 0); // Green
    returnMat.alpha = 0.5;
    const returnZone = MeshBuilder.CreateBox("returnZone", { width: 4, height: 4, depth: 4 }, scene);
    returnZone.position.set(0, 2, -18);
    returnZone.material = returnMat;
    returnZone.isPickable = false;

    // Spawn some enemies
    const enemy1 = new EnemyAI(this.game, scene, new Vector3(3, 1, 5));
    const enemy2 = new EnemyAI(this.game, scene, new Vector3(-3, 1, 10));

    // Check triggers
    scene.onBeforeRenderObservable.add(() => {
        if (this.game.player) {
            const playerPos = this.game.player.mesh.position;
            // To Moon Base
            if (!this.descendingToMoon && Vector3.Distance(playerPos, elevator.position) < 3) {
                this.descendingToMoon = true;
                console.log("Descending to Moon Base...");
                this.game.stateMachine.setState(GameState.MOON_BASE);
            }
            // To Ship
            if (Vector3.Distance(playerPos, returnZone.position) < 3) {
                if (this.game.stationExtractPending) return;
                this.game.stationExtractPending = true;
                console.log("Extracting to Ship...");

                const weapon = this.game.player.weapon;
                let inventory = mergeAmmoForShipExtract(
                  [...this.game.player.inventory],
                  weapon?.currentAmmo ?? 0,
                  weapon?.reserveAmmo ?? 0
                );

                void (async () => {
                    try {
                        await db.transaction('rw', db.stashItems, db.contracts, db.playerProfile, async () => {
                            for (const item of inventory) {
                                if (item.stats) {
                                    await db.stashItems.add({
                                        itemId: item.itemId,
                                        quantity: item.quantity,
                                        slot: 'stash',
                                        stats: item.stats,
                                    });
                                } else {
                                    const existing = await db.stashItems
                                        .where('itemId')
                                        .equals(item.itemId)
                                        .filter((row) => row.slot === 'stash' && !row.stats)
                                        .first();
                                    if (existing) {
                                        await db.stashItems.update(existing.id!, {
                                            quantity: existing.quantity + item.quantity,
                                        });
                                    } else {
                                        await db.stashItems.add({
                                            itemId: item.itemId,
                                            quantity: item.quantity,
                                            slot: 'stash',
                                        });
                                    }
                                }
                            }

                            const activeContract = (await db.contracts.toArray()).find((c) => c.isActive);

                            const payContract = async (contract: Contract) => {
                                if (contract.id === undefined) return;
                                await db.contracts.update(contract.id, {
                                    isCompleted: true,
                                    isActive: false,
                                });
                                console.log('Contract Completed!');
                                const profile = await db.playerProfile.toCollection().first();
                                if (profile) {
                                    await db.playerProfile.update(profile.id!, {
                                        money: profile.money + contract.reward,
                                    });
                                }
                            };

                            if (activeContract?.title === 'Recover Survey Drive') {
                                const hasDrive = inventory.find((i) => i.itemId === 'survey_drive');
                                if (hasDrive) {
                                    await payContract(activeContract);
                                }
                            }

                            if (activeContract?.title === 'Clear Station Debris') {
                                if (this.game.enemiesKilledStation >= STATION_HOSTILES_FOR_DEBRIS_CONTRACT) {
                                    await payContract(activeContract);
                                }
                            }

                            const loadoutItems = await db.stashItems.where('slot').equals('loadout').toArray();
                            for (const item of loadoutItems) {
                                await db.stashItems.update(item.id!, { slot: 'stash' });
                            }
                        });
                        console.log('Inventory saved to stash!');
                    } catch (err) {
                        console.error('Failed to save inventory', err);
                    } finally {
                        this.game.stationExtractPending = false;
                        this.game.stateMachine.setState(GameState.SHIP);
                    }
                })();
            }
        }
    });

    console.log("Station Scene Loaded");
    return scene;
  }
}
