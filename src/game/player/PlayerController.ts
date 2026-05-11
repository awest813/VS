import { Scene, Vector3, Mesh, MeshBuilder, FreeCamera, PhysicsAggregate, PhysicsShapeType, Quaternion, Ray, PhysicsMotionType, PointLight, Sound } from '@babylonjs/core';
import { Game } from '../Game';
import { WeaponController } from './WeaponController';
import { db } from '../persistence/SaveDB';
import { GameState } from '../StateMachine';
import { isInteractableTarget } from '../hub/interactionRay';
import { isPrimaryWeaponItemId } from '../weapons/weaponDefinitions';
import { doom3HandLight, flashlightOutputIntensity } from '../level/idTech4Inspired';
import {
  RAID_GADGET_COOLDOWN_MS,
  RAID_GADGET_SLOW_DURATION_MS,
} from '../raid/raidGadget';
import { AudioMix, BabylonPlaygroundSound } from '../audio/babylonPlaygroundSounds';

/** Shared with HUD cooldown bar — keep one source of truth. */
export const RAID_MEDKIT_COOLDOWN_MS = 9000;
/** Bandage heals less than medkit but recharges twice as fast. */
export const RAID_BANDAGE_COOLDOWN_MS = 4500;

export class PlayerController {
  private scene: Scene;
  private game: Game;
  public mesh: Mesh;
  public camera: FreeCamera;
  public weapon: WeaponController;
  
  public get inventory() {
    return this.game.raidInventory;
  }
  
  public hoveredInteractable: string | null = null;
  private aggregate: PhysicsAggregate;

  public health: number = 100;
  public maxHealth: number = 100;

  // Flashlight & Battery
  public flashlight: PointLight;
  public battery: number = 100;
  public maxBattery: number = 100;
  public flashlightOn: boolean = true;

  // Stamina
  public stamina: number = 100;
  public maxStamina: number = 100;
  /** True while stamina is recovering from a depleted state (requires hitting recharge threshold). */
  private staminaDepleted = false;
  private bandageReadyAtMs = 0;

  // Audio
  private footstepSound: Sound;
  private jumpSound: Sound;
  private uiBlipSound: Sound;
  private lastFootstepTime: number = 0;
  private lastJumpSoundAt = 0;
  /** Nearest-ground metadata `surfaceSound` from static brush picks (Tech-4-ish material hooks). */
  private groundSurfaceSound = 'generic';

  /** Halo/D-style pacing — medkit is a rotation, not a panic mash. */
  private medkitReadyAtMs = 0;

  private moveSpeed = 5;
  private sprintMultiplier = 1.6;
  private jumpForce = 5;
  private mouseSensitivity = 0.002;
  private isGrounded = false;

  private inputMap: { [key: string]: boolean } = {};

  constructor(game: Game, scene: Scene, startPos: Vector3 = new Vector3(0, 2, 0)) {
    this.game = game;
    this.scene = scene;

    // Create player mesh (invisible or simple capsule)
    this.mesh = MeshBuilder.CreateCapsule("playerBody", { height: 1.8, radius: 0.4 }, scene);
    this.mesh.position = startPos;
    this.mesh.isVisible = false; // Hide in first person

    // Add Physics
    this.aggregate = new PhysicsAggregate(
      this.mesh,
      PhysicsShapeType.CAPSULE,
      { mass: 1, friction: 0.5, restitution: 0 },
      scene
    );

    // Lock rotation
    this.aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
    this.aggregate.body.setMassProperties({
        inertia: new Vector3(0, 0, 0)
    });

    // Create Camera
    this.camera = new FreeCamera("playerCamera", new Vector3(0, 0.8, 0), scene);
    this.camera.parent = this.mesh;
    this.camera.minZ = 0.1;
    this.camera.attachControl(this.game.canvas, true);

    // Flashlight
    this.flashlight = new PointLight("flashlight", new Vector3(0, 0, 0), scene);
    this.flashlight.parent = this.camera;
    this.flashlight.intensity = doom3HandLight.intensityAtFullBattery;
    this.flashlight.range = doom3HandLight.range;
    
    const spatialOpts = {
      loop: false,
      autoplay: false,
      spatialSound: true,
      distanceModel: 'exponential' as const,
      maxDistance: 100,
    };

    this.footstepSound = new Sound('footstep', BabylonPlaygroundSound.bounce, scene, null, spatialOpts);
    this.footstepSound.attachToMesh(this.mesh);

    this.jumpSound = new Sound('jump', BabylonPlaygroundSound.bounce, scene, null, spatialOpts);
    this.jumpSound.attachToMesh(this.mesh);

    this.uiBlipSound = new Sound('uiBlip', BabylonPlaygroundSound.bounce, scene, null, {
      loop: false,
      autoplay: false,
      spatialSound: false,
    });

    // We must load loadout first, then initialize weapon
    this.loadLoadout().then(() => {
        // Input setup
        this.setupInput();
    });

    // Game loop update
    scene.onBeforeRenderObservable.add(() => {
      this.update();
    });
  }

