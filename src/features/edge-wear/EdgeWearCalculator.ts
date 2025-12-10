import { Node } from "three/webgpu";
import {
  float,
  vec3,
  dot,
  pow,
  saturate,
  smoothstep,
  mix,
  normalWorld,
  positionWorld,
  abs as tslAbs,
  fract
} from "three/tsl";
import { EdgeWearConfig } from "./EdgeWearConfig";
import { LayerData } from "../../types";

/**
 * Calculates edge wear effects for realistic weathering
 * Supports multiple wear patterns and curvature detection methods
 */
export class EdgeWearCalculator {
  /**
   * Apply edge wear to layer data
   */
  apply(data: LayerData, config: EdgeWearConfig): LayerData {
    const mask = this.calculateWearMask(data.normal, config);

    const exposedColor = config.color
      ? vec3(config.color.r, config.color.g, config.color.b)
      : vec3(0.7, 0.6, 0.5);

    const wornColor = mix(data.color, exposedColor, mask);

    if (config.affectsMaterial) {
      return {
        ...data,
        color: wornColor,
        roughness: mix(data.roughness, float(config.roughness || 0.3), mask),
        metalness: mix(data.metalness, float(config.metalness || 0.8), mask)
      };
    }

    return {
      ...data,
      color: wornColor
    };
  }

  /**
   * Calculate wear mask based on configuration
   */
  private calculateWearMask(normal: Node, config: EdgeWearConfig): Node {
    const {
      intensity = 1.0,
      threshold = 0.1,
      falloff = 0.3,
      sharpness = 2.0,
      wearPattern = 'curvature',
      curvatureMethod = 'normal'
    } = config;

    let mask: Node;

    switch (wearPattern) {
      case 'ambient_occlusion':
        mask = this.ambientOcclusionWear();
        break;

      case 'world_space':
        mask = this.worldSpaceWear();
        break;

      case 'combined':
        mask = this.combinedWear(normal, curvatureMethod);
        break;

      default: // 'curvature'
        mask = this.curvatureWear(normal, curvatureMethod);
    }

    // Apply threshold and falloff
    mask = smoothstep(float(threshold), float(threshold + falloff), mask.mul(intensity));

    // Non-linear shaping
    mask = pow(mask, float(sharpness));

    // Add noise variation if enabled
    if (config.useNoise) {
      mask = this.addNoiseVariation(mask);
    }

    return saturate(mask);
  }

  /**
   * Curvature-based wear
   */
  private curvatureWear(normal: Node, method: string): Node {
    switch (method) {
      case 'position':
        return this.positionCurvature();

      case 'simplified':
        return this.simplifiedCurvature(normal);

      case 'world':
        return this.worldNormalCurvature();

      case 'laplace':
        return this.laplaceCurvature();

      default: // 'normal'
        return this.normalDerivativeCurvature(normal);
    }
  }

  private normalDerivativeCurvature(normal: Node): Node {
    const dX = normal.dFdx();
    const dY = normal.dFdy();
    return dX.dot(dX).add(dY.dot(dY)).sqrt();
  }

  private positionCurvature(): Node {
    const worldPos = positionWorld;
    const d2pdx2 = worldPos.dFdx().dFdx();
    const d2pdy2 = worldPos.dFdy().dFdy();
    return d2pdx2.dot(d2pdx2).add(d2pdy2.dot(d2pdy2)).sqrt().mul(0.1);
  }

  private simplifiedCurvature(normal: Node): Node {
    const normalZ = normal.z;
    const dZdx = normalZ.dFdx();
    const dZdy = normalZ.dFdy();
    return dZdx.mul(dZdx).add(dZdy.mul(dZdy)).sqrt().mul(2.0);
  }

  private worldNormalCurvature(): Node {
    const dX = normalWorld.dFdx();
    const dY = normalWorld.dFdy();
    return dX.dot(dX).add(dY.dot(dY)).sqrt();
  }

  private laplaceCurvature(): Node {
    const worldPos = positionWorld;
    const dx = worldPos.dFdx();
    const dy = worldPos.dFdy();
    const dxx = dx.dFdx();
    const dyy = dy.dFdy();
    return dxx.dot(dxx).add(dyy.dot(dyy)).sqrt().mul(0.05);
  }

  /**
   * Ambient occlusion-based wear
   */
  private ambientOcclusionWear(): Node {
    // Simple approximation using world normal
    const upward = dot(normalWorld, vec3(0, 1, 0)).oneMinus();
    return upward.pow(2.0);
  }

  /**
   * World-space positional wear
   */
  private worldSpaceWear(): Node {
    const worldNorm = normalWorld;
    const worldPos = positionWorld;

    // Bottom-facing surfaces wear more
    const upWear = dot(worldNorm, vec3(0, 1, 0)).oneMinus();

    // Surfaces facing dominant wind/weather direction
    const windDir = vec3(1, 0, 0);
    const windWear = dot(worldNorm, windDir).abs();

    // Height-based wear (higher = more exposed)
    const heightWear = saturate(worldPos.y.mul(0.1));

    return upWear.mul(0.5).add(windWear.mul(0.3)).add(heightWear.mul(0.2));
  }

  /**
   * Combined wear patterns for most realistic results
   */
  private combinedWear(normal: Node, curvatureMethod: string): Node {
    const curvature = this.curvatureWear(normal, curvatureMethod);
    const ao = this.ambientOcclusionWear();
    const worldSpace = this.worldSpaceWear();

    // Weighted combination
    return curvature.mul(0.5).add(ao.mul(0.3)).add(worldSpace.mul(0.2));
  }

  /**
   * Add noise variation to wear mask
   */
  private addNoiseVariation(mask: Node): Node {
    // Use position-based noise for consistency
    const noiseUV = positionWorld.xz.mul(10.0);
    const noise = this.fbmNoise(noiseUV, 3, 0.5);

    // Vary mask by 60-100%
    return mask.mul(noise.mul(0.4).add(0.6));
  }

  /**
   * Simple FBM noise for variation
   */
  private fbmNoise(uv: Node, octaves: number, persistence: number): Node {
    // Simplified noise - in production, use NoiseGenerator
    const hash = this.hash2D(uv);
    return hash.x.mul(0.5).add(0.5);
  }

  private hash2D(p: Node): Node {
    const p3 = fract(vec3(p.xyx).mul(vec3(0.1031, 0.1030, 0.0973)));
    const dp = dot(p3, vec3(p3.y, p3.z, p3.x).add(33.33));
    return fract(vec3(dp, dp, dp).mul(vec3(p3.x, p3.y, p3.z).add(p3.yxz)));
  }

  /**
   * Calculate wear intensity based on surface properties
   * Rougher, non-metallic surfaces wear more
   */
  calculateWearIntensity(
    roughness: Node,
    metalness: Node,
    ao: Node
  ): Node {
    // Rough surfaces wear more
    const roughnessFactor = roughness.mul(1.5);

    // Non-metals wear more
    const metalnessFactor = float(1.0).sub(metalness);

    // Occluded areas wear less (protected)
    const aoFactor = ao;

    return saturate(roughnessFactor.mul(metalnessFactor).mul(aoFactor));
  }
}
