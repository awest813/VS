import { Scene, Vector3, Mesh, MeshBuilder, Color3, StandardMaterial, PointerEventTypes, Sound, Ray, Observer, PointerInfo, Camera, PBRMaterial } from '@babylonjs/core';
import { Game } from '../Game';
import { HitScan } from '../combat/HitScan';
import { GameState } from '../StateMachine';
import {
  applyWeaponLootMods,
  computeReloadTransfer,
  getWeaponArchetype,
  type WeaponLootMods,
} from '../weapons/weaponDefinitions';
import { AudioMix, BabylonPlaygroundSound } from '../audio/babylonPlaygroundSounds';

export class WeaponController {
  private scene: Scene;
  private game: Game;
  private camera: Camera;

  public currentAmmo: number = 30;
  public maxAmmo: number = 30;
  public reserveAmmo: number = 0;
  public isReloading: boolean = false;

  /** Stash/loadout weapon id (`rifle_01`, …) */
  public readonly weaponItemId: string;

  private fireRate: number = 150;
  private lastFireTime: number = 0;
  private damage: number = 25;
  private pelletCount = 1;
  private pelletSpread = 0;
  private hitscanRange = 100;
  private reloadDurationMs = 1800;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private weaponStats: WeaponLootMods | null = null;
  private recoilScale = 1;

