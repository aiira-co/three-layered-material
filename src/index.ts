// Main class
export { LayeredMaterial } from './LayeredMaterial';

// Core module
export { LayerBlender, MaskGenerator, MaterialSampler } from './core';
export type { MaskConfig } from './core';

// Blending module
export { ColorBlender, NormalBlender, ScalarBlender } from './blending';
export type { BlendModeConfig } from './blending';

// Extension module
export {
    BlendTexture,
    CustomPhysicalNodeMaterial,
    EdgeWear,
    GenericMethods,
    Noise
} from './extension';

// Input module
export { DefaultLayerFactory, MaterialExtractor, TextureSampler } from './input';

// Types - export explicitly to avoid conflicts with interface module
export type { LayerConfig, LayerData, LayeredMaterialOptions, MaskChannel, NodeMaterialInput } from './types';

// Feature configs
export type { TriplanarConfig } from './features/triplanar/TriplanarConfig';
export type { BombingConfig } from './features/bombing/BombingConfig';
export type { ParallaxConfig } from './features/parallax/ParallaxConfig';
export type { EdgeWearConfig } from './features/edge-wear/EdgeWearConfig';
export type { NoiseConfig } from './features/noise/NoiseConfig';

// Variants
export { MaterialVariant, ObservableLayeredMaterial, ObservableMaterialVariant } from './variants';
export { DynamicLayeredMaterial } from './variants/DynamicLayeredMaterial';
export { UniformDynamicMaterial } from './variants/UniformDynamicMaterial';
export { DecalLayeredMaterial } from './variants/DecalLayeredMaterial';
export type { DecalConfig, DamageConfig, DecalDamageSystemConfig } from './variants/types/DecalConfig';

// Utils
export * from './utils';

// Terrain integration
export { LayeredTerrainMaterialProvider } from './terrain';
export type { LayeredTerrainConfig, TerrainContext, TerrainProviderInterface } from './terrain';

