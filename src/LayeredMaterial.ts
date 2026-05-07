import { MeshPhysicalNodeMaterial } from "three/webgpu";
import { LayerConfig, LayerData, LayeredMaterialOptions } from "./types";
import { MaterialSampler } from "./core/MaterialSampler";
import { LayerBlender } from "./core/LayerBlender";
import { MaskGenerator } from "./core/MaskGenerator";
import { NoiseGenerator } from "./features/noise/NoiseGenerator";
import { NoiseConfig } from "./features/noise/NoiseConfig";
import { vec3, float } from "three/tsl";

type Node = any;


export class LayeredMaterial extends MeshPhysicalNodeMaterial {
  layers: LayerConfig[];
  blendSharpness: number;

  protected sampler: MaterialSampler;
  protected blender: LayerBlender;
  protected maskGen: MaskGenerator;
  protected noiseGen: NoiseGenerator;
  private topologySignature: string;

  constructor(options: LayeredMaterialOptions = {}) {
    super();

    this.layers = options.layers || [];
    this.blendSharpness = options.blendSharpness || 8.0;

    // Initialize subsystems
    this.sampler = new MaterialSampler();
    this.blender = new LayerBlender();
    this.maskGen = new MaskGenerator();
    this.noiseGen = new NoiseGenerator();

    this.topologySignature = this.computeTopologySignature(this.layers);
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

  private applyLayerChanges(forceCompile: boolean = false): void {
    this.setupMaterial();

    const newTopology = this.computeTopologySignature(this.layers);
    if (forceCompile || newTopology !== this.topologySignature) {
      this.needsUpdate = true;
    }
    this.topologySignature = newTopology;
  }

  private computeTopologySignature(layers: LayerConfig[]): string {
    return layers
      .map((layer) => JSON.stringify({
        input: layer.materialInput ? 'material' : (layer.map ? 'map' : 'color'),
        hasColorTexture: !!layer.map?.color,
        hasNormalTexture: !!layer.map?.normal,
        hasRoughnessTexture: !!layer.map?.roughness,
        hasMetalnessTexture: !!layer.map?.metalness,
        hasAOTexture: !!layer.map?.ao,
        hasHeightTexture: !!layer.map?.height,
        hasArmTexture: !!layer.map?.arm,
        colorBlendMode: layer.blendMode?.color ?? 'normal',
        normalBlendMode: layer.blendMode?.normal ?? 'rnb',
        roughnessBlendMode: layer.blendMode?.roughness ?? 'normal',
        metalnessBlendMode: layer.blendMode?.metalness ?? 'normal',
        aoBlendMode: layer.blendMode?.ao ?? 'normal',
        triplanar: !!layer.triplanar?.enable,
        triplanarWorldSpace: layer.triplanar?.enable ? (layer.triplanar.useWorldPosition ?? true) : false,
        textureBombing: !!layer.textureBombing?.enable,
        textureBombingRotation: layer.textureBombing?.enable ? (layer.textureBombing.rotation ?? true) : false,
        textureBombingOffset: layer.textureBombing?.enable ? (layer.textureBombing.offset ?? true) : false,
        parallax: !!layer.parallax?.enable,
        parallaxMethod: layer.parallax?.enable ? (layer.parallax.method ?? 'simple') : 'disabled',
        parallaxSteps: layer.parallax?.enable
          ? (layer.parallax.steps ?? (layer.parallax.method === 'pom' ? 16 : 8))
          : 0,
        parallaxRefinementSteps: layer.parallax?.enable ? (layer.parallax.refinementSteps ?? 0) : 0,
        parallaxReferencePlane: layer.parallax?.enable ? (layer.parallax.referencePlane ?? 0.5) : 0.5,
        screenSpaceDisplacement: !!layer.screenSpaceDisplacement?.enabled,
        screenSpaceDisplacementQuality: layer.screenSpaceDisplacement?.quality ?? 'medium',
        edgeWear: !!layer.edgeWear?.enable,
        edgeWearPattern: layer.edgeWear?.enable ? (layer.edgeWear.wearPattern ?? 'curvature') : 'disabled',
        edgeWearCurvature: layer.edgeWear?.enable ? (layer.edgeWear.curvatureMethod ?? 'normal') : 'disabled',
        edgeWearAffectsMaterial: layer.edgeWear?.enable ? !!layer.edgeWear.affectsMaterial : false,
        edgeWearNoise: layer.edgeWear?.enable ? !!layer.edgeWear.useNoise : false,
        heightBlend: !!layer.heightBlend?.enable,
        hasMask: !!layer.mask,
        maskTexture: !!layer.mask?.map,
        maskChannel: layer.mask?.channel ?? 'r',
        maskInvert: !!layer.mask?.invert,
        maskUseSlope: !!layer.mask?.useSlope,
        maskUseHeight: !!layer.mask?.useHeight,
        maskUseNoise: !!layer.mask?.useNoise,
        maskNoiseType: layer.mask?.useNoise ? (layer.mask.noiseType ?? 'perlin') : 'none',
        maskNoiseOctaves: layer.mask?.useNoise ? (layer.mask.noiseOctaves ?? 1) : 0
      }))
      .join('|');
  }

  private mergeLayerConfig(existing: LayerConfig, config: Partial<LayerConfig>): LayerConfig {
    return {
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
      screenSpaceDisplacement: config.screenSpaceDisplacement !== undefined
        ? { ...(existing.screenSpaceDisplacement || {}), ...config.screenSpaceDisplacement }
        : existing.screenSpaceDisplacement,
      blendMode: config.blendMode !== undefined
        ? { ...(existing.blendMode || {}), ...config.blendMode }
        : existing.blendMode,
      colorTint: config.colorTint !== undefined
        ? { ...(existing.colorTint || { r: 1, g: 1, b: 1 }), ...config.colorTint }
        : existing.colorTint,
    };
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
    this.applyLayerChanges(true);
  }

  removeLayer(index: number): void {
    if (index < 0 || index >= this.layers.length) return;
    this.layers.splice(index, 1);
    this.applyLayerChanges(true);
  }

  /**
   * Insert a layer at a specific index
   * @param index - Position to insert at (0 = bottom, length = top)
   * @param config - Layer configuration
   */
  insertLayer(index: number, config: LayerConfig): void {
    const clampedIndex = Math.max(0, Math.min(index, this.layers.length));
    this.layers.splice(clampedIndex, 0, config);
    this.applyLayerChanges(true);
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
    this.applyLayerChanges(true);
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
    this.applyLayerChanges(true);
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
    if (!existing) return;

    // Deep merge for nested objects to prevent losing config when updating single properties.
    this.layers[index] = this.mergeLayerConfig(existing, config);
    this.applyLayerChanges(false);
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
