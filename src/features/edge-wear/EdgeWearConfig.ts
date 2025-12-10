export interface EdgeWearConfig {
  enable?: boolean;
  intensity?: number;
  threshold?: number;
  falloff?: number;
  sharpness?: number;
  useNoise?: boolean;
  color?: { r: number; g: number; b: number };
  affectsMaterial?: boolean;
  roughness?: number;
  metalness?: number;
  wearPattern?: 'curvature' | 'ambient_occlusion' | 'world_space' | 'combined';
  curvatureMethod?: 'normal' | 'position' | 'simplified' | 'world' | 'laplace';
}
