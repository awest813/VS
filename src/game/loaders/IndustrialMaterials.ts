import { Color3, DynamicTexture, MeshBuilder, NoiseProceduralTexture, PBRMaterial, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';

export function createIndustrialBump(scene: Scene, name: string, octaves = 5): NoiseProceduralTexture {
  const n = new NoiseProceduralTexture(name, 512, scene);
  n.octaves = octaves;
  n.persistence = 1.25;
  n.animationSpeedFactor = 0;
  return n;
}

export function createShipStarfield(scene: Scene, diameter = 420): TransformNode {
  const anchor = new TransformNode('starfieldAnchor', scene);
  const sky = MeshBuilder.CreateSphere('shipStarfield', { diameter, segments: 48 }, scene);
  sky.parent = anchor;
  sky.scaling = new Vector3(-1, 1, 1);

  const tex = new DynamicTexture(
    'starfieldTex',
    { width: 2048, height: 1024 },
    scene,
    false
  );
  const ctx = tex.getContext();
  const w = 2048;
  const h = 1024;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#060a14');
  grad.addColorStop(0.45, '#080c18');
  grad.addColorStop(1, '#0a0612');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const o = Math.random() * 0.55 + 0.12;
    const s = Math.random() > 0.96 ? 2 : 1;
    ctx.fillStyle = `rgba(220, 235, 255, ${o})`;
    ctx.fillRect(x, y, s, s);
  }
  tex.update();

  const mat = new StandardMaterial('starfieldMat', scene);
  mat.emissiveTexture = tex;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  sky.material = mat;
  sky.isPickable = false;

  return anchor;
}

export function makePbrMetalPanel(
  scene: Scene,
  name: string,
  albedo: Color3,
  bump: NoiseProceduralTexture,
  metallic: number,
  roughness: number
): PBRMaterial {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = albedo;
  m.metallic = metallic;
  m.roughness = roughness;
  m.bumpTexture = bump;
  m.environmentIntensity = 1;
  return m;
}
