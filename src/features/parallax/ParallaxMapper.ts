import { Texture } from "three/webgpu";
import {
  If,
  float,
  vec3,
  texture,
  cameraPosition,
  positionWorld,
  normalWorld,
  tangentWorld,
  mat3,
  mix,
  max as tslMax,
  select,
  saturate,
  parallaxDirection
} from "three/tsl";
import { ParallaxConfig } from "./ParallaxConfig";

type Node = any;

export interface ParallaxMappingResult {
  uv: Node;
  depthDelta: Node;
}

/**
 * Parallax Occlusion Mapping with proper height texture sampling
 * Supports simple offset and full POM with ray marching
 */
export class ParallaxMapper {
  /**
   * Apply parallax offset to UV coordinates
   * @param uv - Base UV coordinates
   * @param heightMap - Height texture to sample during ray marching
   * @param config - Parallax configuration
   * @param scale - Texture scale applied to UVs
   */
  apply(uv: Node, heightMap: Texture, config: ParallaxConfig, scale: number = 1): Node {
    return this.applyDetailed(uv, heightMap, config, scale).uv;
  }

  /**
   * Apply parallax and return auxiliary data for material/post effects.
   */
  applyDetailed(uv: Node, heightMap: Texture, config: ParallaxConfig, scale: number = 1): ParallaxMappingResult {
    if (!config.enable || !heightMap) {
      return { uv, depthDelta: float(0.0) };
    }

    switch (config.method) {
      case 'spom':
        return this.silhouetteParallaxOcclusionMapping(uv, heightMap, config, scale);

      case 'pom':
        return { uv: this.parallaxOcclusionMapping(uv, heightMap, config, scale), depthDelta: float(0.0) };

      case 'steep':
        return { uv: this.steepParallax(uv, heightMap, config, scale), depthDelta: float(0.0) };

      default:
        return { uv: this.simpleParallax(uv, heightMap, config, scale), depthDelta: float(0.0) };
    }
  }

  /**
   * Simple parallax - single offset based on height
   * Fast but low quality, good for subtle effects
   */
  private simpleParallax(uv: Node, heightMap: Texture, config: ParallaxConfig, scale: number): Node {
    const uvScale = float(Math.max(scale, 0.0001));
    const parallaxScale = float(config.scale || 0.05).div(uvScale);
    const maxOffset = float(config.maxOffset ?? 0.1).div(uvScale);
    const viewDir = this.getViewDirTangentSpace();
    const parallaxRay = this.computeClampedParallaxRay(viewDir, parallaxScale, maxOffset);

    // Sample height at current UV
    const height = texture(heightMap, uv).x;

    // Calculate and apply offset
    // Height of 0 = deepest, height of 1 = surface
    const heightOffset = float(1.0).sub(height);
    const parallaxOffset = parallaxRay.mul(heightOffset);

    return uv.sub(parallaxOffset);
  }

  /**
   * Steep Parallax Mapping - fixed step ray marching
   * Better quality than simple, cheaper than full POM
   */
  private steepParallax(uv: Node, heightMap: Texture, config: ParallaxConfig, scale: number): Node {
    const steps = config.steps || 8;
    const uvScale = float(Math.max(scale, 0.0001));
    const parallaxScale = float(config.scale || 0.05).div(uvScale);
    const maxOffset = float(config.maxOffset ?? 0.1).div(uvScale);

    const viewDir = this.getViewDirTangentSpace();
    const parallaxRay = this.computeClampedParallaxRay(viewDir, parallaxScale, maxOffset);

    // Calculate step parameters
    const numSteps = float(steps);
    const layerDepth = float(1.0).div(numSteps);
    const deltaTexCoords = parallaxRay.div(numSteps);

    // Start from UV and step inward
    let currentTexCoords: Node = uv;
    let previousTexCoords: Node = uv;
    let previousLayerDepth: Node = float(0.0);
    let previousDepthMapValue: Node = float(1.0).sub(texture(heightMap, uv).x);
    let currentLayerDepth: Node = float(0.0);
    let currentDepthMapValue: Node = previousDepthMapValue;
    let isFound: Node = float(0.0);

    // Ray march - unrolled loop for GPU compatibility
    for (let i = 0; i < steps; i++) {
      const canAdvance = isFound.equal(float(0.0));

      const nextTexCoords = currentTexCoords.sub(deltaTexCoords);
      const nextLayerDepth = currentLayerDepth.add(layerDepth);
      const nextDepthMapValue = float(1.0).sub(texture(heightMap, nextTexCoords).x);

      const intersection = nextLayerDepth.greaterThan(nextDepthMapValue).and(canAdvance);

      previousTexCoords = select(intersection, currentTexCoords, previousTexCoords);
      previousLayerDepth = select(intersection, currentLayerDepth, previousLayerDepth);
      previousDepthMapValue = select(intersection, currentDepthMapValue, previousDepthMapValue);

      currentTexCoords = select(canAdvance, nextTexCoords, currentTexCoords);
      currentLayerDepth = select(canAdvance, nextLayerDepth, currentLayerDepth);
      currentDepthMapValue = select(canAdvance, nextDepthMapValue, currentDepthMapValue);
      isFound = select(intersection, float(1.0), isFound);
    }

    const after = currentDepthMapValue.sub(currentLayerDepth);
    const before = previousDepthMapValue.sub(previousLayerDepth);
    const denom = before.sub(after).abs().max(0.0001);
    const weight = saturate(before.div(denom));
    const refined = mix(currentTexCoords, previousTexCoords, weight);

    return select(isFound.equal(float(1.0)), refined, currentTexCoords);
  }

