export interface ParallaxConfig {
  enable?: boolean;
  scale?: number;
  steps?: number;
  maxOffset?: number;
  method?: 'pom' | 'steep' | 'simple';
  quality?: 'low' | 'medium' | 'high';
}
