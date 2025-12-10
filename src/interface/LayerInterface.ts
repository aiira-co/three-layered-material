import { Texture, Vector3 } from "three";
import { BlendModeConfig } from "./BlendModeConfigInterface";
import { MeshBasicNodeMaterial, MeshPhysicalNodeMaterial, MeshStandardNodeMaterial, Node } from "three/webgpu";


// Type definitions
export type MaskChannel = 'r' | 'g' | 'b' | 'a' | 'x' | 'y' | 'z' | 'w';

export type NodeMaterialInput =
  | MeshPhysicalNodeMaterial
  | MeshStandardNodeMaterial
  | MeshBasicNodeMaterial;

export interface LayerConfig {
  name?: string;

  // OPTION 1: Provide a pre-built material (highest priority)
  materialInput?: NodeMaterialInput;

  // OPTION 2: Provide textures/colors (most common)
  // Texture maps
  map: {
    color?: Texture | Vector3; // Can be a solid color (Vector3) or a texture
    normal?: Texture;
    roughness?: Texture;
    metalness?: Texture;
    ao?: Texture;
    height?: Texture;
    arm?: Texture; // Ambient Occlusion, Roughness, and Metallic

  }

  // Material properties (fallback when no map)
  color?: Vector3;
  roughness?: number;
  metalness?: number;

  scale?: number;

  // Material input transformations (only applied to materialInput)
  materialTransform?: {
    overrideScale?: boolean; // Whether to override material's UV scale
    extractTextures?: boolean; // Try to extract textures from material
    respectMaterialSettings?: boolean; // Preserve material's own settings
  };

  // Edge wear
  edgeWear: {
    enable?: boolean;
    intensity?: number;
    threshold?: number;
    falloff?: number;
    sharpness?: number;
    useNoise?: boolean;
    color?: { r: number; g: number; b: number }; // RGB color for worn edges
    affectsMaterial?: boolean; // Whether to change roughness/metalness
    roughness?: number; // Roughness at worn edges
    metalness?: number; // Metalness at worn edges
    wearPattern?: 'curvature' | 'ambient_occlusion' | 'world_space' | 'combined';
    curvatureMethod?: 'normal' | 'position' | 'simplified' | 'world' | 'laplace';

  }


  // Triplanar mapping
  triplanar: {
    enable?: boolean;
    useWorldPosition?: boolean;
  }

  // Texture Bombing (Stochastic Sampling)
  textureBombing: {
    enable?: boolean;
    blend?: number; // 0-1, how much to blend between samples (default 0.5)
  }

  // Masking options
  mask: {
    map?: Texture;
    channel?: MaskChannel;
    invert?: boolean;
    // Slope-based masking
    useSlope?: boolean;
    slopeMin?: number;
    slopeMax?: number;

    // Height-based masking (world space)
    useHeight?: boolean;
    heightMin?: number;
    heightMax?: number;

    // Noise options for mask variation
    useNoise?: boolean;
    noiseType?: 'perlin' | 'voronoi' | 'fbm';
    noiseScale?: number;
    noiseOctaves?: number;
    noisePersistence?: number;
    noiseThreshold?: number;

    // for dynamic material
    opacityMultiplier?: number;
    constantOpacity?: number;

  }

  // Blending options
  heightBlend?: {
    enable?: boolean;
    strength?: number; // How strongly height difference affects blending
    sharpness?: number; // Sharpness of height-based blend
  }

  parallax?: {
    enable?: boolean;
    scale?: number;
    steps?: number;
    maxOffset?: number;
    method?: 'pom' | 'web-optimized' | 'simple';
    quality?: 'low' | 'medium' | 'high';
  }

  blendMode?: BlendModeConfig
}

export interface LayeredMaterialOptions {
  layers?: LayerConfig[];
  blendSharpness?: number;
}

export interface LayerData {
  color: Node;
  normal: Node;
  roughness: Node;
  metalness: Node;
  ao: Node;
  height?: Node;
}
