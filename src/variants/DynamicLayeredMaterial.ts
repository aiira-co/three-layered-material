import { float, saturate as tslSaturate } from "three/tsl";
import { LayeredMaterial } from "../LayeredMaterial";
import { Node } from "three/webgpu";
import { LayerConfig, LayeredMaterialOptions } from "../types";

/**
 * Transition between material states (dry/wet, day/night, clean/dirty)
 */
export class DynamicLayeredMaterial extends LayeredMaterial {
  private _sourceLayers: LayerConfig[];
  private _targetLayers: LayerConfig[] = [];
  private _transitionFactor: number = 0;
  private _transitionState: 'idle' | 'transitioning' = 'idle';
  private _transitionSpeed: number = 1.0;
  private _autoUpdate: boolean = false;

  constructor(options: LayeredMaterialOptions & { transitionSpeed?: number; autoUpdate?: boolean } = {}) {
    super(options);

    this._sourceLayers = [...this.layers];
    this._transitionSpeed = options.transitionSpeed || 1.0;
    this._autoUpdate = options.autoUpdate ?? false;
  }

  /**
   * Start transition to target layers
   * @param targetLayers - Target layer configuration
   * @param transitionSpeed - Speed of transition (multiplier)
   */
  startTransition(targetLayers: LayerConfig[], transitionSpeed?: number): void {
    this._targetLayers = targetLayers;
    this._transitionState = 'transitioning';
    if (transitionSpeed !== undefined) {
      this._transitionSpeed = transitionSpeed;
    }
  }

  /**
   * Set transition factor manually (0-1)
   */
  setTransition(targetLayers: LayerConfig[], factor: number): void {
    this._targetLayers = targetLayers;
    this._transitionFactor = Math.max(0, Math.min(1, factor)); // Clamp
    this._transitionState = 'transitioning';

    this.updateBlendedLayers();
  }

  /**
   * Update transition (call this in animation loop if autoUpdate is false)
   */
  update(deltaTime: number): void {
    if (!this._autoUpdate || this._transitionState !== 'transitioning') {
      return;
    }

    this._transitionFactor += deltaTime * this._transitionSpeed;

    if (this._transitionFactor >= 1.0) {
      this._transitionFactor = 1.0;
      this.completeTransition();
    } else {
      this.updateBlendedLayers();
    }
  }

  /**
   * Update the material with blended layers
   */
  private updateBlendedLayers(): void {
    const blendedLayers = this.blendLayerConfigs(
      this._sourceLayers,
      this._targetLayers,
      this._transitionFactor
    );

    this.layers = blendedLayers;
    this.setupMaterial();
    this.needsUpdate = true;
  }

  /**
   * Blend two layer configurations by a factor (0-1)
   */
  private blendLayerConfigs(
    sourceLayers: LayerConfig[],
    targetLayers: LayerConfig[],
    factor: number
  ): LayerConfig[] {
    const blendedLayers: LayerConfig[] = [];
    const maxLayers = Math.max(sourceLayers.length, targetLayers.length);

    for (let i = 0; i < maxLayers; i++) {
      const sourceLayer = sourceLayers[i];
      const targetLayer = targetLayers[i];

      if (!sourceLayer && targetLayer) {
        blendedLayers.push(this.applyLayerOpacity(targetLayer, factor));
      } else if (sourceLayer && !targetLayer) {
        blendedLayers.push(this.applyLayerOpacity(sourceLayer, 1 - factor));
      } else if (sourceLayer && targetLayer) {
        blendedLayers.push(this.blendSingleLayerConfig(sourceLayer, targetLayer, factor));
      }
    }

    return blendedLayers;
  }

  /**
   * Apply opacity to a layer
   */
  private applyLayerOpacity(layer: LayerConfig, opacity: number): LayerConfig {
    if (opacity >= 0.99) return { ...layer };

    return {
      ...layer,
      mask: {
        ...layer.mask,
        constantOpacity: opacity
      }
    };
  }

