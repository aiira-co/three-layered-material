export interface ParallaxConfig {
  enable?: boolean;
  scale?: number;
  steps?: number;
  maxOffset?: number;
  method?: 'pom' | 'web-optimized' | 'simple';
  quality?: 'low' | 'medium' | 'high';
}
