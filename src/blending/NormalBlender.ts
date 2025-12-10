import { Node } from "three/webgpu";
import { mix, float, vec3, dot } from "three/tsl";
import { NormalBlendMode } from "./BlendModeConfig";

/**
 * Handles normal map blending with various techniques
 * Each method preserves surface detail differently
 */
export class NormalBlender {
  /**
   * Blend two normal maps using specified technique
   * @param normal1 - Base normal (should be in tangent space [-1,1])
   * @param normal2 - Top normal (should be in tangent space [-1,1])
   * @param blendFactor - Blend amount (0-1)
   * @param mode - Blending technique to use
   */
  blend(
    normal1: Node,
    normal2: Node,
    blendFactor: Node,
    mode: NormalBlendMode = 'rnb'
  ): Node {
    let blendedNormal: Node;

    switch (mode) {
      case 'linear':
        blendedNormal = this.linearBlend(normal1, normal2, blendFactor);
        break;

      case 'whiteout':
        blendedNormal = this.whiteoutBlend(normal1, normal2, blendFactor);
        break;

      case 'udn':
        blendedNormal = this.udnBlend(normal1, normal2, blendFactor);
        break;

      case 'partial_derivative':
        blendedNormal = this.partialDerivativeBlend(normal1, normal2, blendFactor);
        break;

      case 'overlay':
        blendedNormal = this.overlayBlend(normal1, normal2, blendFactor);
        break;

      default: // 'rnb' - Reoriented Normal Blending (recommended)
        blendedNormal = this.reorientedBlend(normal1, normal2, blendFactor);
    }

    return blendedNormal.normalize();
  }

  /**
   * Simple linear interpolation
   * Fast but can lose detail and doesn't preserve surface curvature well
   */
  private linearBlend(n1: Node, n2: Node, blend: Node): Node {
    return mix(n1, n2, blend);
  }

  /**
   * Reoriented Normal Blending (RNB)
   * Best quality - preserves detail and curvature
   * Based on: "Blending in Detail" by Colin Barré-Brisebois
   */
  private reorientedBlend(n1: Node, n2: Node, blend: Node): Node {
    // Interpolate between base normal and blended result
    const t = n1.add(vec3(0.0, 0.0, 1.0));
    const u = n2.mul(vec3(-1.0, -1.0, 1.0));
    const r = t.mul(dot(t, u).div(t.z)).sub(u);

    return mix(n1, r, blend);
  }

  /**
   * Whiteout Blending
   * Fast approximation, good for subtle details
   * Formula: n1 + n2 - (0,0,1)
   */
  private whiteoutBlend(n1: Node, n2: Node, blend: Node): Node {
    const blended = n1.add(n2).sub(vec3(0.0, 0.0, 1.0));
    return mix(n1, blended, blend);
  }

  /**
   * Unity Detail Normal (UDN) Blending
   * Good balance between quality and performance
   */
  private udnBlend(n1: Node, n2: Node, blend: Node): Node {
    // Blend XY components
    const blendedXY = mix(n1.xy, n2.xy, blend);

    // Reconstruct Z from XY
    const xyDot = blendedXY.dot(blendedXY);
    const z = float(1.0).sub(xyDot).max(0.0).sqrt();

    return vec3(blendedXY.x, blendedXY.y, z);
  }

  /**
   * Partial Derivative Blending
   * Preserves microsurface detail by considering normal derivatives
   * More expensive but highest quality for detailed surfaces
   */
  private partialDerivativeBlend(n1: Node, n2: Node, blend: Node): Node {
    // Calculate derivatives to determine detail contribution
    const dN1 = n1.dFdx().add(n1.dFdy());
    const dN2 = n2.dFdx().add(n2.dFdy());

    // Weight blend based on derivative magnitudes
    const detail1 = dN1.length();
    const detail2 = dN2.length();
    const totalDetail = detail1.add(detail2).add(0.001);

    // Normals with more detail get more weight
    const weight = detail1.div(totalDetail);
    const adjustedBlend = blend.mul(float(1.0).sub(weight));

    return mix(n1, n2, adjustedBlend);
  }

  /**
   * Overlay Blending
   * Similar to color overlay but for normals
   */
  private overlayBlend(n1: Node, n2: Node, blend: Node): Node {
    // Apply overlay-style blending to XY components
    const overlayXY = this.overlayComponents(n1.xy, n2.xy);
    const blendedXY = mix(n1.xy, overlayXY, blend);

    // Reconstruct Z
    const xyDot = blendedXY.dot(blendedXY);
    const z = float(1.0).sub(xyDot).max(0.0).sqrt();

    return vec3(blendedXY.x, blendedXY.y, z);
  }

  private overlayComponents(base: Node, top: Node): Node {
    const multiply = base.mul(top).mul(2.0);
    const screen = float(1.0).sub(
      float(1.0).sub(base).mul(float(1.0).sub(top)).mul(2.0)
    );

    const condition = base.lessThan(0.5);
    return mix(screen, multiply, condition);
  }

  /**
   * Unpack normal from [0,1] texture space to [-1,1] tangent space
   */
  unpackNormal(normalSample: Node): Node {
    return normalSample.mul(2.0).sub(1.0);
  }

  /**
   * Pack normal from [-1,1] tangent space to [0,1] texture space
   */
  packNormal(normal: Node): Node {
    return normal.mul(0.5).add(0.5);
  }
}