  /**
   * Blend two individual layer configurations
   */
  private blendSingleLayerConfig(
    source: LayerConfig,
    target: LayerConfig,
    factor: number
  ): LayerConfig {
    // BUG FIX: Deep clone to avoid mutation
    const blended: LayerConfig = {
      name: factor > 0.5 ? target.name : source.name,
      map: factor > 0.5 ? { ...target.map } : { ...source.map },
      scale: this.lerp(source.scale ?? 1, target.scale ?? 1, factor),
      roughness: this.lerp(source.roughness, target.roughness, factor),
      metalness: this.lerp(source.metalness, target.metalness, factor),

      edgeWear: this.blendEdgeWear(source.edgeWear, target.edgeWear, factor),
      triplanar: factor > 0.5 ? { ...target.triplanar } : { ...source.triplanar },
      textureBombing: this.blendTextureBombing(source.textureBombing, target.textureBombing, factor),
      mask: this.blendMask(source.mask, target.mask, factor),
      heightBlend: this.blendHeightBlend(source.heightBlend, target.heightBlend, factor),
      parallax: factor > 0.5 ? { ...target.parallax } : { ...source.parallax },
      blendMode: factor > 0.5 ? target.blendMode : source.blendMode
    };

    return blended;
  }

  // Helper blending methods
  private blendEdgeWear(
    source: LayerConfig['edgeWear'],
    target: LayerConfig['edgeWear'],
    factor: number
  ): LayerConfig['edgeWear'] {
    if (!source && !target) return {};
    const s = source || {};
    const t = target || {};

    return {
      enable: factor > 0.5 ? t.enable : s.enable,
      intensity: this.lerp(s.intensity, t.intensity, factor),
      threshold: this.lerp(s.threshold, t.threshold, factor),
      falloff: this.lerp(s.falloff, t.falloff, factor),
      sharpness: this.lerp(s.sharpness, t.sharpness, factor),
      useNoise: factor > 0.5 ? t.useNoise : s.useNoise,
      color: this.blendRGBColors(s.color, t.color, factor),
      affectsMaterial: factor > 0.5 ? t.affectsMaterial : s.affectsMaterial,
      roughness: this.lerp(s.roughness, t.roughness, factor),
      metalness: this.lerp(s.metalness, t.metalness, factor),
      wearPattern: factor > 0.5 ? t.wearPattern : s.wearPattern,
      curvatureMethod: factor > 0.5 ? t.curvatureMethod : s.curvatureMethod
    };
  }

  private blendTextureBombing(
    source: LayerConfig['textureBombing'],
    target: LayerConfig['textureBombing'],
    factor: number
  ): LayerConfig['textureBombing'] {
    const s = source || {};
    const t = target || {};

    return {
      enable: factor > 0.5 ? t.enable : s.enable,
      blend: this.lerp(s.blend, t.blend, factor)
    };
  }

  private blendMask(
    source: LayerConfig['mask'],
    target: LayerConfig['mask'],
    factor: number
  ): LayerConfig['mask'] {
    const s = source || {};
    const t = target || {};

    return {
      map: factor > 0.5 ? t.map : s.map,
      channel: factor > 0.5 ? t.channel : s.channel,
      invert: factor > 0.5 ? t.invert : s.invert,
      useSlope: factor > 0.5 ? t.useSlope : s.useSlope,
      slopeMin: this.lerp(s.slopeMin, t.slopeMin, factor),
      slopeMax: this.lerp(s.slopeMax, t.slopeMax, factor),
      useHeight: factor > 0.5 ? t.useHeight : s.useHeight,
      heightMin: this.lerp(s.heightMin, t.heightMin, factor),
      heightMax: this.lerp(s.heightMax, t.heightMax, factor),
      useNoise: factor > 0.5 ? t.useNoise : s.useNoise,
      noiseType: factor > 0.5 ? t.noiseType : s.noiseType,
      noiseScale: this.lerp(s.noiseScale, t.noiseScale, factor),
      noiseOctaves: this.lerp(s.noiseOctaves, t.noiseOctaves, factor, true),
      noisePersistence: this.lerp(s.noisePersistence, t.noisePersistence, factor),
      noiseThreshold: this.lerp(s.noiseThreshold, t.noiseThreshold, factor),

      // Special blended properties
      opacityMultiplier: 1.0, // Reset for blended layers
      constantOpacity: undefined // Reset for blended layers
    };
  }

  /**
   * Blend height blend configurations
   */
  private blendHeightBlend(
    source: LayerConfig['heightBlend'],
    target: LayerConfig['heightBlend'],
    factor: number
  ): LayerConfig['heightBlend'] {
    const sourceBlend = source || {};
    const targetBlend = target || {};

    return {
      enable: factor > 0.5 ? targetBlend.enable : sourceBlend.enable,
      strength: this.lerp(sourceBlend.strength, targetBlend.strength, factor),
      sharpness: this.lerp(sourceBlend.sharpness, targetBlend.sharpness, factor)
    };
  }