  private weaponMesh: Mesh | null = null;
  private fireSound: Sound | null = null;
  private reloadStartSound: Sound | null = null;
  private reloadChamberSound: Sound | null = null;
  private pointerObserver: Observer<PointerInfo> | null = null;
  private onReloadKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'KeyR' && this.game.stateMachine.getState() !== GameState.SHIP) {
      this.reload();
    }
  };

  constructor(game: Game, scene: Scene, camera: Camera, weaponItemId: string = 'rifle_01', weaponStats: WeaponLootMods | null = null) {
    this.game = game;
    this.scene = scene;
    this.camera = camera;
    this.weaponItemId = weaponItemId;
    this.weaponStats = weaponStats;

    this.applyWeaponStats();

    this.createWeaponMesh();
    this.setupInput();

    this.scene.onBeforeRenderObservable.add(() => {
      this.updateWeaponPosition();
      if (this.weaponMesh) {
        this.weaponMesh.isVisible = this.game.stateMachine.getState() !== GameState.SHIP;
      }
    });

    this.scene.onDisposeObservable.add(() => {
      if (this.pointerObserver) {
        this.scene.onPointerObservable.remove(this.pointerObserver);
        this.pointerObserver = null;
      }
      if (this.reloadTimer) {
        clearTimeout(this.reloadTimer);
        this.reloadTimer = null;
      }
      window.removeEventListener('keydown', this.onReloadKeyDown);
      this.fireSound?.dispose();
      this.fireSound = null;
      this.reloadStartSound?.dispose();
      this.reloadStartSound = null;
      this.reloadChamberSound?.dispose();
      this.reloadChamberSound = null;
    });
  }

  private applyWeaponStats() {
    const archetype = getWeaponArchetype(this.weaponItemId);
    this.maxAmmo = archetype.magazineSize;
    this.currentAmmo = archetype.magazineSize;
    this.pelletCount = archetype.pelletCount;
    this.pelletSpread = archetype.spread;
    this.hitscanRange = archetype.hitscanRange;
    this.reloadDurationMs = archetype.reloadDurationMs;

    const mod = applyWeaponLootMods(archetype, this.weaponStats);
    this.damage = mod.damage;
    this.fireRate = mod.fireRateMs;
    this.recoilScale = archetype.recoilScale;
  }

  private createWeaponMesh() {
    const arch = getWeaponArchetype(this.weaponItemId);
    const { width, height, depth } = arch.viewportMesh;
    this.weaponMesh = MeshBuilder.CreateBox('primaryWeapon', { width, height, depth }, this.scene);
    this.weaponMesh.parent = this.camera;
    this.weaponMesh.position.set(0.2, -0.2, 0.4);

    const mat = new PBRMaterial('weaponFrame', this.scene);
    mat.albedoColor = new Color3(...arch.viewportTintRgb);
    mat.metallic = 0.92;
    mat.roughness = 0.38;
    mat.emissiveColor = new Color3(...arch.viewportEmissiveRgb);
    this.weaponMesh.material = mat;

    const spatialOpts = {
      loop: false,
      autoplay: false,
      spatialSound: true,
      distanceModel: 'exponential' as const,
      maxDistance: 100,
    };
    this.fireSound = new Sound('fire', BabylonPlaygroundSound.gunshot, this.scene, null, spatialOpts);
    this.fireSound.attachToMesh(this.weaponMesh);

    this.reloadStartSound = new Sound(
      'reloadStart',
      AudioMix.reloadStartSrc,
      this.scene,
      null,
      spatialOpts
    );
    this.reloadStartSound.attachToMesh(this.weaponMesh);

    this.reloadChamberSound = new Sound(
      'reloadChamber',
      AudioMix.reloadChamberSrc,
      this.scene,
      null,
      spatialOpts
    );
    this.reloadChamberSound.attachToMesh(this.weaponMesh);
  }

  private setupInput() {
    this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        if (pointerInfo.event.button === 0) {
          this.startFiring();
        }
      }
    });

    window.addEventListener('keydown', this.onReloadKeyDown);
  }

  private startFiring() {
    if (this.game.stateMachine.getState() === GameState.SHIP) return;
    const now = Date.now();
    if (now - this.lastFireTime >= this.fireRate && this.currentAmmo > 0 && !this.isReloading) {
      this.fire();
      this.lastFireTime = now;
    }
  }

  private fire() {
    this.currentAmmo--;

    if (this.fireSound) {
      this.fireSound.setVolume(AudioMix.weaponFireVolume);
      this.fireSound.setPlaybackRate(
        AudioMix.weaponFireRateMin + Math.random() * AudioMix.weaponFireRateSpan
      );
      this.fireSound.play();
    }

    const ray = this.camera.getForwardRay();
    
    if (this.pelletCount > 1) {
      const spread = this.pelletSpread;
      for (let i = 0; i < this.pelletCount; i++) {
        const spreadRay = new Ray(
          ray.origin,
          new Vector3(
            ray.direction.x + (Math.random() - 0.5) * spread,
            ray.direction.y + (Math.random() - 0.5) * spread,
            ray.direction.z + (Math.random() - 0.5) * spread
          ).normalize(),
          this.hitscanRange
        );
        this.processHit(spreadRay);
      }
    } else {
      this.processHit(new Ray(ray.origin, ray.direction, this.hitscanRange));
    }

    // Recoil animation
    this.applyRecoil();
  }

  private processHit(ray: Ray) {
    const result = HitScan.fireRay(this.scene, ray.origin, ray.direction, this.hitscanRange);

    if (result.hit) {
      // Damage logic
      if (result.pickedMesh?.metadata?.onHit) {
        result.pickedMesh.metadata.onHit(this.damage);
      }

      // Impact effect
      this.createImpact(result.pickedPoint!);
    }
  }

  private createImpact(point: Vector3) {
    const impact = MeshBuilder.CreateSphere("impact", { diameter: 0.1 }, this.scene);
    impact.position = point;
    const mat = new StandardMaterial("impactMat", this.scene);
    mat.emissiveColor = new Color3(1, 1, 0);
    impact.material = mat;
    
    setTimeout(() => impact.dispose(), 500);
  }

  private applyRecoil() {
    if (!this.weaponMesh) return;

    const k = this.recoilScale;
    this.weaponMesh.position.z -= 0.1 * k;
    this.weaponMesh.position.y += 0.02 * k;
    this.weaponMesh.rotation.x -= 0.05 * k;
  }

  private updateWeaponPosition() {
    if (!this.weaponMesh) return;

    const dt = this.scene.getEngine().getDeltaTime() / 1000;
    
    // Smooth recovery back to base position
    const targetZ = 0.4;
    const targetY = -0.2;
    const targetRotX = 0;

    this.weaponMesh.position.z += (targetZ - this.weaponMesh.position.z) * 10 * dt;
    this.weaponMesh.position.y += (targetY - this.weaponMesh.position.y) * 10 * dt;
    this.weaponMesh.rotation.x += (targetRotX - this.weaponMesh.rotation.x) * 10 * dt;
  }

  public reload() {
    if (this.isReloading || this.currentAmmo === this.maxAmmo || this.reserveAmmo <= 0) return;

    console.log('Reloading...');
    this.isReloading = true;
    if (this.reloadTimer) clearTimeout(this.reloadTimer);

    if (this.reloadStartSound) {
      this.reloadStartSound.setVolume(AudioMix.reloadVolume);
      this.reloadStartSound.setPlaybackRate(
        AudioMix.reloadRateMin + Math.random() * AudioMix.reloadRateSpan
      );
      this.reloadStartSound.play();
    }

    this.reloadTimer = setTimeout(() => {
      if (this.reloadChamberSound) {
        this.reloadChamberSound.setVolume(AudioMix.reloadChamberVolume);
        this.reloadChamberSound.setPlaybackRate(
          AudioMix.reloadChamberRateMin + Math.random() * AudioMix.reloadChamberRateSpan
        );
        this.reloadChamberSound.play();
      }
      const { newMag, newReserve } = computeReloadTransfer(this.currentAmmo, this.maxAmmo, this.reserveAmmo);
      this.currentAmmo = newMag;
      this.reserveAmmo = newReserve;
      this.isReloading = false;
      this.reloadTimer = null;
    }, this.reloadDurationMs);
  }
}
