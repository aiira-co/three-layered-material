import { float, floor, fract, mix, smoothstep, vec2 } from "three/tsl";
import { Node } from "three/webgpu";
import { GenericMethods } from "./GenericMethods";
import { LayerConfig } from "../interface";

export class Noise extends GenericMethods {

  // Add noise generation methods
  protected generateNoise(uv: Node, config: LayerConfig['mask']): Node {
    if (!config.useNoise) return float(1.0);

    const scale = config.noiseScale || 1.0;
    const octaves = config.noiseOctaves || 4;
    const persistence = config.noisePersistence || 0.5;

    let noise: Node;

    switch (config.noiseType) {
      case 'voronoi':
        noise = this.voronoiNoise(uv.mul(scale), octaves);
        break;
      case 'fbm':
        noise = this.fbmNoise(uv.mul(scale), octaves, persistence);
        break;
      default: // perlin
        noise = this.perlinNoise(uv.mul(scale), octaves);
    }

    if (config.noiseThreshold) {
      return smoothstep(config.noiseThreshold - 0.1, config.noiseThreshold + 0.1, noise);
    }

    return noise;
  }

  protected fbmNoise(uv: Node, octaves: number, persistence: number): Node {
    let value: Node = float(0.0);
    let amplitude: Node = float(1.0);
    let frequency: Node = float(1.0);
    let maxValue: Node = float(0.0);

    for (let i = 0; i < octaves; i++) {
      value = value.add(this.perlinNoise(uv.mul(frequency)).mul(amplitude));
      maxValue = maxValue.add(amplitude);
      amplitude = amplitude.mul(persistence);
      frequency = frequency.mul(2.0);
    }

    return value.div(maxValue);
  }

  private perlinNoise(uv: Node, octaves: number = 1): Node {
    // Simplified Perlin-like noise using hash function
    const i = floor(uv);
    const f = fract(uv);
    const a = this.hash2D(i);
    const b = this.hash2D(i.add(vec2(1.0, 0.0)));
    const c = this.hash2D(i.add(vec2(0.0, 1.0)));
    const d = this.hash2D(i.add(vec2(1.0, 1.0)));

    const u = f.mul(f).mul(f.mul(f.mul(6.0).sub(15.0)).add(10.0)); // quintic curve
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  protected voronoiNoise(uv: Node, octaves: number): Node {
    // Basic Voronoi implementation
    const iuv = floor(uv);
    const fuv = fract(uv);

    let minDist: Node = float(10.0);

    for (let y = -1; y <= 1; y++) {
      for (let x = -1; x <= 1; x++) {
        const neighbor = vec2(float(x), float(y));
        const point = this.hash2D(iuv.add(neighbor));
        const diff = neighbor.add(point).sub(fuv);
        const dist = diff.dot(diff);
        minDist = minDist.min(dist); // Use min to find closest point
      }
    }

    // Return inverted distance for ridges (1 at cell centers, 0 at edges)
    return float(1.0).sub(minDist.sqrt());
  }
}
