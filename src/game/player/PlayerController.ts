import { Scene, Vector3, Mesh, MeshBuilder, FreeCamera, PhysicsAggregate, PhysicsShapeType, Quaternion, Ray, PhysicsMotionType, PointLight, Sound } from '@babylonjs/core';
import { Game } from '../Game';
import { WeaponController } from './WeaponController';
import { db } from '../persistence/SaveDB';

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

  // Audio
  private footstepSound: Sound;
  private lastFootstepTime: number = 0;

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
    this.flashlight.intensity = 2.0;
    this.flashlight.range = 40;
    
    // Footstep Sound (Spatial)
    this.footstepSound = new Sound("footstep", "https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/sounds/gunshot.wav", scene, null, {
      loop: false,
      autoplay: false,
      spatialSound: true,
      distanceModel: "exponential",
      maxDistance: 100
    });
    this.footstepSound.attachToMesh(this.mesh);
    // Lower volume and pitch down to sound more like a thud
    this.footstepSound.setVolume(0.2);
    this.footstepSound.setPlaybackRate(0.5);

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
        if (item.itemId === 'medkit') {
          this.inventory.push({ itemId: item.itemId, quantity: item.quantity });
        } else if (item.itemId === 'shotgun_01' || item.itemId === 'pulse_rifle' || item.itemId === 'rifle_01') {
          equippedWeapon = item.itemId;
          equippedStats = item.stats || null;
        }
      }
      this.game.loadoutStagingApplied = true;
    } else {
      for (const item of loadoutItems) {
        if (item.itemId === 'shotgun_01' || item.itemId === 'pulse_rifle' || item.itemId === 'rifle_01') {
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
      this.flashlight.intensity =
        this.flashlightOn && this.battery > 0 ? (this.battery / this.maxBattery) * 2.0 : 0;
      this.weapon.currentAmmo = Math.max(0, Math.min(preserved.currentAmmo, this.weapon.maxAmmo));
      this.weapon.reserveAmmo = Math.max(0, preserved.reserveAmmo);
      this.game.preservedPlayerState = null;
    }
  }

  private onWindowKeyDown = (e: KeyboardEvent) => {
    this.inputMap[e.code] = true;
    if (e.code === 'KeyF') {
      this.flashlightOn = !this.flashlightOn;
    }
    if (e.code === 'KeyH') {
      this.tryUseMedkit();
    }
  };

  private onWindowKeyUp = (e: KeyboardEvent) => {
    this.inputMap[e.code] = false;
  };

  private tryUseMedkit() {
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
  }

  private setupInput() {
    this.scene.onDisposeObservable.add(() => {
      window.removeEventListener('keydown', this.onWindowKeyDown);
      window.removeEventListener('keyup', this.onWindowKeyUp);
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
    const currentSpeed = isSprinting ? this.moveSpeed * this.sprintMultiplier : this.moveSpeed;

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
    
    // Jump
    if (this.inputMap["Space"] && this.isGrounded) {
        currentVelocity.y = this.jumpForce;
    }

    // Apply velocity while preserving gravity
    this.aggregate.body.setLinearVelocity(new Vector3(velocity.x, currentVelocity.y, velocity.z));

    // Footstep Audio
    if (this.isGrounded && velocity.lengthSquared() > 0.1) {
        const stepInterval = isSprinting ? 300 : 500;
        const now = Date.now();
        if (now - this.lastFootstepTime > stepInterval) {
            this.footstepSound.play();
            this.lastFootstepTime = now;
        }
    }

    // Battery Logic
    if (this.flashlightOn && this.battery > 0) {
        this.battery -= 0.5 * dt; // Drain
        this.flashlight.intensity = (this.battery / this.maxBattery) * 2.0; // Dim as battery dies
    } else {
        this.flashlight.intensity = 0;
        // Slow recharge when off
        if (this.battery < this.maxBattery) {
            this.battery += 1.0 * dt;
        }
    }

    // Interaction Raycast
    const ray = this.camera.getForwardRay(3);
    const pick = this.scene.pickWithRay(ray);
    if (pick?.hit && pick.pickedMesh?.metadata?.onInteract) {
        this.hoveredInteractable = pick.pickedMesh.name;
        if (this.inputMap["KeyE"]) {
            console.log("Interacted with:", pick.pickedMesh.name);
            pick.pickedMesh.metadata.onInteract();
            this.inputMap["KeyE"] = false;
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
  }

  public takeDamage(amount: number) {
    this.health -= amount;
    console.log(`Player hit! Health: ${this.health}`);
    
    // Camera shake
    const originalFov = this.camera.fov;
    this.camera.fov = originalFov * 1.05;
    setTimeout(() => {
        if (this.camera) this.camera.fov = originalFov;
    }, 100);

    if (this.health <= 0) {
        console.log("Player Died!");
        // TODO: Transition to DEATH state
    }
  }
}
