import { Scene, Vector3, Ray, Mesh } from '@babylonjs/core';

export interface HitResult {
  hit: boolean;
  pickedMesh: Mesh | null;
  pickedPoint: Vector3 | null;
  distance: number;
}

export class HitScan {
  public static fireRay(scene: Scene, origin: Vector3, direction: Vector3, range: number = 100): HitResult {
    const ray = new Ray(origin, direction, range);
    const pick = scene.pickWithRay(ray);

    return {
      hit: pick?.hit || false,
      pickedMesh: pick?.pickedMesh as Mesh || null,
      pickedPoint: pick?.pickedPoint || null,
      distance: pick?.distance || 0
    };
  }
}