  private async loadLoadout() {
    const loadoutItems = await db.stashItems.where('slot').equals('loadout').toArray();
    let equippedWeapon = 'rifle_01'; // Default
    let equippedStats: any = null;

    const staging = !this.game.loadoutStagingApplied;
    if (staging) {
      for (const item of loadoutItems) {
        if (item.itemId === 'ammo_9mm') {
          continue;
        }
        if (item.itemId === 'medkit' || item.itemId === 'bandage') {
          this.inventory.push({ itemId: item.itemId, quantity: item.quantity });
        } else if (isPrimaryWeaponItemId(item.itemId)) {
          equippedWeapon = item.itemId;
          equippedStats = item.stats || null;
        }
      }
      this.game.loadoutStagingApplied = true;
    } else {
      for (const item of loadoutItems) {
        if (isPrimaryWeaponItemId(item.itemId)) {
          equippedWeapon = item.itemId;
          equippedStats = item.stats || null;
          break;
        }
      }
    }

    this.weapon = new WeaponController(this.game, this.scene, this.camera, equippedWeapon, equippedStats);

    if (staging) {
      for (const item of loadoutItems) {
        if (item.itemId === 'ammo_9mm') {
          this.weapon.reserveAmmo += item.quantity;
        }
      }
    }

    const preserved = this.game.preservedPlayerState;
    if (preserved) {
      this.health = preserved.health;
      this.maxHealth = preserved.maxHealth;
      this.battery = preserved.battery;
      this.maxBattery = preserved.maxBattery;
      this.flashlightOn = preserved.flashlightOn;
      this.flashlight.range = doom3HandLight.range;
      this.flashlight.intensity = flashlightOutputIntensity({
        flashlightOn: this.flashlightOn,
        battery: this.battery,
        maxBattery: this.maxBattery,
        shipHub: this.game.stateMachine.getState() === GameState.SHIP,
      });
      this.weapon.currentAmmo = Math.max(0, Math.min(preserved.currentAmmo, this.weapon.maxAmmo));
      this.weapon.reserveAmmo = Math.max(0, preserved.reserveAmmo);
      this.game.preservedPlayerState = null;
    }
  }

  private onWindowKeyDown = (e: KeyboardEvent) => {
    this.inputMap[e.code] = true;
    if (e.code === 'KeyF' && !e.repeat) {
      this.flashlightOn = !this.flashlightOn;
      this.uiBlipSound.setVolume(AudioMix.uiBlipVolumeFlashlight);
      this.uiBlipSound.setPlaybackRate(AudioMix.uiBlipRateFlashlight);
      this.uiBlipSound.play();
    }
    if (e.code === 'KeyH') {
      this.tryUseMedkit();
    }
    if (e.code === 'KeyB') {
      this.tryUseBandage();
    }
    if (e.code === 'KeyG' && !e.repeat) {
      this.tryDeployRaidGadget();
    }
  };

  private onWindowKeyUp = (e: KeyboardEvent) => {
    this.inputMap[e.code] = false;
  };

  /** Ms remaining before H can heal again (0 = ready). Exposed for HUD. */
  public get medkitCooldownRemainingMs(): number {
    return Math.max(0, this.medkitReadyAtMs - Date.now());
  }

  /** Ms remaining before B can apply a bandage again (0 = ready). Exposed for HUD. */
  public get bandageCooldownRemainingMs(): number {
    return Math.max(0, this.bandageReadyAtMs - Date.now());
  }

  private tryUseMedkit() {
    if (Date.now() < this.medkitReadyAtMs) return;
    if (this.health >= this.maxHealth) return;
    const inv = this.game.raidInventory;
    const idx = inv.findIndex((i) => i.itemId === 'medkit' && i.quantity > 0);
    if (idx < 0) return;
    const stack = inv[idx];
    stack.quantity -= 1;
    if (stack.quantity <= 0) {
      inv.splice(idx, 1);
    }
    this.health = Math.min(this.maxHealth, this.health + 50);
    this.medkitReadyAtMs = Date.now() + RAID_MEDKIT_COOLDOWN_MS;
    this.uiBlipSound.setVolume(AudioMix.uiBlipVolumeMedkit);
    this.uiBlipSound.setPlaybackRate(
      AudioMix.uiBlipRateMedkitMin + Math.random() * AudioMix.uiBlipRateMedkitSpan
    );
    this.uiBlipSound.play();
  }

  /** Ms until G can fire again — driven by `Game.raidGadgetReadyAtMs`. */
  public get gadgetCooldownRemainingMs(): number {
    return Math.max(0, this.game.raidGadgetReadyAtMs - Date.now());
  }

