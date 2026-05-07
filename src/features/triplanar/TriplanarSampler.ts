
import {
  texture,
  vec3,
  float,
  abs,
  positionWorld,
  positionLocal,
  normalWorld,
  normalLocal,
  select
} from "three/tsl";
import { LayerConfig, LayerData } from "../../types";
import { Texture, Vector3 } from "three";

import { TextureBombing } from '../bombing/TextureBombing';
import { EdgeWearCalculator } from '../edge-wear/EdgeWearCalculator';

type Node = any;


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
    const nAbs = abs(normal);
    const sharpness = float(4.0);
    const weighted: any = nAbs.pow(sharpness) as any;
    const eps = float(1e-6);
    const sum = (weighted as any).x.add((weighted as any).y).add((weighted as any).z).add(eps);
    return weighted.div(sum); // Normalized weights that sum to 1
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

    const eps = float(0.001);
    const useX = blend.x.greaterThan(eps);
    const useY = blend.y.greaterThan(eps);
    const useZ = blend.z.greaterThan(eps);

    const wx = select(useX, blend.x, float(0.0));
    const wy = select(useY, blend.y, float(0.0));
    const wz = select(useZ, blend.z, float(0.0));
    const weightSum = wx.add(wy).add(wz).max(0.0001);

    const sampleX = useBombing
      ? this._textureBombing.sample(colorInput, uvX, bombingBlend).xyz
      : texture(colorInput, uvX).xyz;
    const sampleY = useBombing
      ? this._textureBombing.sample(colorInput, uvY, bombingBlend).xyz
      : texture(colorInput, uvY).xyz;
    const sampleZ = useBombing
      ? this._textureBombing.sample(colorInput, uvZ, bombingBlend).xyz
      : texture(colorInput, uvZ).xyz;

    const sX = select(useX, sampleX, vec3(0.0, 0.0, 0.0));
    const sY = select(useY, sampleY, vec3(0.0, 0.0, 0.0));
    const sZ = select(useZ, sampleZ, vec3(0.0, 0.0, 0.0));

    return sX.mul(wx).add(sY.mul(wy)).add(sZ.mul(wz)).div(weightSum);
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

    const eps = float(0.001);
    const useX = blend.x.greaterThan(eps);
    const useY = blend.y.greaterThan(eps);
    const useZ = blend.z.greaterThan(eps);

    const wx = select(useX, blend.x, float(0.0));
    const wy = select(useY, blend.y, float(0.0));
    const wz = select(useZ, blend.z, float(0.0));

    // Sample normals from active projections only (branchable select).
    const packedX = useBombing
      ? this._textureBombing.sample(normalMap, uvX, bombingBlend).xyz
      : texture(normalMap, uvX).xyz;
    const packedY = useBombing
      ? this._textureBombing.sample(normalMap, uvY, bombingBlend).xyz
      : texture(normalMap, uvY).xyz;
    const packedZ = useBombing
      ? this._textureBombing.sample(normalMap, uvZ, bombingBlend).xyz
      : texture(normalMap, uvZ).xyz;

    const sX = select(useX, this.unpackNormal(packedX), vec3(0.0, 0.0, 0.0));
    const sY = select(useY, this.unpackNormal(packedY), vec3(0.0, 0.0, 0.0));
    const sZ = select(useZ, this.unpackNormal(packedZ), vec3(0.0, 0.0, 0.0));

    // Reorient normals to world/object space
    // X-axis projection (YZ plane): rotate tangent space
    const worldNX = vec3(sX.z, sX.x, sX.y);

    // Y-axis projection (ZX plane): rotate tangent space
    const worldNY = vec3(sY.x, sY.z, sY.y);

    // Z-axis projection (XY plane): no rotation needed
    const worldNZ = vec3(sZ.x, sZ.y, sZ.z);

    // Blend and normalize
    const blended = worldNX.mul(wx)
      .add(worldNY.mul(wy))
      .add(worldNZ.mul(wz));

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
      const eps = float(0.001);
      const useX = blend.x.greaterThan(eps);
      const useY = blend.y.greaterThan(eps);
      const useZ = blend.z.greaterThan(eps);

      const wx = select(useX, blend.x, float(0.0));
      const wy = select(useY, blend.y, float(0.0));
      const wz = select(useZ, blend.z, float(0.0));
      const weightSum = wx.add(wy).add(wz).max(0.0001);

      const armX = useBombing
        ? this._textureBombing.sample(layer.map.arm, uvX, bombingBlend).xyz
        : texture(layer.map.arm, uvX).xyz;
      const armY = useBombing
        ? this._textureBombing.sample(layer.map.arm, uvY, bombingBlend).xyz
        : texture(layer.map.arm, uvY).xyz;
      const armZ = useBombing
        ? this._textureBombing.sample(layer.map.arm, uvZ, bombingBlend).xyz
        : texture(layer.map.arm, uvZ).xyz;

      const sampleX = select(useX, armX, vec3(0.0, 0.0, 0.0));
      const sampleY = select(useY, armY, vec3(0.0, 0.0, 0.0));
      const sampleZ = select(useZ, armZ, vec3(0.0, 0.0, 0.0));

      const arm = sampleX.mul(wx).add(sampleY.mul(wy)).add(sampleZ.mul(wz)).div(weightSum);

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

    const eps = float(0.001);
    const useX = blend.x.greaterThan(eps);
    const useY = blend.y.greaterThan(eps);
    const useZ = blend.z.greaterThan(eps);

    const wx = select(useX, blend.x, float(0.0));
    const wy = select(useY, blend.y, float(0.0));
    const wz = select(useZ, blend.z, float(0.0));
    const weightSum = wx.add(wy).add(wz).max(0.0001);

    const sXRaw = useBombing
      ? this._textureBombing.sample(map, uvX, bombingBlend).x
      : texture(map, uvX).x;
    const sYRaw = useBombing
      ? this._textureBombing.sample(map, uvY, bombingBlend).x
      : texture(map, uvY).x;
    const sZRaw = useBombing
      ? this._textureBombing.sample(map, uvZ, bombingBlend).x
      : texture(map, uvZ).x;

    const sX = select(useX, sXRaw, float(0.0));
    const sY = select(useY, sYRaw, float(0.0));
    const sZ = select(useZ, sZRaw, float(0.0));

    return sX.mul(wx).add(sY.mul(wy)).add(sZ.mul(wz)).div(weightSum);
  }

  private unpackNormal(normalSample: Node): Node {
    return normalSample.mul(2.0).sub(1.0);
  }

  private applyEdgeWear(data: LayerData, layer: LayerConfig): LayerData {
    return this._edgeWearCalculator.apply(data, layer.edgeWear!);
  }
}
