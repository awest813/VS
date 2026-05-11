import { PBRMaterial, Scene, Texture } from "@babylonjs/core";

import basecolorTxr2 from "../textures/Metal_Plate_041_basecolor2.jpg";
import normalDisplacementTxr2 from "../textures/Metal_Plate_041_NRM_DSP.png";
import metallicRoughnessAoTxr2 from "../textures/Metal_Plate_041_OCC_ROUGH_METAL.jpg";
import basecolorTxr from "../textures/Metal_Plate_015_basecolor.jpg";
import normalDisplacementTxr from "../textures/Metal_Plate_015_NRM_DSP.png";
import metallicRoughnessAoTxr from "../textures/Metal_Plate_015_OCC_ROUGH_METAL.jpg";
import basecolorTxr3 from "../textures/Mushroom_Top_001_basecolor.jpg";
import normalDisplacementTxr3 from "../textures/Mushroom_Top_001_NRM_DSP.png";
import metallicRoughnessAoTxr3 from "../textures/Mushroom_Top_001_OCC_ROUGH_METAL.jpg";

interface IMaterialMap { [key: string]: PBRMaterial }

interface ITextureMap { [key: string]: { [key: string]: Texture } }

interface IPBRMaterialFactoryOptions {
    isDynamic?: boolean,
    pScale?: number,
    uScale?: number,
    vScale?: number,
}

export enum PBREnum {
    Metal_Plate_41,
    Metal_Plate_15,
    Mushroom_Top_001,
}

export default class PBRMaterialFactory {
    private readonly scene: Scene = null;

    private materialCache: IMaterialMap = {};

    private textureCache: ITextureMap = {};

    public constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Returns the specified PBR texture
     */
    public create = (type: PBREnum, opts: IPBRMaterialFactoryOptions = {}): PBRMaterial => {
        const {
            isDynamic = false,
            pScale = 0.1,
        } = opts;
        opts.uScale = opts.uScale || 1;
        opts.vScale = opts.vScale || 1;
        
        const cacheKey = `${type}_${opts.uScale}_${opts.vScale}`;
        
        if (!this.materialCache[cacheKey]) {
            const mat = new PBRMaterial(PBREnum[type] + cacheKey, this.scene);
            this.setTextures(type, mat, opts);
            mat.useParallax = true;
            mat.parallaxScaleBias = pScale;
            if (!isDynamic) mat.freeze();
            this.materialCache[cacheKey] = mat;
        }
        return this.materialCache[cacheKey];
    }

    /**
     * Sets the PBR textures of a material (mutative)
     */
    private setTextures = (type: PBREnum, material: PBRMaterial, opts: IPBRMaterialFactoryOptions): void => {
        let albedoSrc = null, bumpSrc = null, metallicSrc = null;
        switch (type) {
            case PBREnum.Metal_Plate_41:
                albedoSrc = basecolorTxr2;
                bumpSrc = normalDisplacementTxr2;
                metallicSrc = metallicRoughnessAoTxr2;
                break;
            case PBREnum.Mushroom_Top_001:
                albedoSrc = basecolorTxr3;
                bumpSrc = normalDisplacementTxr3;
                metallicSrc = metallicRoughnessAoTxr3;
                break;
            case PBREnum.Metal_Plate_15:
            default:
                albedoSrc = basecolorTxr;
                bumpSrc = normalDisplacementTxr;
                metallicSrc = metallicRoughnessAoTxr;
                break;
        }

        const { uScale = 1, vScale = 1 } = opts;
        
        const albedoTexture = new Texture(albedoSrc, this.scene);
        const bumpTexture = new Texture(bumpSrc, this.scene);
        const metallicTexture = new Texture(metallicSrc, this.scene);

        albedoTexture.uScale = uScale;
        albedoTexture.vScale = vScale;
        bumpTexture.uScale = uScale;
        bumpTexture.vScale = vScale;
        metallicTexture.uScale = uScale;
        metallicTexture.vScale = vScale;

        material.albedoTexture = albedoTexture;
        material.bumpTexture = bumpTexture;
        material.metallicTexture = metallicTexture;
        material.useRoughnessFromMetallicTextureAlpha = false;
        material.useMetallnessFromMetallicTextureBlue = true;
        material.useRoughnessFromMetallicTextureGreen = true;
        material.useAmbientOcclusionFromMetallicTextureRed = true;
    }
}
