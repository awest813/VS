import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, Mesh, HighlightLayer } from '@babylonjs/core';
import { EnemyAI } from '../ai/EnemyAI';

/**
 * Visual and functional logic for the Sensor Sweep gadget.
 * Creates an expanding wave and highlights enemies within range.
 */
export class SensorSweepEffect {
  private scene: Scene;
  private highlightLayer: HighlightLayer;
  private highlightedEnemies: Set<Mesh> = new Set();

  constructor(scene: Scene) {
    this.scene = scene;
    // Create or get the highlight layer for the scene
    this.highlightLayer = (scene as any)._sensorHighlightLayer || new HighlightLayer("sensorHighlight", scene);
    (scene as any)._sensorHighlightLayer = this.highlightLayer;
  }

  /**
   * Triggers a sweep from the given origin.
   * @param origin The center of the sweep (usually player position)
   * @param radius Maximum radius of the sweep
   * @param durationMs How long the sweep lasts
   */
  public async deploy(origin: Vector3, radius: number, durationMs: number): Promise<void> {
    const pingSphere = MeshBuilder.CreateSphere("sensorPing", { diameter: 1, segments: 16 }, this.scene);
    pingSphere.position = origin.clone();
    pingSphere.isPickable = false;

    const mat = new StandardMaterial("sensorPingMat", this.scene);
    mat.diffuseColor = new Color3(0, 0.8, 1);
    mat.emissiveColor = new Color3(0, 0.4, 0.6);
    mat.alpha = 0.3;
    mat.disableLighting = true;
    pingSphere.material = mat;

    const startTime = Date.now();
    
    // Pulse animation
    const observer = this.scene.onBeforeRenderObservable.add(() => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / durationMs;

      if (progress >= 1) {
        this.scene.onBeforeRenderObservable.remove(observer);
        pingSphere.dispose();
        this.clearHighlights();
        return;
      }

      // Expand sphere
      const currentRadius = progress * radius;
      pingSphere.scaling.setAll(currentRadius * 2);
      
      // Fade out
      mat.alpha = 0.3 * (1 - progress);

      // Check for enemies within the expanding radius
      this.checkEnemies(origin, currentRadius);
    });
  }

  private checkEnemies(origin: Vector3, currentRadius: number) {
    // This is a simple distance check against all meshes with 'onHit' metadata (enemies)
    for (const mesh of this.scene.meshes) {
      if (mesh.metadata && mesh.metadata.onHit && !mesh.isDisposed()) {
        const dist = Vector3.Distance(origin, mesh.absolutePosition);
        if (dist <= currentRadius && !this.highlightedEnemies.has(mesh as Mesh)) {
          this.highlightEnemy(mesh as Mesh);
        }
      }
    }
  }

  private highlightEnemy(mesh: Mesh) {
    this.highlightedEnemies.add(mesh);
    // Highlight the model meshes inside the collider
    mesh.getChildMeshes().forEach(child => {
        this.highlightLayer.addMesh(child as Mesh, Color3.FromHexString("#00FFDD"));
    });

    // Remove highlight after a few seconds
    setTimeout(() => {
      if (!mesh.isDisposed()) {
        mesh.getChildMeshes().forEach(child => {
            this.highlightLayer.removeMesh(child as Mesh);
        });
      }
      this.highlightedEnemies.delete(mesh);
    }, 4000);
  }

  private clearHighlights() {
    // This handles cleaning up if the scene changes or the effect ends abruptly
    // (Actual cleanup is handled per-enemy in highlightEnemy timeout)
  }
}