  /**
   * Parallax Occlusion Mapping - full quality with binary search refinement
   * Expensive but highest quality
   */
  private parallaxOcclusionMapping(uv: Node, heightMap: Texture, config: ParallaxConfig, scale: number): Node {
    const steps = config.steps || 16;
    const uvScale = float(Math.max(scale, 0.0001));
    const parallaxScale = float(config.scale || 0.1).div(uvScale);
    const maxOffset = float(config.maxOffset ?? 0.15).div(uvScale);

    const viewDir = this.getViewDirTangentSpace();
    const parallaxRay = this.computeClampedParallaxRay(viewDir, parallaxScale, maxOffset);

    // Adaptive step count based on view angle
    // More steps at grazing angles
    const numSteps = float(steps);
    const layerDepth = float(1.0).div(numSteps);

    // Calculate UV offset per step.
    const deltaTexCoords = parallaxRay.div(numSteps);

    // Initialize ray march
    let currentTexCoords: Node = uv;
    let prevTexCoords: Node = uv;
    let currentLayerDepth: Node = float(0.0);
    let prevLayerDepth: Node = float(0.0);

    // Depth map in "distance from surface" space (0 = surface, 1 = deep).
    let currentDepthMapValue: Node = float(1.0).sub(texture(heightMap, uv).x);
    let prevDepthMapValue: Node = currentDepthMapValue;
    let isFound: Node = float(0.0);

    // Ray march through the height field with first-hit tracking.
    for (let i = 0; i < steps; i++) {
      const canAdvance = isFound.equal(float(0.0));

      const nextTexCoords = currentTexCoords.sub(deltaTexCoords);
      const nextLayerDepth = currentLayerDepth.add(layerDepth);
      const nextDepthMapValue = float(1.0).sub(texture(heightMap, nextTexCoords).x);

      const intersection = nextLayerDepth.greaterThan(nextDepthMapValue).and(canAdvance);

      prevTexCoords = select(intersection, currentTexCoords, prevTexCoords);
      prevLayerDepth = select(intersection, currentLayerDepth, prevLayerDepth);
      prevDepthMapValue = select(intersection, currentDepthMapValue, prevDepthMapValue);

      currentTexCoords = select(canAdvance, nextTexCoords, currentTexCoords);
      currentLayerDepth = select(canAdvance, nextLayerDepth, currentLayerDepth);
      currentDepthMapValue = select(canAdvance, nextDepthMapValue, currentDepthMapValue);
      isFound = select(intersection, float(1.0), isFound);
    }

    // Linear interpolation for accuracy
    // Find where the ray actually intersected the surface
    const afterDepth = currentDepthMapValue.sub(currentLayerDepth);
    const beforeDepth = prevDepthMapValue.sub(prevLayerDepth);

    // Interpolation weight
    const denom = beforeDepth.sub(afterDepth).abs().max(0.0001);
    const weight = saturate(beforeDepth.div(denom));

    // Interpolate texture coordinates
    const finalTexCoords = mix(currentTexCoords, prevTexCoords, weight);

    return select(isFound.equal(float(1.0)), finalTexCoords, currentTexCoords);
  }

