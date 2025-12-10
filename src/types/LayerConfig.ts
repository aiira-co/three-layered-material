import { Texture, Vector3 } from "three";
import { MeshPhysicalNodeMaterial } from "three/webgpu";
import { BlendModeConfig } from "./../blending/BlendModeConfig";
import { TriplanarConfig } from "../features/triplanar/TriplanarConfig";
import { BombingConfig } from "../features/bombing/BombingConfig";
import { ParallaxConfig } from "../features/parallax/ParallaxConfig";
import { EdgeWearConfig } from "../features/edge-wear/EdgeWearConfig";
import { MaskConfig } from "./../core/MaskConfig";

export type MaskChannel = 'r' | 'g' | 'b' | 'a' | 'x' | 'y' | 'z' | 'w';

export type NodeMaterialInput = MeshPhysicalNodeMaterial;

export interface MaterialTransformConfig {
  extractTextures?: boolean;
  overrideScale?: boolean;
  respectMaterialSettings?: boolean;
}

export interface LayerTextureMap {
  color?: Texture | Vector3;
  normal?: Texture;
  roughness?: Texture;
  metalness?: Texture;
  ao?: Texture;
  height?: Texture;
  arm?: Texture;
}

export interface HeightBlendConfig {
  enable?: boolean;
  strength?: number;
  sharpness?: number;
}

export interface LayerConfig {
  name?: string;

  // Input sources (priority: materialInput > map > color)
  materialInput?: NodeMaterialInput;
  map?: LayerTextureMap;
  color?: Vector3;

  // Base properties
  scale?: number;
  roughness?: number;
  metalness?: number;

  // Material input options
  materialTransform?: MaterialTransformConfig;

  // Features
  triplanar?: TriplanarConfig;
  textureBombing?: BombingConfig;
  parallax?: ParallaxConfig;
  edgeWear?: EdgeWearConfig;
  mask?: MaskConfig;
  heightBlend?: HeightBlendConfig;
  blendMode?: BlendModeConfig;
}
