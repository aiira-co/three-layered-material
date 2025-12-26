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

  /**
   * Insert a layer at a specific index
   * @param index - Position to insert at (0 = bottom, length = top)
   * @param config - Layer configuration
   */
  insertLayer(index: number, config: LayerConfig): void {
    const clampedIndex = Math.max(0, Math.min(index, this.layers.length));
    this.layers.splice(clampedIndex, 0, config);
    this.setupMaterial();
    this.needsUpdate = true;
  }

  /**
   * Move a layer from one position to another
   * @param fromIndex - Current layer index
   * @param toIndex - Target layer index
   */
  moveLayer(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.layers.length) return;
    if (toIndex < 0 || toIndex >= this.layers.length) return;
    if (fromIndex === toIndex) return;

    const [layer] = this.layers.splice(fromIndex, 1);
    this.layers.splice(toIndex, 0, layer);
    this.setupMaterial();
    this.needsUpdate = true;
  }

  /**
   * Swap two layers
   * @param indexA - First layer index
   * @param indexB - Second layer index
   */
  swapLayers(indexA: number, indexB: number): void {
    if (indexA < 0 || indexA >= this.layers.length) return;
    if (indexB < 0 || indexB >= this.layers.length) return;
    if (indexA === indexB) return;

    const temp = this.layers[indexA];
    this.layers[indexA] = this.layers[indexB];
    this.layers[indexB] = temp;
    this.setupMaterial();
    this.needsUpdate = true;
  }

  /**
   * Get the number of layers
   */
  getLayerCount(): number {
    return this.layers.length;
  }

  /**
   * Get a layer by index
   */
  getLayer(index: number): LayerConfig | undefined {
    return this.layers[index];
  }

  updateLayer(index: number, config: Partial<LayerConfig>): void {
    const existing = this.layers[index];

    // Deep merge for nested objects to prevent losing config when updating single properties
    this.layers[index] = {
      ...existing,
      ...config,
      // Deep merge nested objects - only merge if new config provides the property
      mask: config.mask !== undefined
        ? { ...(existing.mask || {}), ...config.mask }
        : existing.mask,
      map: config.map !== undefined
        ? { ...(existing.map || {}), ...config.map }
        : existing.map,
      edgeWear: config.edgeWear !== undefined
        ? { ...(existing.edgeWear || {}), ...config.edgeWear }
        : existing.edgeWear,
      triplanar: config.triplanar !== undefined
        ? { ...(existing.triplanar || {}), ...config.triplanar }
        : existing.triplanar,
      textureBombing: config.textureBombing !== undefined
        ? { ...(existing.textureBombing || {}), ...config.textureBombing }
        : existing.textureBombing,
      heightBlend: config.heightBlend !== undefined
        ? { ...(existing.heightBlend || {}), ...config.heightBlend }
        : existing.heightBlend,
      parallax: config.parallax !== undefined
        ? { ...(existing.parallax || {}), ...config.parallax }
        : existing.parallax,
      blendMode: config.blendMode !== undefined
        ? { ...(existing.blendMode || {}), ...config.blendMode }
        : existing.blendMode,
      colorTint: config.colorTint !== undefined
        ? { ...(existing.colorTint || { r: 1, g: 1, b: 1 }), ...config.colorTint }
        : existing.colorTint,
    };

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
