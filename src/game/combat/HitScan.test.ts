import { Mesh, Scene, Vector3 } from '@babylonjs/core';
import { describe, expect, it, vi } from 'vitest';
import { HitScan } from './HitScan';

describe('HitScan', () => {
  it('returns safe miss defaults when ray pick misses', () => {
    const pickWithRay = vi.fn().mockReturnValue(null);
    const scene = { pickWithRay } as unknown as Scene;

    const result = HitScan.fireRay(scene, Vector3.Zero(), Vector3.Forward(), 42);

    expect(result).toEqual({
      hit: false,
      pickedMesh: null,
      pickedPoint: null,
      distance: 0,
    });
    expect(pickWithRay).toHaveBeenCalledOnce();
  });

  it('returns hit payload from scene raycast result', () => {
    const pickedMesh = { name: 'target' } as unknown as Mesh;
    const pickedPoint = new Vector3(2, 3, 4);
    const pickWithRay = vi.fn().mockReturnValue({
      hit: true,
      pickedMesh,
      pickedPoint,
      distance: 9,
    });
    const scene = { pickWithRay } as unknown as Scene;

    const result = HitScan.fireRay(scene, Vector3.Zero(), Vector3.Forward(), 100);

    expect(result.hit).toBe(true);
    expect(result.pickedMesh).toBe(pickedMesh);
    expect(result.pickedPoint).toBe(pickedPoint);
    expect(result.distance).toBe(9);
  });
});
