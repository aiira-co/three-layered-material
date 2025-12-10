import { float, mix, vec3 } from "three/tsl";
import { Node } from "three/webgpu";
import { EdgeWear } from "./EdgeWear";

export class BlendTexture extends EdgeWear {

  protected blendNormals(
    normal1: Node,
    normal2: Node,
    blend: Node,
    blendMode: string = 'rnb'
  ): Node {
    // Convert to [-1, 1] range first
    const n1 = normal1.mul(2.0).sub(1.0);
    const n2 = normal2.mul(2.0).sub(1.0);

    let result: Node;

    switch (blendMode) {
      case 'linear':
        // Simple linear interpolation
        result = n1.mul(float(1.0).sub(blend)).add(n2.mul(blend));
        break;

      case 'whiteout':
        // Whiteout blending: n1 + n2 - (0,0,1)
        result = n1.add(n2).sub(vec3(0.0, 0.0, 1.0));
        break;

      case 'udn':
        // Unity-like normal blending
        result = this.unityStyleNormalBlend(n1, n2, blend);
        break;

      case 'partial_derivative':
        // Partial derivative preservation
        result = this.partialDerivativeBlend(n1, n2, blend);
        break;

      default: // 'rnb' - Reoriented Normal Blending
        result = this.reorientedNormalBlend(n1, n2, blend);
    }

    // Normalize and convert back to [0, 1] range
    return result.normalize().mul(0.5).add(0.5);
  }

  private reorientedNormalBlend(n1: Node, n2: Node, blend: Node): Node {
    // Standard Reoriented Normal Mapping
    const t = n1.xyz.add(vec3(0.0, 0.0, 1.0));
    const u = n2.xyz.mul(vec3(-1.0, -1.0, 1.0));
    return t.mul(t.dot(u).div(t.z)).sub(u);
  }

  private unityStyleNormalBlend(n1: Node, n2: Node, blend: Node): Node {
    // Unity's approach: blend XY components separately from Z
    const blendedXY = n1.xy.mul(float(1.0).sub(blend)).add(n2.xy.mul(blend));
    const blendedZ = n1.z.mul(float(1.0).sub(blend)).add(n2.z.mul(blend));
    return vec3(blendedXY, blendedZ);
  }

  private partialDerivativeBlend(n1: Node, n2: Node, blend: Node): Node {
    // Preserve partial derivatives for better microsurface detail
    const dN1 = n1.dFdx().add(n1.dFdy());
    const dN2 = n2.dFdx().add(n2.dFdy());

    const weight = dN1.length().div(dN1.length().add(dN2.length()).add(0.001));
    const adjustedBlend = blend.mul(weight);

    return n1.mul(float(1.0).sub(adjustedBlend)).add(n2.mul(adjustedBlend));
  }

  unpackNormal(normalSample: Node): Node {
    // Convert from [0,1] to [-1,1]
    return normalSample.mul(2.0).sub(1.0);
  }







  protected blendColors(
    baseColor: Node,
    topColor: Node,
    blendFactor: Node,
    blendMode: string = 'normal'
  ): Node {
    switch (blendMode) {
      case 'multiply':
        return mix(baseColor, baseColor.mul(topColor), blendFactor);

      case 'overlay':
        const overlay = baseColor.mul(baseColor.add(topColor.mul(2.0).mul(float(1.0).sub(baseColor))));
        return mix(baseColor, overlay, blendFactor);

      case 'screen':
        const screen = float(1.0).sub(float(1.0).sub(baseColor).mul(float(1.0).sub(topColor)));
        return mix(baseColor, screen, blendFactor);

      case 'add':
        return mix(baseColor, baseColor.add(topColor), blendFactor);

      case 'subtract':
        return mix(baseColor, baseColor.sub(topColor), blendFactor);

      case 'divide':
        const safeTop = topColor.max(0.001); // Avoid division by zero
        return mix(baseColor, baseColor.div(safeTop), blendFactor);

      case 'darken':
        return mix(baseColor, baseColor.min(topColor), blendFactor);

      case 'lighten':
        return mix(baseColor, baseColor.max(topColor), blendFactor);

      default: // 'normal'
        return mix(baseColor, topColor, blendFactor);
    }
  }


  protected blendScalarProperties(
    baseValue: Node,
    topValue: Node,
    blendFactor: Node,
    blendMode: string = 'normal'
  ): Node {
    switch (blendMode) {
      case 'min':
        return mix(baseValue, baseValue.min(topValue), blendFactor);

      case 'max':
        return mix(baseValue, baseValue.max(topValue), blendFactor);

      case 'multiply':
        return mix(baseValue, baseValue.mul(topValue), blendFactor);

      case 'average':
        return mix(baseValue, baseValue.add(topValue).mul(0.5), blendFactor);

      default: // 'normal'
        return mix(baseValue, topValue, blendFactor);
    }
  }
}
