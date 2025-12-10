import { Node } from "three/webgpu";
import {
  texture,
  vec3,
  float,
  abs,
  positionWorld,
  positionLocal,
  normalWorld,
  normalLocal,
  mix
} from "three/tsl";
import { LayerConfig, LayerData } from "../../types";
import { Texture, Vector3 } from "three";

import { TextureBombing } from '../bombing/TextureBombing';
import { EdgeWearCalculator } from '../edge-wear/EdgeWearCalculator';

/**
 * Handles triplanar projection mapping
 * Projects textures from three orthogonal planes to eliminate UV distortion
 */
export class TriplanarSampler {

  private _textureBombing = new TextureBombing();
  private _edgeWearCalculator = new EdgeWearCalculator();
  /**
   * Sample layer using triplanar projection
   */
  sample(layer: LayerConfig): LayerData {
    if (!layer.triplanar?.enable) {
      throw new Error('TriplanarSampler requires triplanar.enable to be true');
    }

    // Determine projection space (world vs local)
    const useWorldSpace = layer.triplanar.useWorldPosition ?? true;
    const projPos = useWorldSpace ? positionWorld : positionLocal;
    const projNorm = useWorldSpace ? normalWorld : normalLocal;

    // Calculate projection UVs
    const scale = float(layer.scale || 1.0);
    const uvX = projPos.yz.mul(scale); // YZ plane (X-axis projection)
    const uvY = projPos.zx.mul(scale); // ZX plane (Y-axis projection)
    const uvZ = projPos.xy.mul(scale); // XY plane (Z-axis projection)

    // Calculate blend weights from surface normal
    const blendWeights = this.calculateBlendWeights(projNorm);

    // Determine if we should use texture bombing
    const useBombing = layer.textureBombing?.enable ?? false;
    const bombingBlend = layer.textureBombing?.blend ?? 0.5;

    // Sample all material properties from three projections
    const color = this.sampleTriplanarColor(
      layer.map?.color,
      uvX, uvY, uvZ,
      blendWeights,
      useBombing,
      bombingBlend
    );

    const normal = this.sampleTriplanarNormal(
      layer.map?.normal,
      uvX, uvY, uvZ,
      blendWeights,
      useBombing,
      bombingBlend
    );

    const { roughness, metalness, ao } = this.sampleTriplanarPBR(
      layer,
      uvX, uvY, uvZ,
      blendWeights,
      useBombing,
      bombingBlend
    );

    const height = this.sampleTriplanarScalar(
      layer.map?.height,
      uvX, uvY, uvZ,
      blendWeights,
      0.5,
      useBombing,
      bombingBlend
    );

    // Apply edge wear if enabled
    if (layer.edgeWear?.enable) {
      return this.applyEdgeWear({ color, normal, roughness, metalness, ao, height }, layer);
    }

    return { color, normal, roughness, metalness, ao, height };
  }

  /**
   * Calculate triplanar blend weights based on surface normal
   */
  private calculateBlendWeights(normal: Node): Node {
    const nAbs = abs(normal).normalize();
    const eps = float(1e-6);
    const sum = nAbs.x.add(nAbs.y).add(nAbs.z).add(eps);
    return nAbs.div(sum); // Normalized weights that sum to 1
  }

  private sampleTriplanarColor(
    colorInput: Texture | Vector3 | undefined,
    uvX: Node, uvY: Node, uvZ: Node,
    blend: Node,
    useBombing: boolean,
    bombingBlend: number
  ): Node {
    if (!colorInput) {
      return vec3(1, 1, 1);
    }

    // Solid color
    if (!(colorInput instanceof Texture)) {
      return vec3(colorInput.x, colorInput.y, colorInput.z);
    }

    // Sample from three projections
    if (useBombing) {
      const bomber = this._textureBombing;
      const sX = bomber.sample(colorInput, uvX, bombingBlend);
      const sY = bomber.sample(colorInput, uvY, bombingBlend);
      const sZ = bomber.sample(colorInput, uvZ, bombingBlend);
      return sX.mul(blend.x).add(sY.mul(blend.y)).add(sZ.mul(blend.z)).xyz;
    }

    const sX = texture(colorInput, uvX);
    const sY = texture(colorInput, uvY);
    const sZ = texture(colorInput, uvZ);
    return sX.mul(blend.x).add(sY.mul(blend.y)).add(sZ.mul(blend.z)).xyz;
  }

