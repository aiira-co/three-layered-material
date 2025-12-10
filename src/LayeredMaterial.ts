import { MeshPhysicalNodeMaterial, Node } from "three/webgpu";
import { LayerConfig, LayerData, LayeredMaterialOptions } from "./types";
import { MaterialSampler } from "./core/MaterialSampler";
import { LayerBlender } from "./core/LayerBlender";
import { MaskGenerator } from "./core/MaskGenerator";
import { NoiseGenerator } from "./features/noise/NoiseGenerator";
import { NoiseConfig } from "./features/noise/NoiseConfig";
import { vec3, float, uv } from "three/tsl";

export class LayeredMaterial extends MeshPhysicalNodeMaterial {
  layers: LayerConfig[];
  blendSharpness: number;

  protected sampler: MaterialSampler;
  protected blender: LayerBlender;
  protected maskGen: MaskGenerator;
  protected noiseGen: NoiseGenerator;

  constructor(options: LayeredMaterialOptions = {}) {
    super();

    this.layers = options.layers || [];
    this.blendSharpness = options.blendSharpness || 8.0;

    // Initialize subsystems
    this.sampler = new MaterialSampler();
    this.blender = new LayerBlender();
    this.maskGen = new MaskGenerator();
    this.noiseGen = new NoiseGenerator();

    this.setupMaterial();
  }

  protected setupMaterial(): void {
    const layerBlend = this.buildLayerBlending();

    this.colorNode = layerBlend.color;
    this.normalNode = layerBlend.normal;
    this.roughnessNode = layerBlend.roughness;
    this.metalnessNode = layerBlend.metalness;
    this.aoNode = layerBlend.ao;
  }

  protected buildLayerBlending(): LayerData {
    if (this.layers.length === 0) {
      return this.getDefaultLayer();
    }

    let result = this.sampler.sampleLayer(this.layers[0]);

    for (let i = 1; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const layerData = this.sampler.sampleLayer(layer);
      const mask = this.maskGen.generate(layer);

      result = this.blender.blend(result, layerData, mask, layer);
    }

    return result;
  }

  protected getDefaultLayer(): LayerData {
    return {
      color: vec3(0.8, 0.8, 0.8),
      normal: vec3(0, 0, 1),
      roughness: float(0.5),
      metalness: float(0.0),
      ao: float(1.0)
    };
  }

  // Public API
  addLayer(config: LayerConfig): void {
    this.layers.push(config);
    this.setupMaterial();
    this.needsUpdate = true;
  }

  removeLayer(index: number): void {
    this.layers.splice(index, 1);
    this.setupMaterial();
    this.needsUpdate = true;
  }

  updateLayer(index: number, config: Partial<LayerConfig>): void {
    this.layers[index] = { ...this.layers[index], ...config };
    this.setupMaterial();
    this.needsUpdate = true;
  }

  cloneX(): LayeredMaterial {
    return new LayeredMaterial({
      layers: this.layers.map(l => ({ ...l })),
      blendSharpness: this.blendSharpness
    });
  }

  // Protected helper methods for subclasses
  
  /**
   * Sample a layer configuration into layer data
   * @param layer - Layer configuration to sample
   */
  protected sampleLayer(layer: LayerConfig): LayerData {
    return this.sampler.sampleLayer(layer);
  }

  /**
   * Blend two layers together with a mask
   * @param baseLayer - Base layer data
   * @param topLayer - Top layer data  
   * @param mask - Blend mask node
   * @param config - Layer config for blend modes
   */
  protected blendLayers(
    baseLayer: LayerData,
    topLayer: LayerData,
    mask: Node,
    config: LayerConfig
  ): LayerData {
    return this.blender.blend(baseLayer, topLayer, mask, config);
  }

  /**
   * Generate procedural noise
   * @param uvCoords - UV coordinates for noise generation
   * @param config - Noise configuration
   */
  protected generateNoise(uvCoords: Node, config: NoiseConfig): Node {
    return this.noiseGen.generate(uvCoords, config);
  }

  /**
   * Generate a mask for a layer
   * @param layer - Layer configuration
   */
  protected generateMask(layer: LayerConfig): Node {
    return this.maskGen.generate(layer);
  }
}
