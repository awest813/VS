import { Scene, Vector3, Mesh, MeshBuilder, StandardMaterial, Color3, Animation, QuadraticEase, EasingFunction, PointerEventTypes, Sound, Ray, Observer, PointerInfo } from '@babylonjs/core';
import { Game } from '../Game';
import { HitScan } from '../combat/HitScan';

export class WeaponController {
  private scene: Scene;
  private game: Game;
  private camera: Mesh; // The player camera/head
  
  public currentAmmo: number = 30;
  public maxAmmo: number = 30;
  public reserveAmmo: number = 0;
  public isReloading: boolean = false;
  
  private fireRate: number = 150; // ms
  private lastFireTime: number = 0;
  private damage: number = 25;
  private weaponType: string = 'rifle_01';
  private weaponStats: any = null;
  
  private weaponMesh: Mesh | null = null;
  private fireSound: Sound | null = null;
  private pointerObserver: Observer<PointerInfo> | null = null;
  private onReloadKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'KeyR') this.reload();
  };

  constructor(game: Game, scene: Scene, camera: any, weaponType: string = 'rifle_01', weaponStats: any = null) {
    this.game = game;
    this.scene = scene;
    this.camera = camera;
    this.weaponType = weaponType;
    this.weaponStats = weaponStats;
    
    this.applyWeaponStats();

    this.createWeaponMesh();
    this.setupInput();

    this.scene.onBeforeRenderObservable.add(() => {
        this.updateWeaponPosition();
    });

    this.scene.onDisposeObservable.add(() => {
      if (this.pointerObserver) {
        this.scene.onPointerObservable.remove(this.pointerObserver);
        this.pointerObserver = null;
      }
      window.removeEventListener('keydown', this.onReloadKeyDown);
    });
  }

  private applyWeaponStats() {
    switch (this.weaponType) {
        case 'shotgun_01':
            this.maxAmmo = 8;
            this.currentAmmo = 8;
            this.fireRate = 800;
            this.damage = 15; // per pellet
            break;
        case 'pulse_rifle':
            this.maxAmmo = 60;
            this.currentAmmo = 60;
            this.fireRate = 80;
            this.damage = 12;
            break;
        case 'rifle_01':
        default:
            this.maxAmmo = 30;
            this.currentAmmo = 30;
            this.fireRate = 150;
            this.damage = 25;
            break;
    }

    if (this.weaponStats) {
        if (this.weaponStats.damageMod) this.damage *= this.weaponStats.damageMod;
        if (this.weaponStats.fireRateMod) this.fireRate *= this.weaponStats.fireRateMod;
    }
  }

  private createWeaponMesh() {
    // Placeholder rifle mesh
    this.weaponMesh = MeshBuilder.CreateBox("rifle", { width: 0.1, height: 0.1, depth: 0.5 }, this.scene);
    this.weaponMesh.parent = this.camera;
    this.weaponMesh.position.set(0.2, -0.2, 0.4);
    
    const mat = new StandardMaterial("rifleMat", this.scene);
    mat.diffuseColor = new Color3(0.2, 0.2, 0.2);
    this.weaponMesh.material = mat;

    this.fireSound = new Sound("fire", "https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/sounds/gunshot.wav", this.scene, null, {
        spatialSound: true,
        maxDistance: 100
    });
    this.fireSound.attachToMesh(this.weaponMesh);
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
    const now = Date.now();
    if (now - this.lastFireTime >= this.fireRate && this.currentAmmo > 0 && !this.isReloading) {
      this.fire();
      this.lastFireTime = now;
    }
  }

  private fire() {
    this.currentAmmo--;
    console.log(`Fired! Ammo: ${this.currentAmmo}/${this.reserveAmmo}`);

    if (this.fireSound) {
        this.fireSound.setPlaybackRate(1.2 + Math.random() * 0.2); // slight pitch variation
        this.fireSound.play();
    }

    // Raycast from camera
    const ray = this.scene.activeCamera!.getForwardRay();
    
    if (this.weaponType === 'shotgun_01') {
        // Fire 6 pellets with spread
        for (let i = 0; i < 6; i++) {
            const spreadRay = new Ray(ray.origin, new Vector3(
                ray.direction.x + (Math.random() - 0.5) * 0.1,
                ray.direction.y + (Math.random() - 0.5) * 0.1,
                ray.direction.z + (Math.random() - 0.5) * 0.1
            ).normalize());
            this.processHit(spreadRay);
        }
    } else {
        // Normal single ray
        this.processHit(ray);
    }

    // Recoil animation
    this.applyRecoil();
  }

  private processHit(ray: Ray) {
    const result = HitScan.fireRay(this.scene, ray.origin, ray.direction);

    if (result.hit) {
      console.log("Hit:", result.pickedMesh?.name);
      
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
    
    // Kickback
    this.weaponMesh.position.z -= 0.1;
    this.weaponMesh.position.y += 0.02;
    this.weaponMesh.rotation.x -= 0.05;
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
    
    console.log("Reloading...");
    this.isReloading = true;
    
    setTimeout(() => {
      const needed = this.maxAmmo - this.currentAmmo;
      const toReload = Math.min(needed, this.reserveAmmo);
      this.currentAmmo += toReload;
      this.reserveAmmo -= toReload;
      this.isReloading = false;
      console.log("Reloaded!");
    }, 1800); // 1.8s reload
  }
}