  private sampleTriplanarNormal(
    normalMap: Texture | undefined,
    uvX: Node, uvY: Node, uvZ: Node,
    blend: Node,
    useBombing: boolean,
    bombingBlend: number
  ): Node {
    if (!normalMap) {
      return vec3(0, 0, 1);
    }

    // Sample normals from three projections
    let sX: Node, sY: Node, sZ: Node;

    if (useBombing) {
      const bomber = this._textureBombing;
      sX = this.unpackNormal(bomber.sample(normalMap, uvX, bombingBlend).xyz);
      sY = this.unpackNormal(bomber.sample(normalMap, uvY, bombingBlend).xyz);
      sZ = this.unpackNormal(bomber.sample(normalMap, uvZ, bombingBlend).xyz);
    } else {
      sX = this.unpackNormal(texture(normalMap, uvX).xyz);
      sY = this.unpackNormal(texture(normalMap, uvY).xyz);
      sZ = this.unpackNormal(texture(normalMap, uvZ).xyz);
    }

    // Reorient normals to world/object space
    // X-axis projection (YZ plane): rotate tangent space
    const worldNX = vec3(sX.z, sX.x, sX.y);

    // Y-axis projection (ZX plane): rotate tangent space
    const worldNY = vec3(sY.x, sY.z, sY.y);

    // Z-axis projection (XY plane): no rotation needed
    const worldNZ = vec3(sZ.x, sZ.y, sZ.z);

    // Blend and normalize
    const blended = worldNX.mul(blend.x)
      .add(worldNY.mul(blend.y))
      .add(worldNZ.mul(blend.z));

    return blended.normalize();
  }

  private sampleTriplanarPBR(
    layer: LayerConfig,
    uvX: Node, uvY: Node, uvZ: Node,
    blend: Node,
    useBombing: boolean,
    bombingBlend: number
  ): { roughness: Node; metalness: Node; ao: Node } {
    // Check for ARM map first
    if (layer.map?.arm) {
      const armX = useBombing
        ? this._textureBombing.sample(layer.map.arm, uvX, bombingBlend)
        : texture(layer.map.arm, uvX);
      const armY = useBombing
        ? this._textureBombing.sample(layer.map.arm, uvY, bombingBlend)
        : texture(layer.map.arm, uvY);
      const armZ = useBombing
        ? this._textureBombing.sample(layer.map.arm, uvZ, bombingBlend)
        : texture(layer.map.arm, uvZ);

      const arm = armX.mul(blend.x).add(armY.mul(blend.y)).add(armZ.mul(blend.z));

      return {
        ao: arm.x,
        roughness: arm.y,
        metalness: arm.z
      };
    }

    // Sample individual maps
    return {
      roughness: this.sampleTriplanarScalar(
        layer.map?.roughness, uvX, uvY, uvZ, blend,
        layer.roughness ?? 0.5, useBombing, bombingBlend
      ),
      metalness: this.sampleTriplanarScalar(
        layer.map?.metalness, uvX, uvY, uvZ, blend,
        layer.metalness ?? 0.0, useBombing, bombingBlend
      ),
      ao: this.sampleTriplanarScalar(
        layer.map?.ao, uvX, uvY, uvZ, blend,
        1.0, useBombing, bombingBlend
      )
    };
  }

  private sampleTriplanarScalar(
    map: Texture | undefined,
    uvX: Node, uvY: Node, uvZ: Node,
    blend: Node,
    fallback: number,
    useBombing: boolean,
    bombingBlend: number
  ): Node {
    if (!map) {
      return float(fallback);
    }

    if (useBombing) {
      const bomber = this._textureBombing;
      const sX = bomber.sample(map, uvX, bombingBlend).x;
      const sY = bomber.sample(map, uvY, bombingBlend).x;
      const sZ = bomber.sample(map, uvZ, bombingBlend).x;
      return sX.mul(blend.x).add(sY.mul(blend.y)).add(sZ.mul(blend.z));
    }

    const sX = texture(map, uvX).x;
    const sY = texture(map, uvY).x;
    const sZ = texture(map, uvZ).x;
    return sX.mul(blend.x).add(sY.mul(blend.y)).add(sZ.mul(blend.z));
  }

  private unpackNormal(normalSample: Node): Node {
    return normalSample.mul(2.0).sub(1.0);
  }

  private applyEdgeWear(data: LayerData, layer: LayerConfig): LayerData {
    return this._edgeWearCalculator.apply(data, layer.edgeWear!);
  }
}
