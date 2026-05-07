export interface ParallaxConfig {
  enable?: boolean;
  scale?: number;
  steps?: number;
  maxOffset?: number;
  method?: 'pom' | 'spom' | 'steep' | 'simple';
  quality?: 'low' | 'medium' | 'high';
  refinementSteps?: number;
  referencePlane?: number;
  minViewZ?: number;
  selfShadow?: boolean;
  horizonMask?: boolean;
  depthOffset?: boolean;
  shadowSteps?: number;
  shadowStrength?: number;
  horizonStrength?: number;
}