  private tryUseBandage() {
    if (Date.now() < this.bandageReadyAtMs) return;
    if (this.health >= this.maxHealth) return;
    const inv = this.game.raidInventory;
    const idx = inv.findIndex((i) => i.itemId === 'bandage' && i.quantity > 0);
    if (idx < 0) return;
    const stack = inv[idx];
    stack.quantity -= 1;
    if (stack.quantity <= 0) {
      inv.splice(idx, 1);
    }
    this.health = Math.min(this.maxHealth, this.health + 25);
    this.bandageReadyAtMs = Date.now() + RAID_BANDAGE_COOLDOWN_MS;
    this.uiBlipSound.setVolume(AudioMix.uiBlipVolumeMedkit);
    this.uiBlipSound.setPlaybackRate(
      AudioMix.uiBlipRateMedkitMin + Math.random() * AudioMix.uiBlipRateMedkitSpan
    );
    this.uiBlipSound.play();
  }

  private tryDeployRaidGadget() {
    const st = this.game.stateMachine.getState();
    if (st !== GameState.STATION && st !== GameState.MOON_BASE) return;
    if (Date.now() < this.game.raidGadgetReadyAtMs) return;
    const now = Date.now();
    this.game.raidGadgetSlowUntil = now + RAID_GADGET_SLOW_DURATION_MS;
    this.game.raidGadgetReadyAtMs = now + RAID_GADGET_COOLDOWN_MS;
    this.uiBlipSound.setVolume(AudioMix.uiBlipVolumeGadget);
    this.uiBlipSound.setPlaybackRate(AudioMix.uiBlipRateGadget);
    this.uiBlipSound.play();
    window.dispatchEvent(new CustomEvent('raidGadgetDeployed'));
  }

  private setupInput() {
    this.scene.onDisposeObservable.add(() => {
      window.removeEventListener('keydown', this.onWindowKeyDown);
      window.removeEventListener('keyup', this.onWindowKeyUp);
      this.footstepSound.dispose();
      this.jumpSound.dispose();
      this.uiBlipSound.dispose();
    });
    window.addEventListener('keydown', this.onWindowKeyDown);
    window.addEventListener('keyup', this.onWindowKeyUp);

    this.scene.onPointerDown = () => {
      if (!this.game.engine.isPointerLock) {
        this.game.canvas.requestPointerLock();
      }
    };
  }

