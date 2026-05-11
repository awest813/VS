import { Scene, Vector3, Mesh, MeshBuilder, FreeCamera, PhysicsAggregate, PhysicsShapeType, Quaternion, Ray, PhysicsMotionType, PointLight, Sound, Color3, StandardMaterial, HighlightLayer } from '@babylonjs/core';
import { Game } from '../Game';
import { WeaponController } from './WeaponController';
import { GADGET_ARCHETYPES, getGadgetArchetype, type GadgetItemId } from '../gadgets/gadgetDefinitions';
import { db } from '../persistence/SaveDB';
import { GameState } from '../StateMachine';
import { isInteractableTarget, resolveInteractableTarget } from '../hub/interactionRay';
import { isPrimaryWeaponItemId, isAmmoItemId } from '../weapons/weaponDefinitions';
import { doom3HandLight, flashlightOutputIntensity } from '../level/idTech4Inspired';
import { applyArmorUpgradeBonuses, combineWeaponUpgradeMods, normalizeUpgradeState } from '../progression/profileProgression';
import {
  RAID_GADGET_COOLDOWN_MS,
  RAID_GADGET_SLOW_DURATION_MS,
} from '../raid/raidGadget';
import { AudioMix, BabylonPlaygroundSound } from '../audio/babylonPlaygroundSounds';
import { SensorSweepEffect } from '../gadgets/SensorSweepEffect';

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
  private batteryWarningPlayed = false;

  // Stamina
  public stamina: number = 100;
  public maxStamina: number = 100;
  /** True while stamina is recovering from a depleted state (requires hitting recharge threshold). */
  private staminaDepleted: boolean = false;
  
  // Suit Multipliers
  private suitSpeedMultiplier: number = 1.0;
  private suitJumpMultiplier: number = 1.0;
  private suitStaminaRegenMultiplier: number = 1.0;
  private suitBatteryRechargeMultiplier: number = 1.0;
  public suitClass: string = 'pathfinder';
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
    const profile = await db.playerProfile.toCollection().first();
    const upgradeState = normalizeUpgradeState(profile);
    let equippedWeapon = 'rifle_01'; // Default
    let equippedStats: any = null;

    const staging = !this.game.loadoutStagingApplied;
    if (staging) {
      for (const item of loadoutItems) {
        if (isAmmoItemId(item.itemId)) {
          continue;
        }
        if (isPrimaryWeaponItemId(item.itemId)) {
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

    const sClass = profile?.suitClass ?? 'pathfinder';
    const armorStats = applyArmorUpgradeBonuses(upgradeState, sClass);
    this.suitClass = sClass;
    this.maxHealth = armorStats.maxHealth;
    this.health = armorStats.maxHealth;
    this.maxStamina = armorStats.maxStamina;
    this.stamina = armorStats.maxStamina;
    this.maxBattery = armorStats.maxBattery;
    this.battery = armorStats.maxBattery;

    this.suitSpeedMultiplier = armorStats.speedMultiplier;
    this.suitJumpMultiplier = armorStats.jumpMultiplier;
    this.suitStaminaRegenMultiplier = armorStats.staminaRegenMultiplier;
    this.suitBatteryRechargeMultiplier = armorStats.batteryRechargeMultiplier;

    this.weapon = new WeaponController(
      this.game,
      this.scene,
      this.camera,
      equippedWeapon,
      combineWeaponUpgradeMods(equippedStats, upgradeState)
    );

    if (staging) {
      for (const item of loadoutItems) {
        if (isAmmoItemId(item.itemId) || item.itemId === 'medkit' || item.itemId === 'bandage' || GADGET_ARCHETYPES[item.itemId as GadgetItemId]) {
          this.game.raidInventory.push({ itemId: item.itemId, quantity: item.quantity });
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
      // reserveAmmo is a getter now, so we don't set it directly. 
      // It is derived from the game's raidInventory which is preserved elsewhere.
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
    if (st !== GameState.STATION && st !== GameState.MOON_BASE && st !== GameState.PLANET) return;
    if (Date.now() < this.game.raidGadgetReadyAtMs) return;

    const inv = this.game.raidInventory;
    const gadgetIdx = inv.findIndex(i => GADGET_ARCHETYPES[i.itemId as GadgetItemId] !== undefined);
    if (gadgetIdx < 0) return;

    const item = inv[gadgetIdx];
    const arch = getGadgetArchetype(item.itemId)!;
    
    const now = Date.now();
    this.game.raidGadgetReadyAtMs = now + arch.cooldownMs;
    
    // Consume 1 gadget
    item.quantity--;
    if (item.quantity <= 0) inv.splice(gadgetIdx, 1);

    this.uiBlipSound.setVolume(AudioMix.uiBlipVolumeGadget);
    this.uiBlipSound.setPlaybackRate(AudioMix.uiBlipRateGadget);
    this.uiBlipSound.play();

    // Effect Dispatch
    if (arch.id === 'flare_chem') {
      const flareMesh = MeshBuilder.CreateCylinder("flareStick", { height: 0.25, diameter: 0.05 }, this.scene);
      flareMesh.position = this.mesh.position.clone();
      const flareMat = new StandardMaterial("flareMat", this.scene);
      flareMat.emissiveColor = new Color3(1, 0.4, 0.2);
      flareMesh.material = flareMat;

      const light = new PointLight("flareLight", this.mesh.position.clone(), this.scene);
      light.diffuse = new Color3(1, 0.6, 0.3);
      light.intensity = 2.5;
      light.range = 45;
      
      setTimeout(() => {
        light.dispose();
        flareMesh.dispose();
      }, arch.durationMs);
    } else if (arch.id === 'shield_deploy') {
      const shield = MeshBuilder.CreateBox("portableShield", { width: 3.2, height: 2.2, depth: 0.15 }, this.scene);
      shield.position = this.mesh.position.add(this.camera.getForwardRay().direction.scale(2.5));
      shield.position.y = 1.1;
      shield.lookAt(this.mesh.position);
      shield.rotation.y += Math.PI;

      const mat = new StandardMaterial("shieldMat", this.scene);
      mat.emissiveColor = new Color3(0.1, 0.4, 1.0);
      mat.alpha = 0.35;
      mat.backFaceCulling = false;
      // Procedural Hex-ish Grid (using emissive and wireframe-ish feel)
      mat.diffuseColor = new Color3(0.2, 0.6, 1.0);
      shield.material = mat;

      setTimeout(() => shield.dispose(), arch.durationMs);
    } else if (arch.id === 'sensor_sweep') {
      const sweep = new SensorSweepEffect(this.scene);
      sweep.deploy(this.mesh.position, 25, arch.durationMs);
    }

    window.dispatchEvent(new CustomEvent('raidGadgetDeployed', { detail: { itemId: arch.id } }));
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
      const regenRate = (this.staminaDepleted ? 8 : 14) * this.suitStaminaRegenMultiplier;
      this.stamina = Math.min(this.maxStamina, this.stamina + regenRate * dt);
      if (this.staminaDepleted && this.stamina >= 25) this.staminaDepleted = false;
    }

    const canSprint = isSprinting && !this.staminaDepleted;
    const currentSpeed = (canSprint ? this.moveSpeed * this.sprintMultiplier : this.moveSpeed) * this.suitSpeedMultiplier;

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
      currentVelocity.y = this.jumpForce * this.suitJumpMultiplier;
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
      
      // Surface-specific interval modifiers
      if (this.groundSurfaceSound === 'metal') stepInterval *= 0.88;
      else if (this.groundSurfaceSound === 'water') stepInterval *= 1.15;
      else if (this.groundSurfaceSound === 'debris') stepInterval *= 0.95;

      const now = Date.now();
      if (now - this.lastFootstepTime > stepInterval) {
        const surface = this.groundSurfaceSound;
        const metal = surface === 'metal';
        const water = surface === 'water';
        const debris = surface === 'debris';
        
        let volume = metal ? AudioMix.footstepVolumeMetal : AudioMix.footstepVolume;
        if (canSprint) volume *= 1.45; // Sprinting is louder

        this.footstepSound.setVolume(volume);
        
        let rate = AudioMix.footstepRateMin;
        if (metal) rate += AudioMix.footstepRateMetalBoost;
        else if (water) rate -= 0.12; // Sloshing is slower/lower pitch
        else if (debris) rate += 0.05;

        this.footstepSound.setPlaybackRate(rate + Math.random() * AudioMix.footstepRateJitter * 2);
        this.footstepSound.play();
        this.lastFootstepTime = now;
      }
    }

    // Battery Warning Audio
    if (!onShipHub && this.flashlightOn && this.battery / this.maxBattery < 0.15) {
      if (!this.batteryWarningPlayed) {
        this.batteryWarningPlayed = true;
        this.uiBlipSound.setVolume(AudioMix.uiBlipVolumeFlashlight * 2);
        this.uiBlipSound.setPlaybackRate(0.85); // Low warning tone
        this.uiBlipSound.play();
        setTimeout(() => {
          this.uiBlipSound.setPlaybackRate(1.15); // Rising follow-up
          this.uiBlipSound.play();
        }, 220);
      }
    } else if (this.battery / this.maxBattery > 0.2) {
      this.batteryWarningPlayed = false;
    }

    if (onShipHub) {
      if (this.battery < this.maxBattery) {
        this.battery = Math.min(this.maxBattery, this.battery + 2.8 * this.suitBatteryRechargeMultiplier * dt);
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
    const interactable = resolveInteractableTarget(hit);

    if (pick?.hit && interactable) {
      const hud =
        typeof interactable.metadata?.hudLabel === 'string' ? interactable.metadata.hudLabel : interactable.name;
      this.hoveredInteractable = hud;
      if (this.inputMap['KeyE']) {
        this.uiBlipSound.setVolume(AudioMix.uiBlipVolumeInteract);
        this.uiBlipSound.setPlaybackRate(AudioMix.uiBlipRateInteract + Math.random() * 0.06);
        this.uiBlipSound.play();
        const onInteract = interactable.metadata?.onInteract;
        if (typeof onInteract === 'function') {
          onInteract();
        }
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

    window.dispatchEvent(new CustomEvent('playerHit', {
      detail: { amount, healthPct: this.health / this.maxHealth }
    }));

    // Camera shake — guard restore against disposal during the 100ms window (death → scene swap).
    const originalFov = this.camera.fov;
    this.camera.fov = originalFov * 1.05;
    setTimeout(() => {
        if (this.camera && !this.camera.isDisposed()) this.camera.fov = originalFov;
    }, 100);

    if (this.health <= 0) {
      window.dispatchEvent(new CustomEvent('raidPlayerDeath'));
      queueMicrotask(() => {
        if (this.game.stateMachine.getState() === GameState.SHIP) return;
        this.game.raidInventory = [];
        this.game.stateMachine.setState(GameState.SHIP);
      });
    }
  }
}