  /**
   * Linear interpolation between two numbers
   */
  private lerp(a: number | undefined, b: number | undefined, factor: number, round: boolean = false): number | undefined {
    if (a === undefined && b === undefined) return undefined;
    if (a === undefined) return b;
    if (b === undefined) return a;

    const result = a + (b - a) * factor;
    return round ? Math.round(result) : result;
  }

  /**
   * Blend between two RGB colors
   */
  private blendRGBColors(
    source: { r: number; g: number; b: number } | undefined,
    target: { r: number; g: number; b: number } | undefined,
    factor: number
  ): { r: number; g: number; b: number } | undefined {
    if (!source && !target) return undefined;
    if (!source) return target;
    if (!target) return source;

    return {
      r: source.r + (target.r - source.r) * factor,
      g: source.g + (target.g - source.g) * factor,
      b: source.b + (target.b - source.b) * factor
    };
  }

  /**
   * Get current transition progress (0-1)
   */
  getTransitionProgress(): number {
    // Extract numeric value from the Node if it's a float node
    // This is a simplification - in practice you'd need to handle node evaluation
    return typeof this._transitionFactor === 'number'
      ? this._transitionFactor
      : 0.5; // Fallback
  }

  /**
   * Check if material is currently transitioning
   */
  isTransitioning(): boolean {
    return this._transitionState === 'transitioning';
  }

  /**
   * Complete the transition (fully adopt target layers)
   */
  completeTransition(): void {
    this._sourceLayers = [...this._targetLayers];
    this.layers = [...this._targetLayers];
    this._transitionFactor = 0;
    this._transitionState = 'idle';
    this.setupMaterial();
    this.needsUpdate = true;
  }

  /**
   * Cancel transition and revert to source layers
   */
  cancelTransition(): void {
    this.layers = [...this._sourceLayers];
    this._targetLayers = [];
    this._transitionFactor = 0;
    this._transitionState = 'idle';
    this.setupMaterial();
    this.needsUpdate = true;
  }
}



// Create dynamic material
// const dynamicMaterial = new DynamicLayeredMaterial({
//   layers: [
//     {
//       name: 'Dry Ground',
//       map: { color: dryGroundTexture, normal: dryNormalTexture },
//       roughness: 0.9,
//       scale: 0.2,
//       mask: { useSlope: true, slopeMin: 0.0, slopeMax: 0.5 }
//     }
//   ]
// });

// // Define target state (wet ground)
// const wetLayers = [
//   {
//     name: 'Wet Ground',
//     map: { color: wetGroundTexture, normal: wetNormalTexture },
//     roughness: 0.3, // Wet surfaces are smoother
//     scale: 0.15,
//     mask: { useSlope: true, slopeMin: 0.0, slopeMax: 0.8 } // Different slope range
//   }
// ];

// // Start transition over 2 seconds
// let transitionTime = 0;
// function updateTransition(deltaTime: number) {
//   transitionTime += deltaTime;
//   const progress = Math.min(transitionTime / 2, 1); // 2 second transition

//   dynamicMaterial.setTransition(wetLayers, progress);

//   if (progress >= 1) {
//     dynamicMaterial.completeTransition();
//   }
// }

// // Or use for day/night cycle
// const dayLayers = [/* day configuration */];
// const nightLayers = [/* night configuration */];

// function updateDayNightCycle(timeOfDay: number) {
//   // timeOfDay: 0 = midnight, 0.5 = noon, 1 = next midnight
//   const dayFactor = Math.sin(timeOfDay * Math.PI); // 0 at night, 1 at day
//   dynamicMaterial.setTransition(nightLayers, 1 - dayFactor);
// }

// Generate layers algorithmically for variation
// generateProceduralLayers(baseConfig: LayerConfig, variations: number) {
//   const layers = [baseConfig];

//   for (let i = 1; i < variations; i++) {
//     layers.push({
//       ...baseConfig,
//       scale: baseConfig.scale * (0.8 + Math.random() * 0.4),
//       mask: {
//         ...baseConfig.mask,
//         useNoise: true,
//         noiseScale: 2 + Math.random() * 4,
//         noiseThreshold: 0.3 + Math.random() * 0.4
//       }
//     });
//   }

//   this.layers = layers;
// }
