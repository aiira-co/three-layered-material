import { Node } from "three/webgpu";
import { mix, float, saturate } from "three/tsl";
import { ScalarBlendMode } from "./BlendModeConfig";

/**
 * Handles blending of scalar properties (roughness, metalness, AO)
 * Provides various blending strategies for different material behaviors
 */
export class ScalarBlender {
  /**
   * Blend two scalar values using specified mode
   * @param baseValue - Base layer value
   * @param topValue - Top layer value
   * @param blendFactor - Blend amount (0-1)
   * @param mode - Blending mode
   */
  blend(
    baseValue: Node,
    topValue: Node,
    blendFactor: Node,
    mode: ScalarBlendMode = 'normal'
  ): Node {
    let blendedValue: Node;

    switch (mode) {
      case 'min':
        blendedValue = this.min(baseValue, topValue);
        break;

      case 'max':
        blendedValue = this.max(baseValue, topValue);
        break;

      case 'multiply':
        blendedValue = this.multiply(baseValue, topValue);
        break;

      case 'average':
        blendedValue = this.average(baseValue, topValue);
        break;

      case 'overlay':
        blendedValue = this.overlay(baseValue, topValue);
        break;

      case 'add':
        blendedValue = this.add(baseValue, topValue);
        break;

      case 'subtract':
        blendedValue = this.subtract(baseValue, topValue);
        break;

      default: // 'normal'
        return mix(baseValue, topValue, blendFactor);
    }

    // Apply blend factor and clamp
    return saturate(mix(baseValue, blendedValue, blendFactor));
  }

  private min(base: Node, top: Node): Node {
    return base.min(top);
  }

  private max(base: Node, top: Node): Node {
    return base.max(top);
  }

  private multiply(base: Node, top: Node): Node {
    return base.mul(top);
  }

  private average(base: Node, top: Node): Node {
    return base.add(top).mul(0.5);
  }

  private overlay(base: Node, top: Node): Node {
    // Overlay blend for scalars
    const multiply = base.mul(top).mul(2.0);
    const screen = float(1.0).sub(
      float(1.0).sub(base).mul(float(1.0).sub(top)).mul(2.0)
    );

    const condition = base.lessThan(0.5);
    return mix(screen, multiply, condition);
  }

  private add(base: Node, top: Node): Node {
    return base.add(top);
  }

  private subtract(base: Node, top: Node): Node {
    return base.sub(top);
  }

  /**
   * Specialized blend for roughness that considers physical constraints
   * Rougher surfaces should generally dominate
   */
  blendRoughness(
    baseRoughness: Node,
    topRoughness: Node,
    blendFactor: Node,
    mode: ScalarBlendMode = 'max'
  ): Node {
    // For roughness, 'max' is often physically correct
    // A surface can't be smoother than its roughest component
    return this.blend(baseRoughness, topRoughness, blendFactor, mode);
  }

  /**
   * Specialized blend for metalness
   * Binary in nature (metal or not), but can be blended for transitions
   */
  blendMetalness(
    baseMetalness: Node,
    topMetalness: Node,
    blendFactor: Node,
    mode: ScalarBlendMode = 'normal'
  ): Node {
    // Linear blend is usually best for metalness
    return this.blend(baseMetalness, topMetalness, blendFactor, mode);
  }

  /**
   * Specialized blend for ambient occlusion
   * Darker values (more occlusion) should typically dominate
   */
  blendAO(
    baseAO: Node,
    topAO: Node,
    blendFactor: Node,
    mode: ScalarBlendMode = 'multiply'
  ): Node {
    // Multiply is physically correct for AO
    // Occluded areas should remain occluded
    return this.blend(baseAO, topAO, blendFactor, mode);
  }
}
