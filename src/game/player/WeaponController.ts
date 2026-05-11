import { Scene, Vector3, Mesh, MeshBuilder, Color3, StandardMaterial, PointerEventTypes, Sound, Ray, Observer, PointerInfo, Camera, PBRMaterial } from '@babylonjs/core';
import { Game } from '../Game';
import { HitScan } from '../combat/HitScan';
import { GameState } from '../StateMachine';
import {
  applyWeaponLootMods,
  computeDamageAtDistance,
  computeReloadTransfer,
  getWeaponArchetype,
  weaponReloadBlockedReason,
  type WeaponArchetype,
  type WeaponLootMods,
} from '../weapons/weaponDefinitions';
import { AudioMix, BabylonPlaygroundSound } from '../audio/babylonPlaygroundSounds';

export class WeaponController {
  private scene: Scene;
  private game: Game;
  private camera: Camera;

  public currentAmmo: number = 30;
  public maxAmmo: number = 30;
  
  public get reserveAmmo(): number {
    const ammoId = this.archetype.ammoItemId;
    return this.game.raidInventory
      .filter(i => i.itemId === ammoId)
      .reduce((sum, i) => sum + i.quantity, 0);
  }

  public isReloading: boolean = false;

  /** Stash/loadout weapon id (`rifle_01`, …) */
  public readonly weaponItemId: string;

  public get weaponArchetype(): WeaponArchetype {
    return this.archetype;
  }

