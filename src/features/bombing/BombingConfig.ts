export interface BombingConfig {
  enable?: boolean;
  mode?: 'voronoi' | 'hex';
  blend?: number;
  rotation?: boolean;
  offset?: boolean;
  heightBlend?: boolean;
  normalCorrection?: boolean;
  scaleJitter?: number;
}
