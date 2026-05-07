import { Texture } from "three";
import { MaskChannel } from "../types/LayerConfig";
import { NoiseConfig } from "../features/noise/NoiseConfig";

export interface MaskConfig extends NoiseConfig {
  map?: Texture;
  channel?: MaskChannel;
  /** When set, mask texture is sampled with this TSL UV node instead of mesh `uv()` (e.g. terrain global UV). */
  sampleUV?: any;
  invert?: boolean;

  // Slope-based
  useSlope?: boolean;
  slopeMin?: number;
  slopeMax?: number;

  // Height-based
  useHeight?: boolean;
  heightMin?: number;
  heightMax?: number;

  // Dynamic
  opacityMultiplier?: number;
  constantOpacity?: number;
}
