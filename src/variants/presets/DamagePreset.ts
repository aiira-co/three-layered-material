import { Euler, Texture, Vector3 } from "three";
import { DamageConfig, DecalConfig } from "../types/DecalConfig";
import { LayerConfig } from "../../types";

/**
 * Factory functions for creating common damage and decal configurations.
 * Texture parameters must be provided by the caller.
 */

export interface DamageTextureSet {
  color?: Texture;
  normal?: Texture;
  roughness?: Texture;
  metalness?: Texture;
}

// Preset damage configurations
export const DamagePresets = {
  /**
   * Create a scratch damage configuration
   * @param position - World position of the scratch
   * @param intensity - Damage intensity (0-1)
   * @param textures - Optional textures for the scratch appearance
   */
  scratch: (
    position: Vector3,
    intensity: number,
    textures?: DamageTextureSet
  ): Omit<DamageConfig, 'id'> => ({
    type: 'scratch',
    intensity,
    position,
    radius: 0.05 + intensity * 0.1,
    permanent: intensity > 0.7,
    healRate: 0.01,
    layer: {
      map: textures ? {
        color: textures.color,
        normal: textures.normal,
        roughness: textures.roughness
      } : {},
      roughness: 0.8,
      metalness: 0.3
    } as LayerConfig
  }),

  /**
   * Create a bullet hole decal configuration
   * @param position - World position of the bullet hole
   * @param textures - Optional textures for the bullet hole appearance
   */
  bullet: (
    position: Vector3,
    textures?: DamageTextureSet
  ): Omit<DecalConfig, 'id'> => ({
    position,
    rotation: new Euler(0, Math.random() * Math.PI * 2, 0),
    size: new Vector3(0.08, 0.08, 0.08),
    priority: 3,
    lifetime: 120,
    layer: {
      map: textures ? {
        color: textures.color,
        normal: textures.normal,
        roughness: textures.roughness,
        metalness: textures.metalness
      } : {},
      roughness: 0.9,
      metalness: 0.8
    } as LayerConfig
  }),

  /**
   * Create a corrosion damage configuration
   * @param position - World position of the corrosion
   * @param intensity - Corrosion intensity (0-1)
   * @param textures - Optional textures for the corrosion appearance
   */
  corrosion: (
    position: Vector3,
    intensity: number,
    textures?: DamageTextureSet
  ): Omit<DamageConfig, 'id'> => ({
    type: 'corrosion',
    intensity,
    position,
    radius: 0.1 + intensity * 0.2,
    permanent: true,
    layer: {
      map: textures ? {
        color: textures.color,
        normal: textures.normal,
        roughness: textures.roughness
      } : {},
      roughness: 0.95,
      metalness: 0.1
    } as LayerConfig
  })
};

// Usage example:
// const scratchTextures = { color: scratchColorTex, normal: scratchNormalTex };
// material.addDamage(DamagePresets.scratch(new Vector3(1, 0, 0), 0.5, scratchTextures));
// material.addDecal(DamagePresets.bullet(new Vector3(0, 1, 0), bulletTextures));