  private fireRate: number = 150;
  private lastFireTime: number = 0;
  private damage: number = 25;
  private pelletCount = 1;
  private pelletSpread = 0;
  private hitscanRange = 100;
  private reloadDurationMs = 1800;
  private fireMode: 'auto' | 'semi' = 'auto';
  private archetype: WeaponArchetype = getWeaponArchetype('rifle_01');
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private weaponStats: WeaponLootMods | null = null;
  private recoilScale = 1;
  private recoilHeat = 0;
  private triggerHeld = false;
  private triggerConsumedForSemi = false;
  private chargeHeat = 0;

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
      this.updateFiring();
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
    this.archetype = archetype;
    this.maxAmmo = archetype.magazineSize;
    this.currentAmmo = archetype.magazineSize;
    this.pelletCount = archetype.pelletCount;
    this.pelletSpread = archetype.spread;
    this.hitscanRange = archetype.hitscanRange;
    this.reloadDurationMs = archetype.reloadDurationMs;
    this.fireMode = archetype.fireMode;

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
          this.triggerHeld = true;
          this.triggerConsumedForSemi = false;
          this.startFiring();
        }
      } else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
        if (pointerInfo.event.button === 0) {
          this.triggerHeld = false;
          this.triggerConsumedForSemi = false;
        }
      }
    });

    window.addEventListener('keydown', this.onReloadKeyDown);
  }

  private startFiring() {
    if (this.game.stateMachine.getState() === GameState.SHIP) return;
    if (this.weaponItemId === 'thermal_lance') return; // Handled in updateFiring charge logic
    if (this.fireMode === 'semi' && this.triggerConsumedForSemi) return;
    const now = Date.now();
    if (now - this.lastFireTime >= this.fireRate && this.currentAmmo > 0 && !this.isReloading) {
      this.fire();
      this.lastFireTime = now;
      if (this.fireMode === 'semi') {
        this.triggerConsumedForSemi = true;
      }
    }
  }

  private updateFiring() {
    if (!this.scene.getEngine().isPointerLock) {
      this.triggerHeld = false;
      this.triggerConsumedForSemi = false;
      this.chargeHeat = 0;
      return;
    }

    if (this.weaponItemId === 'thermal_lance') {
      if (this.triggerHeld && this.currentAmmo > 0 && !this.isReloading) {
        this.chargeHeat = Math.min(1.0, this.chargeHeat + (this.scene.getEngine().getDeltaTime() / 1500)); // 1.5s charge
        if (this.chargeHeat >= 1.0) {
          this.fire();
          this.chargeHeat = 0;
          this.triggerConsumedForSemi = true;
        }
      } else {
        this.chargeHeat = Math.max(0, this.chargeHeat - (this.scene.getEngine().getDeltaTime() / 500));
      }
    } else if (this.triggerHeld && this.fireMode === 'auto') {
      this.startFiring();
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
    const dynamicSpread = this.pelletSpread + this.recoilHeat * 0.018;
    
    if (this.pelletCount > 1) {
      const spread = dynamicSpread;
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
      const spreadRay = new Ray(
        ray.origin,
        new Vector3(
          ray.direction.x + (Math.random() - 0.5) * dynamicSpread,
          ray.direction.y + (Math.random() - 0.5) * dynamicSpread,
          ray.direction.z + (Math.random() - 0.5) * dynamicSpread
        ).normalize(),
        this.hitscanRange
      );
      this.processHit(spreadRay);
    }

    // Recoil animation
    this.applyRecoil();
  }

  private processHit(ray: Ray) {
    const result = HitScan.fireRay(this.scene, ray.origin, ray.direction, this.hitscanRange);

    if (result.hit) {
      const isEnemy = !!result.pickedMesh?.metadata?.onHit;
      if (isEnemy) {
        const scaledDamage = computeDamageAtDistance(this.archetype, this.damage, result.distance);
        result.pickedMesh!.metadata.onHit(scaledDamage);
        window.dispatchEvent(new CustomEvent('enemyHit'));
      }

      if (result.pickedPoint) {
        this.createImpact(result.pickedPoint, isEnemy);
      }
    }
  }

  private createImpact(point: Vector3, isEnemy = false) {
    const impact = MeshBuilder.CreateSphere("impact", { diameter: isEnemy ? 0.15 : 0.08 }, this.scene);
    impact.position = point.add(new Vector3(
      (Math.random() - 0.5) * 0.04,
      (Math.random() - 0.5) * 0.04,
      (Math.random() - 0.5) * 0.04
    ));
    const mat = new StandardMaterial("impactMat", this.scene);
    mat.emissiveColor = isEnemy ? new Color3(1, 0.1, 0.1) : new Color3(1, 0.85, 0.5);
    mat.backFaceCulling = false;
    impact.material = mat;
    setTimeout(() => impact.dispose(), isEnemy ? 350 : 500);
  }

  private applyRecoil() {
    if (!this.weaponMesh) return;

    const k = this.recoilScale;
    this.recoilHeat = Math.min(1, this.recoilHeat + 0.24 * k);
    this.weaponMesh.position.z -= 0.1 * k;
    this.weaponMesh.position.y += 0.02 * k;
    this.weaponMesh.rotation.x -= 0.05 * k;
  }

  private updateWeaponPosition() {
    if (!this.weaponMesh) return;

    const dt = this.scene.getEngine().getDeltaTime() / 1000;
    this.recoilHeat = Math.max(0, this.recoilHeat - dt * 2.8);
    
    // Smooth recovery back to base position
    const targetZ = 0.4;
    const targetY = -0.2;
    const targetRotX = 0;

    this.weaponMesh.position.z += (targetZ - this.weaponMesh.position.z) * 10 * dt;
    this.weaponMesh.position.y += (targetY - this.weaponMesh.position.y) * 10 * dt;
    this.weaponMesh.rotation.x += (targetRotX - this.weaponMesh.rotation.x) * 10 * dt;
  }

  public reload() {
    if (weaponReloadBlockedReason(this.isReloading, this.currentAmmo, this.maxAmmo, this.reserveAmmo)) {
      return;
    }

    console.log('Reloading...');
    this.isReloading = true;
    this.triggerHeld = false;
    this.triggerConsumedForSemi = false;
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
      
      const needed = this.maxAmmo - this.currentAmmo;
      const ammoId = this.archetype.ammoItemId;
      let toFill = 0;

      // Consume from inventory
      const inv = this.game.raidInventory;
      for (let i = inv.length - 1; i >= 0; i--) {
        if (inv[i].itemId === ammoId) {
          const take = Math.min(needed - toFill, inv[i].quantity);
          inv[i].quantity -= take;
          toFill += take;
          if (inv[i].quantity <= 0) inv.splice(i, 1);
        }
        if (toFill >= needed) break;
      }

      this.currentAmmo += toFill;
      this.isReloading = false;
      this.reloadTimer = null;
    }, this.reloadDurationMs);
  }
}
