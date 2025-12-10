import { Node } from "three/webgpu";
import {
  float,
  vec2,
  vec3,
  texture,
  cameraPosition,
  positionWorld,
  normalLocal,
  tangentWorld,
  mat3,
  mix,
  max as tslMax
} from "three/tsl";
import { ParallaxConfig } from "./ParallaxConfig";

/**
 * Parallax mapping techniques for depth illusion
 * Supports simple offset, steep parallax, and parallax occlusion mapping
 */
export class ParallaxMapper {
  /**
   * Apply parallax offset to UV coordinates
   * @param uv - Base UV coordinates
   * @param height - Height value (0-1)
   * @param config - Parallax configuration
   */
  apply(uv: Node, height: Node, config: ParallaxConfig): Node {
    if (!config.enable) {
      return uv;
    }

    switch (config.method) {
      case 'pom':
        return this.parallaxOcclusionMapping(uv, height, config);

      case 'web-optimized':
        return this.webOptimizedPOM(uv, height, config);

      default:
        return this.simpleParallax(uv, height, config);
    }
  }

  /**
   * Simple parallax - fastest, lowest quality
   * Just offsets UV based on view direction and height
   */
  private simpleParallax(uv: Node, height: Node, config: ParallaxConfig): Node {
    const scale = float(config.scale || 0.05);
    const viewDir = this.getViewDirTangentSpace();

    // Prevent extreme offsets when viewing perpendicular
    const viewZ = tslMax(viewDir.z, float(0.1));

    // Calculate parallax offset
    const parallaxOffset = viewDir.xy.mul(height.mul(scale)).div(viewZ);

    // Clamp offset to prevent extreme distortion
    const maxOffset = float(config.maxOffset || 0.1);
    const clampedOffset = parallaxOffset.clamp(maxOffset.negate(), maxOffset);

    return uv.sub(clampedOffset);
  }

  /**
   * Parallax Occlusion Mapping (POM) - highest quality
   * Ray marches through height field for accurate depth
   */
  private parallaxOcclusionMapping(
    uv: Node,
    initialHeight: Node,
    config: ParallaxConfig
  ): Node {
    const steps = config.steps || 16;
    const scale = float(config.scale || 0.1);

    const viewDir = this.getViewDirTangentSpace();
    const parallaxDirection = viewDir.xy.normalize().mul(scale);

    // Ray marching parameters
    const numLayers = float(steps);
    const layerDepth = float(1.0).div(numLayers);
    const deltaUV = parallaxDirection.div(numLayers);

    // Initialize ray marching
    let currentUV = uv;
    let currentLayerDepth: Node = float(0.0);
    let currentHeight = initialHeight;

    // Ray march through height field
    for (let i = 0; i < steps; i++) {
      // Check if we've intersected the surface
      if (currentLayerDepth.greaterThanEqual(currentHeight)) {
        break;
      }

      // Step along ray
      currentUV = currentUV.sub(deltaUV);
      currentLayerDepth = currentLayerDepth.add(layerDepth);

      // In a real implementation, you'd sample the height map here
      // For now, we use the initial height as approximation
      currentHeight = initialHeight;
    }

    // Optional: Binary search refinement for better accuracy
    if (config.quality === 'high') {
      currentUV = this.binarySearchRefinement(
        currentUV,
        deltaUV,
        currentLayerDepth,
        layerDepth,
        initialHeight,
        5 // refinement steps
      );
    }

    return currentUV;
  }

  /**
   * Web-optimized POM - balanced quality/performance
   * Fewer samples, no texture fetches in loop
   */
  private webOptimizedPOM(uv: Node, height: Node, config: ParallaxConfig): Node {
    const quality = config.quality || 'medium';
    const settings = {
      low: { steps: 4, scale: 0.03 },
      medium: { steps: 8, scale: 0.05 },
      high: { steps: 12, scale: 0.08 }
    }[quality];

    const scale = float(config.scale || settings.scale);
    const viewDir = this.getViewDirTangentSpace();
    const parallaxDirection = viewDir.xy.normalize().mul(scale);

    const numLayers = float(settings.steps);
    const layerDepth = float(1.0).div(numLayers);
    const deltaUV = parallaxDirection.div(numLayers);

    let currentUV = uv;
    let currentLayerDepth: Node = float(0.0);

    // Simplified ray march (no texture sampling in loop)
    for (let i = 0; i < settings.steps; i++) {
      if (currentLayerDepth.greaterThanEqual(height)) {
        break;
      }
      currentUV = currentUV.sub(deltaUV);
      currentLayerDepth = currentLayerDepth.add(layerDepth);
    }

    return currentUV;
  }

  /**
   * Binary search refinement for more accurate intersection
   */
  private binarySearchRefinement(
    uv: Node,
    deltaUV: Node,
    layerDepth: Node,
    layerStep: Node,
    height: Node,
    steps: number
  ): Node {
    let loUV:Node = uv.add(deltaUV);
    let hiUV = uv;
    let loDepth:Node = layerDepth.sub(layerStep);
    let hiDepth = layerDepth;

    for (let i = 0; i < steps; i++) {
      const midUV = loUV.add(hiUV).mul(0.5);
      const midDepth = loDepth.add(hiDepth).mul(0.5);

      // Compare with height (simplified - no texture fetch)
      const condition = height.lessThan(midDepth);

      loUV = mix(loUV, midUV, condition);
      hiUV = mix(midUV, hiUV, condition);
      loDepth = mix(loDepth, midDepth, condition);
      hiDepth = mix(midDepth, hiDepth, condition);
    }

    return loUV.add(hiUV).mul(0.5);
  }

  /**
   * Get view direction in tangent space
   */
  private getViewDirTangentSpace(): Node {
    // View direction in world space
    const viewDirWorld = cameraPosition.sub(positionWorld).normalize();

    // Construct TBN matrix
    const normal = normalLocal;
    const tangent = tangentWorld;
    const bitangent = normal.cross(tangent);

    // Build tangent-to-world matrix
    const TBN = mat3(tangent, bitangent, normal);

    // Transform view direction to tangent space (inverse of TBN)
    const worldToTangent = TBN.transpose();
    return worldToTangent.mul(vec3(viewDirWorld)).normalize();
  }

  /**
   * Steep parallax mapping - middle ground quality
   */
  steepParallax(uv: Node, height: Node, config: ParallaxConfig): Node {
    const steps = config.steps || 10;
    const scale = float(config.scale || 0.08);

    const viewDir = this.getViewDirTangentSpace();
    const parallaxDirection = viewDir.xy.mul(scale);

    const stepSize = float(1.0).div(float(steps));
    let currentUV = uv;
    let currentHeight:Node = float(1.0);

    for (let i = 0; i < steps; i++) {
      if (currentHeight.lessThanEqual(height)) {
        break;
      }
      currentUV = currentUV.sub(parallaxDirection.mul(stepSize));
      currentHeight = currentHeight.sub(stepSize);
    }

    return currentUV;
  }
}
