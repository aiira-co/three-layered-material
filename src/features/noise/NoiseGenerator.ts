import { Node } from "three/webgpu";
import {
  float,
  vec2,
  vec3,
  floor,
  fract,
  dot,
  mix,
  smoothstep,
  max as tslMax,
  abs
} from "three/tsl";
import { NoiseConfig } from "./NoiseConfig";

/**
 * Generates procedural noise for masking and texture variation
 * Supports Perlin, Voronoi, and FBM noise types
 */
export class NoiseGenerator {
  /**
   * Generate noise based on configuration
   * @param uv - UV coordinates
   * @param config - Noise configuration
   * @returns Noise value (0-1)
   */
  generate(uv: Node, config: NoiseConfig): Node {
    if (!config.useNoise) {
      return float(1.0);
    }

    const scale = float(config.noiseScale || 1.0);
    const scaledUV = uv.mul(scale);

    let noise: Node;

    switch (config.noiseType) {
      case 'voronoi':
        noise = this.voronoiNoise(scaledUV, config.noiseOctaves || 1);
        break;

      case 'fbm':
        noise = this.fbmNoise(
          scaledUV,
          config.noiseOctaves || 4,
          config.noisePersistence || 0.5
        );
        break;

      default: // 'perlin'
        noise = this.perlinNoise(scaledUV, config.noiseOctaves || 1);
    }

    // Apply threshold if specified
    if (config.noiseThreshold !== undefined) {
      const threshold = float(config.noiseThreshold);
      noise = smoothstep(threshold.sub(0.1), threshold.add(0.1), noise);
    }

    return noise;
  }

  /**
   * Perlin-like noise using hash-based gradients
   */
  private perlinNoise(uv: Node, octaves: number = 1): Node {
    if (octaves === 1) {
      return this.perlinOctave(uv);
    }

    // Multi-octave perlin
    let value: Node = float(0.0);
    let amplitude: Node = float(1.0);
    let frequency: Node = float(1.0);
    let maxValue: Node = float(0.0);

    for (let i = 0; i < octaves; i++) {
      value = value.add(this.perlinOctave(uv.mul(frequency)).mul(amplitude));
      maxValue = maxValue.add(amplitude);
      amplitude = amplitude.mul(0.5);
      frequency = frequency.mul(2.0);
    }

    return value.div(maxValue);
  }

  private perlinOctave(uv: Node): Node {
    const i = floor(uv);
    const f = fract(uv);

    // Get corner values using hash
    const a = this.hash2D(i);
    const b = this.hash2D(i.add(vec2(1.0, 0.0)));
    const c = this.hash2D(i.add(vec2(0.0, 1.0)));
    const d = this.hash2D(i.add(vec2(1.0, 1.0)));

    // Smooth interpolation (quintic curve)
    const u = f.mul(f).mul(f.mul(f.mul(6.0).sub(15.0)).add(10.0));

    // Bilinear interpolation
    return mix(
      mix(a.x, b.x, u.x),
      mix(c.x, d.x, u.x),
      u.y
    );
  }

  /**
   * Fractional Brownian Motion - layered noise for natural patterns
   */
  fbmNoise(uv: Node, octaves: number, persistence: number): Node {
    let value: Node = float(0.0);
    let amplitude: Node = float(1.0);
    let frequency: Node = float(1.0);
    let maxValue: Node = float(0.0);

    for (let i = 0; i < octaves; i++) {
      value = value.add(this.perlinOctave(uv.mul(frequency)).mul(amplitude));
      maxValue = maxValue.add(amplitude);
      amplitude = amplitude.mul(persistence);
      frequency = frequency.mul(2.0);
    }

    return value.div(maxValue);
  }

  /**
   * Voronoi (cellular) noise - creates cell-like patterns
   */
  voronoiNoise(uv: Node, octaves: number): Node {
    const iuv = floor(uv);
    const fuv = fract(uv);

    let minDist: Node = float(10.0);

    // Check 3x3 grid of neighboring cells
    for (let y = -1; y <= 1; y++) {
      for (let x = -1; x <= 1; x++) {
        const neighbor = vec2(float(x), float(y));
        const point = this.hash2D(iuv.add(neighbor)).xy;
        const diff = neighbor.add(point).sub(fuv);
        const dist = diff.dot(diff);
        minDist = minDist.min(dist);
      }
    }

    // Return inverted distance for ridges
    return float(1.0).sub(minDist.sqrt());
  }

  /**
   * 2D hash function for pseudo-random values
   * Returns vec3 of random values in [0,1]
   */
  private hash2D(p: Node): Node {
    const p3 = fract(vec3(p.xyx).mul(vec3(0.1031, 0.1030, 0.0973)));
    const dp = dot(p3, vec3(p3.y, p3.z, p3.x).add(33.33));
    return fract(vec3(dp, dp, dp).mul(vec3(p3.x, p3.y, p3.z).add(p3.yxz)));
  }

  /**
   * Turbulence - absolute value FBM for marble-like patterns
   */
  turbulence(uv: Node, octaves: number, persistence: number = 0.5): Node {
    let value: Node = float(0.0);
    let amplitude: Node = float(1.0);
    let frequency: Node = float(1.0);

    for (let i = 0; i < octaves; i++) {
      const noise = this.perlinOctave(uv.mul(frequency));
      value = value.add(abs(noise).mul(amplitude));
      amplitude = amplitude.mul(persistence);
      frequency = frequency.mul(2.0);
    }

    return value;
  }

  /**
   * Domain warping - distort UV coordinates with noise
   */
  domainWarp(uv: Node, strength: number = 1.0): Node {
    const warp1 = this.fbmNoise(uv, 3, 0.5);
    const warp2 = this.fbmNoise(uv.add(vec2(5.2, 1.3)), 3, 0.5);
    return uv.add(vec2(warp1, warp2).mul(strength));
  }
}
