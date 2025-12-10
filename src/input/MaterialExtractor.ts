import { Node } from "three/webgpu";
import { vec3, float, texture, uv } from "three/tsl";
import { LayerConfig, LayerData, NodeMaterialInput } from "../types";
import { Texture } from "three";
import { EdgeWearCalculator } from '../features/edge-wear/EdgeWearCalculator';
import { TextureSampler } from "./TextureSampler";

/**
 * Extracts shader nodes and textures from existing Three.js materials
 * Allows reuse of pre-built materials as layers
 */
export class MaterialExtractor {
  /**
   * Extract layer data from a material's shader nodes
   */
  extractFromMaterial(layer: LayerConfig): LayerData {
    const material = layer.materialInput!;
    const transform = layer.materialTransform;

    // Try to extract nodes directly
    const extracted = this.extractNodes(material);

    // If extractTextures is enabled, try to apply transformations
    if (transform?.extractTextures && this.hasTextures(material)) {
      return this.extractAndTransformTextures(layer, material);
    }

    // Apply edge wear if requested
    if (layer.edgeWear?.enable) {
      return this.applyEdgeWearToExtracted(extracted, layer);
    }

    return extracted;
  }

  /**
   * Extract shader nodes from material
   */
  private extractNodes(material: NodeMaterialInput): LayerData {
    return {
      color: material.colorNode || vec3(1, 1, 1),
      normal: material.normalNode || vec3(0, 0, 1),
      roughness: this.extractRoughness(material),
      metalness: this.extractMetalness(material),
      ao: this.extractAO(material),
      height: float(0.5) // Materials typically don't expose height
    };
  }

  private extractRoughness(material: NodeMaterialInput): Node {
    if ('roughnessNode' in material && material.roughnessNode) {
      return material.roughnessNode;
    }
    if ('roughness' in material && typeof material.roughness === 'number') {
      return float(material.roughness);
    }
    return float(0.5);
  }

  private extractMetalness(material: NodeMaterialInput): Node {
    if ('metalnessNode' in material && material.metalnessNode) {
      return material.metalnessNode;
    }
    if ('metalness' in material && typeof material.metalness === 'number') {
      return float(material.metalness);
    }
    return float(0.0);
  }

  private extractAO(material: NodeMaterialInput): Node {
    if ('aoNode' in material && material.aoNode) {
      return material.aoNode;
    }
    if ('aoMapIntensity' in material && material.aoMap) {
      return texture(material.aoMap, uv()).r;
    }
    return float(1.0);
  }

  /**
   * Check if material has texture maps
   */
  private hasTextures(material: NodeMaterialInput): boolean {
    return !!(material.map || material.normalMap ||
              ('roughnessMap' in material && material.roughnessMap) ||
              ('metalnessMap' in material && material.metalnessMap));
  }

  /**
   * Extract textures and apply layer transformations
   */
  private extractAndTransformTextures(
    layer: LayerConfig,
    material: NodeMaterialInput
  ): LayerData {
    const textures = this.extractTextures(material);

    // Create a temporary layer config with extracted textures
    const textureLayer: LayerConfig = {
      ...layer,
      map: {
        color: textures.colorMap,
        normal: textures.normalMap,
        roughness: textures.roughnessMap,
        metalness: textures.metalnessMap,
        ao: textures.aoMap,
        height: textures.heightMap
      },
      materialInput: undefined // Clear to prevent recursion
    };

    // Let TextureSampler handle the rest (triplanar, bombing, etc.)
    const sampler = new TextureSampler();
    return sampler.sample(textureLayer);
  }

  /**
   * Extract texture maps from material
   */
  extractTextures(material: NodeMaterialInput): {
    colorMap?: Texture;
    normalMap?: Texture;
    roughnessMap?: Texture;
    metalnessMap?: Texture;
    aoMap?: Texture;
    heightMap?: Texture;
  } {
    return {
      colorMap: material.map || undefined,
      normalMap: material.normalMap || undefined,
      roughnessMap: ('roughnessMap' in material) ? material.roughnessMap as Texture : undefined,
      metalnessMap: ('metalnessMap' in material) ? material.metalnessMap as Texture : undefined,
      aoMap: material.aoMap || undefined,
      heightMap: ('displacementMap' in material) ? material.displacementMap as Texture : undefined
    };
  }

  /**
   * Apply edge wear to extracted material
   */
  private applyEdgeWearToExtracted(data: LayerData, layer: LayerConfig): LayerData {
    // Import EdgeWearCalculator to apply wear
    const wearCalc = new EdgeWearCalculator();

    return wearCalc.apply(data, layer.edgeWear!);
  }

  /**
   * Check if material can be used as layer input
   */
  static isCompatible(material: any): material is NodeMaterialInput {
    return material && ('colorNode' in material || 'color' in material);
  }
}
