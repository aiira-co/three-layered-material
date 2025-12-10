export interface NoiseConfig {
  useNoise?: boolean;
  noiseType?: 'perlin' | 'voronoi' | 'fbm';
  noiseScale?: number;
  noiseOctaves?: number;
  noisePersistence?: number;
  noiseThreshold?: number;
}
