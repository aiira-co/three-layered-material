import { Node } from "three/webgpu";
import { texture, uv, vec3, float, mix, saturate } from "three/tsl";
import { LayerConfig, LayerData } from "../types";
import { Texture, Vector3 } from "three";
import { TextureBombing } from '../features/bombing/TextureBombing';
import { ParallaxMapper } from '../features/parallax/ParallaxMapper';
import { EdgeWearCalculator } from '../features/edge-wear/EdgeWearCalculator';

/**
 * Samples textures with support for UV mapping, texture bombing, and parallax
 */
export class TextureSampler {

  private _textureBombing = new TextureBombing();
  private _parallaxMapper = new ParallaxMapper();
  private _edgeWearCalculator = new EdgeWearCalculator();

  /**
   * Sample layer from texture maps
   */
  sample(layer: LayerConfig): LayerData {
    if (!layer.map) {
      throw new Error('TextureSampler requires layer.map to be defined');
    }

    // Calculate UV coordinates with scale
    let uvCoords: Node = uv().mul(float(layer.scale ?? 1));

    // Apply parallax offset if enabled (before sampling other textures)
    if (layer.parallax?.enable && layer.map.height) {
      uvCoords = this._parallaxMapper.apply(
        uvCoords,
        layer.map.height,
        layer.parallax,
        layer.scale ?? 1
      );
    }

    // Sample height at final UV (for blending/other uses)
    const height = this.sampleHeight(layer, uvCoords);

    // Determine if we should use texture bombing
    const useBombing = layer.textureBombing?.enable ?? false;
    const bombingBlend = layer.textureBombing?.blend ?? 0.5;

    // Sample all material properties
    let color = this.sampleColor(layer.map.color, uvCoords, useBombing, bombingBlend);

    // Apply color tint if specified
    if (layer.colorTint) {
      const tint = vec3(layer.colorTint.r, layer.colorTint.g, layer.colorTint.b);
      color = color.mul(tint);
    }

    const normal = this.sampleNormal(layer.map.normal, uvCoords, useBombing, bombingBlend);
    const { roughness, metalness, ao } = this.samplePBRProperties(layer, uvCoords, useBombing, bombingBlend);

    // Apply edge wear if enabled
    if (layer.edgeWear?.enable) {
      return this.applyEdgeWear({ color, normal, roughness, metalness, ao, height }, layer);
    }

    return { color, normal, roughness, metalness, ao, height };
  }

  private sampleColor(
    colorInput: Texture | Vector3 | undefined,
    uvCoords: Node,
    useBombing: boolean,
    bombingBlend: number
  ): Node {
    if (!colorInput) {
      return vec3(1, 1, 1);
    }

    if (colorInput instanceof Texture) {
      if (useBombing) {

        return this._textureBombing.sample(colorInput, uvCoords, bombingBlend).xyz;
      }
      return texture(colorInput, uvCoords).xyz;
    }

    // Vector3 solid color
    return vec3(colorInput.x, colorInput.y, colorInput.z);
  }

  private sampleNormal(
    normalMap: Texture | undefined,
    uvCoords: Node,
    useBombing: boolean,
    bombingBlend: number
  ): Node {
    if (!normalMap) {
      return vec3(0, 0, 1);
    }

    let normalSample: Node;
    if (useBombing) {
      normalSample = this._textureBombing.sample(normalMap, uvCoords, bombingBlend).xyz;
    } else {
      normalSample = texture(normalMap, uvCoords).xyz;
    }

    // Unpack from [0,1] to [-1,1]
    return normalSample.mul(2.0).sub(1.0);
  }

  private sampleHeight(layer: LayerConfig, uvCoords: Node): Node {
    if (!layer.map?.height) {
      return float(0.5);
    }

    const useBombing = layer.textureBombing?.enable ?? false;
    const bombingBlend = layer.textureBombing?.blend ?? 0.5;

    if (useBombing) {
      return this._textureBombing.sample(layer.map.height, uvCoords, bombingBlend).x;
    }

    return texture(layer.map.height, uvCoords).x;
  }

  private samplePBRProperties(
    layer: LayerConfig,
    uvCoords: Node,
    useBombing: boolean,
    bombingBlend: number
  ): { roughness: Node; metalness: Node; ao: Node } {
    // Check for ARM (packed) map first
    if (layer.map?.arm) {
      const armSample = useBombing
        ? (new TextureBombing()).sample(
          layer.map.arm, uvCoords, bombingBlend
        )
        : texture(layer.map.arm, uvCoords);

      return {
        ao: armSample.x,
        roughness: armSample.y,
        metalness: armSample.z
      };
    }

    // Sample individual maps
    const ao = this.sampleScalarMap(layer.map?.ao, uvCoords, useBombing, bombingBlend, 1.0);
    const roughness = this.sampleScalarMap(
      layer.map?.roughness,
      uvCoords,
      useBombing,
      bombingBlend,
      layer.roughness ?? 0.5
    );
    const metalness = this.sampleScalarMap(
      layer.map?.metalness,
      uvCoords,
      useBombing,
      bombingBlend,
      layer.metalness ?? 0.0
    );

    return { roughness, metalness, ao };
  }

  private sampleScalarMap(
    map: Texture | undefined,
    uvCoords: Node,
    useBombing: boolean,
    bombingBlend: number,
    fallback: number
  ): Node {
    if (!map) {
      return float(fallback);
    }

    if (useBombing) {
      return this._textureBombing.sample(map, uvCoords, bombingBlend).x;
    }

    return texture(map, uvCoords).x;
  }

  private applyEdgeWear(data: LayerData, layer: LayerConfig): LayerData {
    return this._edgeWearCalculator.apply(data, layer.edgeWear!);
  }
}
