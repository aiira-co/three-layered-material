import { Texture } from "three/webgpu";
import {
  Fn,
  Loop,
  If,
  Break,
  dFdx,
  dFdy,
  float,
  vec3,
  texture,
  cameraPosition,
  positionWorld,
  normalWorld,
  tangentWorld,
  mat3,
  max as tslMax,
  min as tslMin,
  length,
  parallaxDirection
} from "three/tsl";
import { ParallaxConfig } from "./ParallaxConfig";

type Node = any;

export interface ParallaxMappingResult {
  uv: Node;
  depthDelta: Node;
}

/**
 * Parallax Occlusion Mapping with proper height texture sampling.
 *
 * All ray-march paths use TSL `Loop` + `If` + `Break` + `.assign()` mutating
 * single VarNodes declared once outside the loop. The previous JS-unrolled
 * `select` chain produced one VarNode per JS step that referenced the
 * previous step's VarNode, and at higher quality (`steps >= 32`) that long
 * chain made Three's WGSL builder emit
 *   `nodeVarN = ( nodeVarM - /* Recursion detected. *\/ )`
 * fragments and refuse to compile the fragment shader. The Loop + assign
 * pattern (from Promontis' POM reference) avoids that entirely and emits a
 * real for-loop in the shader.
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
   * Simple parallax - single offset based on height.
   * Fast but low quality, good for subtle effects. No loop.
   */
  private simpleParallax(uv: Node, heightMap: Texture, config: ParallaxConfig, scale: number): Node {
    const uvScale = float(Math.max(scale, 0.0001));
    const parallaxScale = float(config.scale || 0.05).div(uvScale);
    const maxOffset = float(config.maxOffset ?? 0.1).div(uvScale);
    const viewDir = this.getViewDirTangentSpace();
    const parallaxRay = this.computeClampedParallaxRay(viewDir, parallaxScale, maxOffset);
    const sampleHeight = this.createHeightSampler(heightMap, uv);

    const height = sampleHeight(uv);
    // height of 0 = deepest, height of 1 = surface
    const heightOffset = float(1.0).sub(height);
    const parallaxOffset = parallaxRay.mul(heightOffset);

    return uv.sub(parallaxOffset);
  }

  /**
   * Steep Parallax Mapping - fixed step ray marching with height-aware early
   * exit. Single VarNode + Loop + If + Break.
   */
  private steepParallax(uv: Node, heightMap: Texture, config: ParallaxConfig, scale: number): Node {
    const steps = config.steps || 8;
    return Fn(() => {
      const uvScale = float(Math.max(scale, 0.0001));
      const parallaxScale = float(config.scale || 0.05).div(uvScale);
      const maxOffset = float(config.maxOffset ?? 0.1).div(uvScale);

      const viewDir = this.getViewDirTangentSpace();
      const parallaxRay = this.computeClampedParallaxRay(viewDir, parallaxScale, maxOffset).toVar();
      const sampleHeight = this.createHeightSampler(heightMap, uv);

      const numSteps = float(steps);
      const layerDepth = float(1.0).div(numSteps);
      const deltaUv = parallaxRay.div(numSteps).toVar();

      const currentUv = uv.toVar();
      const currentLayerDepth = float(0.0).toVar();
      const sampledDepth = float(1.0).sub(sampleHeight(currentUv)).toVar();

      Loop(steps, () => {
        If(currentLayerDepth.greaterThanEqual(sampledDepth), () => {
          Break();
        });
        currentUv.subAssign(deltaUv);
        currentLayerDepth.addAssign(layerDepth);
        sampledDepth.assign(float(1.0).sub(sampleHeight(currentUv)));
      });

      return currentUv;
    })();
  }

  /**
   * Parallax Occlusion Mapping - full quality with binary search refinement.
   * Single-VarNode + Loop pattern; no chained `select` VarNodes.
   */
  private parallaxOcclusionMapping(uv: Node, heightMap: Texture, config: ParallaxConfig, scale: number): Node {
    const steps = config.steps || 16;
    const refinementSteps = config.refinementSteps ?? 5;
    return Fn(() => {
      const uvScale = float(Math.max(scale, 0.0001));
      const parallaxScale = float(config.scale || 0.1).div(uvScale);
      const maxOffset = float(config.maxOffset ?? 0.15).div(uvScale);

      const viewDir = this.getViewDirTangentSpace();
      const parallaxRay = this.computeClampedParallaxRay(viewDir, parallaxScale, maxOffset).toVar();
      const sampleHeight = this.createHeightSampler(heightMap, uv);

      const layerDepth = float(1.0 / steps);
      const deltaUv = parallaxRay.mul(layerDepth).toVar();
      // posDelta.xy = uv step per layer, posDelta.z = -layerDepth so
      // currentPos.subAssign(posDelta) moves UV against the view AND
      // increments depthFromTop in a single statement.
      const posDelta = vec3(deltaUv as any, layerDepth.negate()).toVar();

      const currentPos = vec3((uv as any).x, (uv as any).y, float(0.0)).toVar();
      const prevPos = currentPos.toVar();

      Loop(steps, () => {
        const sampledDepth = float(1.0).sub(sampleHeight(currentPos.xy));
        If(currentPos.z.greaterThanEqual(sampledDepth), () => {
          Break();
        });
        prevPos.assign(currentPos);
        currentPos.subAssign(posDelta);
      });

      // Midpoint bisection between currentPos (below surface) and prevPos
      // (above surface). Mutates the same two VarNodes, no new ones.
      Loop(refinementSteps, () => {
        const midPos = currentPos.add(prevPos).mul(float(0.5)).toVar();
        const sampledDepth = float(1.0).sub(sampleHeight(midPos.xy));
        If(midPos.z.greaterThanEqual(sampledDepth), () => {
          currentPos.assign(midPos);
        }).Else(() => {
          prevPos.assign(midPos);
        });
      });

      return currentPos.xy;
    })();
  }

  /**
   * Silhouette-friendly POM variant with binary refinement and a non-zero
   * reference plane. Returns both displaced UV and depth delta.
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

    const result = Fn(() => {
      const uvScale = float(Math.max(scale, 0.0001));
      const parallaxScale = float(config.scale || 0.1).div(uvScale);
      const maxOffset = float(config.maxOffset ?? 0.15).div(uvScale);

      const viewDir = this.getViewDirTangentSpace();
      const parallaxRay = this.computeClampedParallaxRay(viewDir, parallaxScale, maxOffset, minViewZ).toVar();
      const sampleHeight = this.createHeightSampler(heightMap, uv);

      const layerDepth = float(1.0 / steps);
      const deltaUv = parallaxRay.mul(layerDepth).toVar();
      const posDelta = vec3(deltaUv as any, layerDepth.negate()).toVar();

      // Reference plane shifts where depthFromTop = 0 sits within the
      // height field. referencePlane = 0.5 means the mid-height is treated
      // as the geometry plane.
      const startUv = uv.add(parallaxRay.mul(float(referencePlane)));
      const currentPos = vec3((startUv as any).x, (startUv as any).y, float(0.0)).toVar();
      const prevPos = currentPos.toVar();

      Loop(steps, () => {
        const sampledDepth = float(1.0).sub(sampleHeight(currentPos.xy));
        If(currentPos.z.greaterThanEqual(sampledDepth), () => {
          Break();
        });
        prevPos.assign(currentPos);
        currentPos.subAssign(posDelta);
      });

      Loop(refinementSteps, () => {
        const midPos = currentPos.add(prevPos).mul(float(0.5)).toVar();
        const sampledDepth = float(1.0).sub(sampleHeight(midPos.xy));
        If(midPos.z.greaterThanEqual(sampledDepth), () => {
          currentPos.assign(midPos);
        }).Else(() => {
          prevPos.assign(midPos);
        });
      });

      // Pack uv + depthFromTop into one vec3 so callers can fan out without
      // re-marching. depthDelta is depthFromTop scaled by parallaxScale to
      // approximate world units (same convention as the engine SPOM Surface
      // node, so downstream Pixel Depth Offset consumers behave identically).
      return vec3(currentPos.x, currentPos.y, currentPos.z.mul(parallaxScale));
    })();

    return {
      uv: (result as any).xy.toVar(),
      depthDelta: (result as any).z.toVar()
    };
  }

  private createHeightSampler(heightMap: Texture, baseUv: Node): (sampleUv: Node) => Node {
    const ddxUv = dFdx(baseUv);
    const ddyUv = dFdy(baseUv);
    const heightTextureNode = texture(heightMap as any) as any;

    return (sampleUv: Node) => {
      const sampled = typeof heightTextureNode?.sample === 'function'
        ? heightTextureNode.sample(sampleUv)
        : null;
      const gradSample = sampled && typeof sampled.grad === 'function'
        ? sampled.grad(ddxUv, ddyUv)
        : null;
      const sample = gradSample ?? texture(heightMap, sampleUv);
      return sample.x ?? sample.r;
    };
  }

  /**
   * Get view direction in tangent space. Prefer Three's `parallaxDirection`
   * builtin, falling back to a manual TBN inverse when unavailable.
   */
  private getViewDirTangentSpace(): Node {
    if (parallaxDirection) {
      return (parallaxDirection as any).normalize();
    }

    const viewDirWorld = cameraPosition.sub(positionWorld).normalize();
    const normal = normalWorld.normalize();
    const tangent = tangentWorld.normalize();
    const bitangent = normal.cross(tangent).normalize();
    const TBN = mat3(tangent, bitangent, normal);
    const worldToTangent = TBN.transpose();
    const viewDirTangent = worldToTangent.mul(vec3(viewDirWorld)).normalize();
    return vec3(viewDirTangent.x, viewDirTangent.y, viewDirTangent.z.abs()).normalize();
  }

  /**
   * Compute a tangent-space parallax ray with max-offset clamping so the UV
   * never travels further than the texture detail can support at grazing
   * angles.
   */
  private computeClampedParallaxRay(
    viewDir: Node,
    parallaxScale: Node,
    maxOffset: Node,
    minViewZ = 0.001
  ): Node {
    const viewZ = tslMax(viewDir.z.abs(), float(minViewZ));
    const ray = viewDir.xy.div(viewZ).mul(parallaxScale);
    const rayLength = length(ray);
    const clampFactor = tslMin(float(1.0), maxOffset.div(tslMax(rayLength, float(0.0001))));
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
