import { Node } from "three/webgpu";
import { LayerConfig } from "../types";
import { NoiseGenerator } from "../features/noise/NoiseGenerator";
import { float, saturate, smoothstep, dot, vec3, texture, uv, normalWorld, positionWorld } from "three/tsl";

export class MaskGenerator {
  private noiseGenerator: NoiseGenerator;

  constructor() {
    this.noiseGenerator = new NoiseGenerator();
  }

  generate(layer: LayerConfig): Node {
    let mask: Node = float(1.0);

    if (!layer.mask) return mask;

    // Texture mask
    if (layer.mask.map) {
      const channel = layer.mask.channel || 'r';
      mask = texture(layer.mask.map, uv())[channel];
    }

    // Slope mask
    if (layer.mask.useSlope) {
      const slope = dot(normalWorld, vec3(0, 1, 0));
      const slopeMask = smoothstep(
        float(layer.mask.slopeMin || 0),
        float(layer.mask.slopeMax || 1),
        slope
      );
      mask = mask.mul(slopeMask);
    }

    // Height mask
    if (layer.mask.useHeight) {
      const heightMask = smoothstep(
        float(layer.mask.heightMin || 0),
        float(layer.mask.heightMax || 10),
        positionWorld.y
      );
      mask = mask.mul(heightMask);
    }

    // Noise
    if (layer.mask.useNoise) {
      const noise = this.noiseGenerator.generate(uv(), layer.mask);
      mask = mask.mul(noise);
    }

    // Invert
    if (layer.mask.invert) {
      mask = float(1.0).sub(mask);
    }

    return saturate(mask);
  }
}