  /**
   * Silhouette-friendly POM variant with guarded binary refinement.
   * Uses depth = 1 - height so white height values represent high surface hits.
   */
  private silhouetteParallaxOcclusionMapping(
    uv: Node,
    heightMap: Texture,
    config: ParallaxConfig,
    scale: number
  ): ParallaxMappingResult {
    const steps = config.steps || this.resolveQualitySteps(config);
    const refinementSteps = config.refinementSteps ?? 5;
    const referencePlane = config.referencePlane ?? 0.5;
    const minViewZ = config.minViewZ ?? 0.08;
    const uvScale = float(Math.max(scale, 0.0001));
    const parallaxScale = float(config.scale || 0.1).div(uvScale);
    const maxOffset = float(config.maxOffset ?? 0.15).div(uvScale);

    const viewDir = this.getViewDirTangentSpace();
    const parallaxRay = this.computeClampedParallaxRay(viewDir, parallaxScale, maxOffset, minViewZ);
    const layerDepth = float(1.0 / steps);
    const deltaTexCoords = parallaxRay.mul(layerDepth);

    const currentTexCoords = uv.add(parallaxRay.mul(float(referencePlane))).toVar();
    const currentLayerDepth = float(0.0).toVar();
    const sampledDepth = float(1.0).sub(texture(heightMap, currentTexCoords).x).toVar();

    for (let i = 0; i < steps; i++) {
      If(currentLayerDepth.lessThan(sampledDepth), () => {
        currentTexCoords.subAssign(deltaTexCoords);
        currentLayerDepth.addAssign(layerDepth);
        sampledDepth.assign(float(1.0).sub(texture(heightMap, currentTexCoords).x));
      });
    }

    this.binaryRefine(
      currentTexCoords,
      currentLayerDepth,
      deltaTexCoords,
      layerDepth,
      heightMap,
      refinementSteps
    );

    return {
      uv: currentTexCoords,
      depthDelta: currentLayerDepth.mul(parallaxScale)
    };
  }

  private binaryRefine(
    currentUv: Node,
    currentLayerDepth: Node,
    deltaUv: Node,
    layerDepth: Node,
    heightMap: Texture,
    refinementSteps: number
  ): void {
    const hasAdvanced = currentLayerDepth.greaterThan(float(0.0));

    If(hasAdvanced, () => {
      currentUv.addAssign(deltaUv);
      currentLayerDepth.subAssign(layerDepth);
    });

    const halfDelta = deltaUv.mul(float(0.5)).toVar();
    const halfDepth = layerDepth.mul(float(0.5)).toVar();

    for (let i = 0; i < refinementSteps; i++) {
      If(hasAdvanced, () => {
        currentUv.subAssign(halfDelta);
        currentLayerDepth.addAssign(halfDepth);

        const refinedDepth = float(1.0).sub(texture(heightMap, currentUv).x);

        If(currentLayerDepth.greaterThan(refinedDepth), () => {
          currentUv.addAssign(halfDelta);
          currentLayerDepth.subAssign(halfDepth);
        });

        halfDelta.mulAssign(float(0.5));
        halfDepth.mulAssign(float(0.5));
      });
    }
  }

  /**
   * Get view direction in tangent space
   */
  private getViewDirTangentSpace(): Node {
    if (parallaxDirection) {
      return (parallaxDirection as any).normalize();
    }

    // View direction in world space (from surface to camera)
    const viewDirWorld = cameraPosition.sub(positionWorld).normalize();

    // Construct TBN matrix
    const normal = normalWorld.normalize();
    const tangent = tangentWorld.normalize();
    const bitangent = normal.cross(tangent).normalize();

    // Build tangent-space matrix
    const TBN = mat3(tangent, bitangent, normal);

    // Transform view direction to tangent space
    const worldToTangent = TBN.transpose();
    const viewDirTangent = worldToTangent.mul(vec3(viewDirWorld)).normalize();
    return vec3(viewDirTangent.x, viewDirTangent.y, viewDirTangent.z.abs()).normalize();
  }

  /**
   * Compute a tangent-space parallax ray with max offset clamping.
   */
  private computeClampedParallaxRay(viewDir: Node, parallaxScale: Node, maxOffset: Node, minViewZ = 0.001): Node {
    const viewZ = tslMax(viewDir.z.abs(), float(minViewZ));
    const ray = viewDir.xy.div(viewZ).mul(parallaxScale);
    const rayLength = ray.length();
    const clampFactor = maxOffset.div(rayLength.max(0.0001)).min(1.0);
    return ray.mul(clampFactor);
  }

  private resolveQualitySteps(config: ParallaxConfig): number {
    switch (config.quality) {
      case 'high':
        return 56;
      case 'medium':
        return 32;
      case 'low':
      default:
        return 16;
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use apply() with heightMap texture instead
   */
  applyLegacy(uv: Node, height: Node, config: ParallaxConfig): Node {
    if (!config.enable) {
      return uv;
    }

    const scale = float(config.scale || 0.05);
    const viewDir = this.getViewDirTangentSpace();
    const viewZ = tslMax(viewDir.z, float(0.1));

    const heightOffset = float(1.0).sub(height);
    const parallaxOffset = viewDir.xy.mul(heightOffset.mul(scale)).div(viewZ);

    return uv.sub(parallaxOffset);
  }
}