  private update() {
    if (!this.game.engine.isPointerLock) return;

    const dt = this.game.engine.getDeltaTime() / 1000;
    
    // Check Grounded (simple raycast down)
    this.checkGrounded();

    // Movement
    let forward = 0;
    let right = 0;

    if (this.inputMap["KeyW"]) forward = 1;
    if (this.inputMap["KeyS"]) forward = -1;
    if (this.inputMap["KeyA"]) right = -1;
    if (this.inputMap["KeyD"]) right = 1;

    const isSprinting = this.inputMap["ShiftLeft"] || this.inputMap["ShiftRight"];

    // Stamina: drain while actively sprinting + moving; regen when not sprinting or depleted
    const isMoving = (this.inputMap["KeyW"] || this.inputMap["KeyS"] || this.inputMap["KeyA"] || this.inputMap["KeyD"]);
    const sprintDraining = isSprinting && isMoving && this.isGrounded && this.game.stateMachine.getState() !== GameState.SHIP;
    if (sprintDraining && !this.staminaDepleted) {
      this.stamina = Math.max(0, this.stamina - 20 * dt);
      if (this.stamina === 0) this.staminaDepleted = true;
    } else {
      const regenRate = this.staminaDepleted ? 8 : 14;
      this.stamina = Math.min(this.maxStamina, this.stamina + regenRate * dt);
      if (this.staminaDepleted && this.stamina >= 25) this.staminaDepleted = false;
    }

    const canSprint = isSprinting && !this.staminaDepleted;
    const currentSpeed = canSprint ? this.moveSpeed * this.sprintMultiplier : this.moveSpeed;

    const moveDirection = new Vector3(right, 0, forward).normalize();
    
    // Rotate movement relative to camera yaw
    const yaw = this.camera.rotation.y;
    const rotatedDirection = new Vector3(
        moveDirection.x * Math.cos(yaw) + moveDirection.z * Math.sin(yaw),
        0,
        moveDirection.z * Math.cos(yaw) - moveDirection.x * Math.sin(yaw)
    );

    const velocity = rotatedDirection.scale(currentSpeed);
    const currentVelocity = this.aggregate.body.getLinearVelocity();
    
    // Jump (debounce jump SFX — grounded can stay true for multiple ticks)
    if (this.inputMap['Space'] && this.isGrounded) {
      currentVelocity.y = this.jumpForce;
      // Each jump costs a small amount of stamina
      this.stamina = Math.max(0, this.stamina - 10);
      if (this.stamina === 0) this.staminaDepleted = true;
      const now = Date.now();
      if (now - this.lastJumpSoundAt > 320) {
        this.lastJumpSoundAt = now;
        this.jumpSound.setVolume(AudioMix.jumpVolume);
        this.jumpSound.setPlaybackRate(AudioMix.jumpRateMin + Math.random() * AudioMix.jumpRateJitter);
        this.jumpSound.play();
      }
    }

    // Apply velocity while preserving gravity
    this.aggregate.body.setLinearVelocity(new Vector3(velocity.x, currentVelocity.y, velocity.z));

    const onShipHub = this.game.stateMachine.getState() === GameState.SHIP;

    // Footstep Audio (muted on ship hub — deck ambience handled separately)
    if (!onShipHub && this.isGrounded && velocity.lengthSquared() > 0.1) {
      let stepInterval = canSprint ? 300 : 500;
      if (this.groundSurfaceSound === 'metal') stepInterval *= 0.88;
      const now = Date.now();
      if (now - this.lastFootstepTime > stepInterval) {
        const metal = this.groundSurfaceSound === 'metal';
        this.footstepSound.setVolume(metal ? AudioMix.footstepVolumeMetal : AudioMix.footstepVolume);
        this.footstepSound.setPlaybackRate(
          (metal
            ? AudioMix.footstepRateMin + AudioMix.footstepRateMetalBoost
            : AudioMix.footstepRateMin) + Math.random() * AudioMix.footstepRateJitter
        );
        this.footstepSound.play();
        this.lastFootstepTime = now;
      }
    }

    if (onShipHub) {
      if (this.battery < this.maxBattery) {
        this.battery = Math.min(this.maxBattery, this.battery + 2.8 * dt);
      }
      this.flashlight.intensity = flashlightOutputIntensity({
        flashlightOn: this.flashlightOn,
        battery: this.battery,
        maxBattery: this.maxBattery,
        shipHub: true,
      });
    } else if (this.flashlightOn && this.battery > 0) {
      this.battery -= 0.5 * dt;
      this.flashlight.intensity = flashlightOutputIntensity({
        flashlightOn: true,
        battery: this.battery,
        maxBattery: this.maxBattery,
        shipHub: false,
      });
    } else {
      this.flashlight.intensity = 0;
      if (this.battery < this.maxBattery) {
        this.battery += 1.0 * dt;
      }
    }

    let interactionReach = 8;
    if (onShipHub) {
      interactionReach = 18;
    } else if (this.game.stateMachine.getState() === GameState.STATION) {
      interactionReach = 11;
    }

    const ray = this.camera.getForwardRay(interactionReach);
    const pick = this.scene.pickWithRay(ray, (m) => isInteractableTarget(m));
    const hit = pick?.pickedMesh ?? null;

    if (pick?.hit && isInteractableTarget(hit)) {
      const hud =
        typeof hit.metadata?.hudLabel === 'string' ? hit.metadata.hudLabel : hit.name;
      this.hoveredInteractable = hud;
      if (this.inputMap['KeyE']) {
        console.log('Interacted with:', hit.name);
        this.uiBlipSound.setVolume(AudioMix.uiBlipVolumeInteract);
        this.uiBlipSound.setPlaybackRate(AudioMix.uiBlipRateInteract + Math.random() * 0.06);
        this.uiBlipSound.play();
        (hit.metadata.onInteract as () => void)();
        this.inputMap['KeyE'] = false;
      }
    } else {
      this.hoveredInteractable = null;
    }
  }

  private checkGrounded() {
    // Cast a small ray down from the mesh center
    const ray = new Ray(this.mesh.position, new Vector3(0, -1, 0), 1.1);
    const pick = this.scene.pickWithRay(ray);
    this.isGrounded = pick?.hit || false;
    const tag = pick?.pickedMesh?.metadata?.surfaceSound;
    this.groundSurfaceSound = typeof tag === 'string' ? tag : 'generic';
  }

  public takeDamage(amount: number) {
    if (this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    console.log(`Player hit! Health: ${this.health}`);

    // Camera shake — guard restore against disposal during the 100ms window (death → scene swap).
    const originalFov = this.camera.fov;
    this.camera.fov = originalFov * 1.05;
    setTimeout(() => {
        if (this.camera && !this.camera.isDisposed()) this.camera.fov = originalFov;
    }, 100);

    if (this.health <= 0) {
      console.warn('Raid failed — casualty. Salvaged raid backpack is forfeited.');
      window.dispatchEvent(new CustomEvent('raidPlayerDeath'));
      queueMicrotask(() => {
        if (this.game.stateMachine.getState() === GameState.SHIP) return;
        this.game.raidInventory = [];
        this.game.stateMachine.setState(GameState.SHIP);
      });
    }
  }
}
