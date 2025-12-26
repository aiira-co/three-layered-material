import { Texture } from "three";
import { Node } from "three/webgpu";
import { vec3, float } from "three/tsl";
import { LayerConfig, LayerData } from "../types";
import { EdgeWearCalculator } from '../features/edge-wear/EdgeWearCalculator';

/**
 * Creates default layers from solid colors and values
 * Used when no textures or materials are provided
 */
export class DefaultLayerFactory {
  /**
   * Create a layer from solid colors and scalar values
   */
  create(layer: LayerConfig): LayerData {
    let color = this.createColor(layer);

    // Apply color tint if specified
    if (layer.colorTint) {
      const tint = vec3(layer.colorTint.r, layer.colorTint.g, layer.colorTint.b);
      color = color.mul(tint);
    }

    const normal = vec3(0, 0, 1);
    const roughness = float(layer.roughness ?? 0.5);
    const metalness = float(layer.metalness ?? 0.0);
    const ao = float(1.0);
    const height = float(0.5);

    // Apply edge wear if enabled
    if (layer.edgeWear?.enable) {
      return this.applyEdgeWear(
        { color, normal, roughness, metalness, ao, height },
        layer
      );
    }

    return { color, normal, roughness, metalness, ao, height };
  }

  private createColor(layer: LayerConfig): Node {
    if (layer.color) {
      return vec3(layer.color.x, layer.color.y, layer.color.z);
    }

    if (layer.map?.color && !(layer.map.color instanceof Texture)) {
      // Vector3 from map
      return vec3(layer.map.color.x, layer.map.color.y, layer.map.color.z);
    }

    // Default gray
    return vec3(0.8, 0.8, 0.8);
  }

  private applyEdgeWear(data: LayerData, layer: LayerConfig): LayerData {
    const wearCalc = new EdgeWearCalculator();
    return wearCalc.apply(data, layer.edgeWear!);
  }

  /**
   * Create a basic layer with just a color
   */
  static fromColor(r: number, g: number, b: number): LayerData {
    return {
      color: vec3(r, g, b),
      normal: vec3(0, 0, 1),
      roughness: float(0.5),
      metalness: float(0.0),
      ao: float(1.0),
      height: float(0.5)
    };
  }

  /**
   * Create a metallic layer
   */
  static metallic(r: number, g: number, b: number, roughness: number = 0.2): LayerData {
    return {
      color: vec3(r, g, b),
      normal: vec3(0, 0, 1),
      roughness: float(roughness),
      metalness: float(1.0),
      ao: float(1.0),
      height: float(0.5)
    };
  }

  /**
   * Create a dielectric (non-metal) layer
   */
  static dielectric(r: number, g: number, b: number, roughness: number = 0.8): LayerData {
    return {
      color: vec3(r, g, b),
      normal: vec3(0, 0, 1),
      roughness: float(roughness),
      metalness: float(0.0),
      ao: float(1.0),
      height: float(0.5)
    };
  }
}
