import {
  Scene,
  Vector3,
  Mesh,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  StandardMaterial,
  Color3,
  PhysicsMotionType,
  SceneLoader,
  AnimationGroup,
  PointLight,
  PBRMaterial,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { Game } from '../Game';
import { GameState } from '../StateMachine';
import { BABYLON_MODELS } from '../loaders/BabylonAssetUrls';
import {
  RAID_GADGET_SLOW_RADIUS,
  RAID_GADGET_SLOW_SPEED_FACTOR,
} from '../raid/raidGadget';

export type EnemyBehavior = 'standard' | 'rusher' | 'anchored';

export interface EnemySpawnOptions {
  ranged?: boolean;
  behavior?: EnemyBehavior;
}

export class EnemyAI {
  private scene: Scene;
  private game: Game;
  public mesh: Mesh;
  private aggregate: PhysicsAggregate;

  private speed = 3.5;
  private health = 100;
  private isDead = false;

  /** Chase / combat activation radius */
  private aggroRange = 15;

  private attackRange = 2.0;
  private attackDamage = 15;
  private attackCooldown = 1500; // ms
  private lastAttackTime = 0;

  private isRanged: boolean = false;
  private projectileSpeed = 20;

  private modelRoot: import("@babylonjs/core").AbstractMesh | null = null;
  private animGroups: AnimationGroup[] = [];
  private currentAnim: string = "";

  constructor(game: Game, scene: Scene, position: Vector3, options: boolean | EnemySpawnOptions = false) {
    this.game = game;
    this.scene = scene;

    const opts: EnemySpawnOptions =
      typeof options === 'boolean' ? { ranged: options } : { ranged: false, ...options };
    this.isRanged = !!opts.ranged;

    if (this.isRanged) {
      this.attackRange = 12.0;
      this.attackDamage = 5;
      this.attackCooldown = 800;
    }

    const behavior = opts.behavior ?? 'standard';
    if (behavior === 'rusher') {
      this.speed *= 1.32;
      this.aggroRange = 18;
    } else if (behavior === 'anchored') {
      this.speed *= 0.72;
      this.aggroRange = 12;
      if (this.isRanged) {
        this.attackRange += 3;
      }
    }

    this.mesh = MeshBuilder.CreateBox("enemy_collider", { height: 1.8, width: 0.8, depth: 0.8 }, scene);
    this.mesh.position = position;
    this.mesh.isVisible = false; // Hide collider
    
    // Load Animated Model
    SceneLoader.ImportMeshAsync('', BABYLON_MODELS, 'alien.glb', scene).then((result) => {
        this.modelRoot = result.meshes[0];
        this.modelRoot.parent = this.mesh;
        this.modelRoot.position.y = -0.9;
        this.modelRoot.scaling = new Vector3(0.8, 0.8, 0.8);
        this.modelRoot.rotation = new Vector3(0, Math.PI, 0); // Face forward

        this.animGroups = result.animationGroups;
        this.applyThreatRoleTint();
        this.playAnim("Idle");
    }).catch(err => console.error("Failed to load enemy model", err));

    this.aggregate = new PhysicsAggregate(
      this.mesh,
      PhysicsShapeType.BOX,
      { mass: 1, friction: 0.5 },
      scene
    );
    
    // Lock rotations so enemy doesn't tip over
    this.aggregate.body.setMassProperties({ inertia: new Vector3(0, 0, 0) });

    // Metadata for interaction/damage
    this.mesh.metadata = {
      onHit: (damage: number) => this.takeDamage(damage)
    };

    scene.onBeforeRenderObservable.add(() => this.update());
  }

  /** Ranged vs melee readable at range (few enemy types, loud roles). */
  private applyThreatRoleTint() {
    if (!this.modelRoot) return;
    const meleeTint = new Color3(0.15, 0.72, 1);
    const rangedTint = new Color3(1, 0.38, 0.12);
    const emissive = this.isRanged ? rangedTint : meleeTint;
    for (const m of this.modelRoot.getChildMeshes(true)) {
      const mat = m.material;
      if (!mat) continue;
      if (mat instanceof PBRMaterial) {
        mat.emissiveColor = emissive;
        mat.emissiveIntensity = 0.55;
      } else if (mat instanceof StandardMaterial) {
        mat.emissiveColor = emissive.scale(0.35);
      }
    }
  }

  /** Short-lived warm flash before melee damage resolves — telegraph window. */
  private pulseMeleeTelegraph() {
    const light = new PointLight('meleeTelegraph', new Vector3(0, 1.05, 0), this.scene);
    light.parent = this.mesh;
    light.diffuse = new Color3(1, 0.82, 0.2);
    light.intensity = 2.8;
    light.range = 5;
    const t0 = Date.now();
    const obs = this.scene.onBeforeRenderObservable.add(() => {
      const elapsed = Date.now() - t0;
      if (elapsed >= 520 || !this.mesh || this.isDead) {
        light.dispose();
        this.scene.onBeforeRenderObservable.remove(obs);
        return;
      }
      light.intensity = 2.6 * (1 - elapsed / 520);
    });
  }

  private playAnim(nameContains: string) {
      if (!this.animGroups || this.animGroups.length === 0 || this.currentAnim === nameContains) return;
      const anim = this.animGroups.find(a => a.name.toLowerCase().includes(nameContains.toLowerCase()));
      if (anim) {
          this.animGroups.forEach(a => a.stop());
          anim.play(true);
          this.currentAnim = nameContains;
      }
  }

  private update() {
    if (this.isDead || !this.game.player || !this.game.player.mesh || !this.mesh) return;

    const playerPos = this.game.player.mesh.position;
    const enemyPos = this.mesh.position;

    if (!playerPos || !enemyPos) return;

    const distToPlayer = Vector3.Distance(playerPos, enemyPos);

    let chaseAggro = this.aggroRange;
    if (this.game.raidEnvironmentalSurge) {
      chaseAggro += 4;
    }

    if (distToPlayer < chaseAggro) {
      // Look at player (rotate collider, model follows)
      this.mesh.lookAt(new Vector3(playerPos.x, enemyPos.y, playerPos.z));

      if (distToPlayer > this.attackRange) {
        // Pathfinding
        let targetPos = playerPos;
        if (this.game.navigationPlugin) {
            const path = this.game.navigationPlugin.computePath(
                this.game.navigationPlugin.getClosestPoint(enemyPos),
                this.game.navigationPlugin.getClosestPoint(playerPos)
            );
            if (path && path.length > 1) {
                targetPos = path[1]; // Move to next waypoint
            }
        }

        const direction = targetPos.subtract(enemyPos);
        direction.y = 0;
        direction.normalize();

        let moveSpeed = this.speed;
        if (this.game.raidEnvironmentalSurge) {
          moveSpeed *= 1.1;
        }

        const planarVel = direction.scale(moveSpeed);
        let vx = planarVel.x;
        let vz = planarVel.z;

        const gadgetSlow =
          Date.now() < this.game.raidGadgetSlowUntil &&
          distToPlayer < RAID_GADGET_SLOW_RADIUS;
        if (gadgetSlow) {
          vx *= RAID_GADGET_SLOW_SPEED_FACTOR;
          vz *= RAID_GADGET_SLOW_SPEED_FACTOR;
        }

        if (this.aggregate && this.aggregate.body) {
          const currentVel = this.aggregate.body.getLinearVelocity();
          this.aggregate.body.setLinearVelocity(new Vector3(vx, currentVel.y, vz));
        }
        this.playAnim("Run"); // or Walk
      } else {
        // Stop moving
        if (this.aggregate && this.aggregate.body) {
          const currentVel = this.aggregate.body.getLinearVelocity();
          this.aggregate.body.setLinearVelocity(new Vector3(0, currentVel.y, 0));
        }

        // Attack
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldown) {
          this.attackPlayer();
          this.lastAttackTime = now;
        }
      }
    } else {
      // Idle
      if (this.aggregate && this.aggregate.body) {
        const currentVel = this.aggregate.body.getLinearVelocity();
        this.aggregate.body.setLinearVelocity(new Vector3(0, currentVel.y, 0));
      }
      this.playAnim("Idle");
    }
  }

  private attackPlayer() {
    this.playAnim("Attack");

    if (this.isRanged) {
        const startPos = this.mesh.position.add(new Vector3(0, 1, 0));
        const tracer = MeshBuilder.CreateSphere('tracer', { diameter: 0.28 }, this.scene);
        tracer.position = startPos;
        const mat = new StandardMaterial("tracerMat", this.scene);
        mat.emissiveColor = new Color3(1, 0, 0);
        tracer.material = mat;

        const playerTarget = this.game.player.mesh.position.add(new Vector3(0, 1, 0));
        const direction = playerTarget.subtract(startPos).normalize();

        const speed = this.projectileSpeed;
        const lifeTime = 2000;
        const spawnTime = Date.now();

        const observer = this.scene.onBeforeRenderObservable.add(() => {
            if (tracer.isDisposed()) return;
            const dt = this.game.engine.getDeltaTime() / 1000;
            tracer.position.addInPlace(direction.scale(speed * dt));

            if (Vector3.Distance(tracer.position, this.game.player.mesh.position) < 1.5) {
                if (this.game.player && this.game.player.takeDamage) {
                    this.game.player.takeDamage(this.attackDamage);
                }
                tracer.dispose();
                this.scene.onBeforeRenderObservable.remove(observer);
            } else if (Date.now() - spawnTime > lifeTime) {
                tracer.dispose();
                this.scene.onBeforeRenderObservable.remove(observer);
            }
        });

    } else {
        this.pulseMeleeTelegraph();
        setTimeout(() => {
            if (this.game.player && this.game.player.takeDamage) {
                this.game.player.takeDamage(this.attackDamage);
            }
        }, 500); // Delay damage to sync with animation roughly
    }
  }

  public takeDamage(damage: number) {
    if (this.isDead) return;
    
    this.health -= damage;
    console.log(`Enemy hit! Health: ${this.health}`);

    if (this.health <= 0) {
      this.die();
    }
  }

  private die() {
    this.isDead = true;
    console.log("Enemy Died!");

    if (this.game.stateMachine.getState() === GameState.STATION) {
      this.game.enemiesKilledStation++;
    }
    
    this.playAnim("Death");
    
    this.aggregate.body.setMotionType(PhysicsMotionType.STATIC);
    this.mesh.metadata.onHit = null; // Prevent further hits
    
    setTimeout(() => {
        if (this.modelRoot) this.modelRoot.dispose();
        this.mesh.dispose();
    }, 5000);
  }
}
