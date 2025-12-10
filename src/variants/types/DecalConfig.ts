import { Euler, Vector3 } from "three";
import { LayerConfig } from "../../types";

export interface DecalConfig {
  id: string;
  position: Vector3;
  rotation: Euler;
  size: Vector3;
  layer: LayerConfig;
  priority: number;
  lifetime?: number;
  fadeStartTime?: number;
  projection?: 'planar' | 'box' | 'sphere'; // Added projection type
}

export interface DamageConfig {
  id: string;
  type: 'scratch' | 'dent' | 'bullet' | 'crack' | 'corrosion';
  intensity: number;
  position: Vector3;
  radius: number;
  layer: LayerConfig;
  permanent: boolean;
  healRate?: number;
  direction?: Vector3; // For directional damage (scratches)
}

export interface DecalDamageSystemConfig {
  maxDecals?: number;
  maxDamages?: number; // Added max damages
  decalFadeTime?: number;
  damageHealRate?: number;
  useWorldSpace?: boolean;
  enableAtlas?: boolean; // Texture atlas optimization
}
