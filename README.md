# Three.js Layered Material System

A **procedural, multi-layer physically based material system** built using **Three.js TSL** and **MeshPhysicalNodeMaterial** that brings Substance Painter-style layering into Three.js runtime.

## 🎯 What It Is

Think of this as **Substance Painter + Gaea terrain shader → inside Three.js**. Each layer is a complete material slice that gets blended together on the GPU with advanced masking, blending, and procedural effects.

### Core Philosophy
- **No shader coding required** - just configure layers via JavaScript
- **Runtime procedural authoring** - modify materials without recompiling shaders
- **Production-ready features** - all the tools you need for complex materials

## 🚀 Quick Start

```typescript
import LayeredMaterial from './LayeredMaterial';
const loader = new THREE.TextureLoader();

const material = new LayeredMaterial({
  layers: [
    {
      name: 'Base Metal',
      map: {
        color: loader.load('metal_color.jpg'),
        normal: loader.load('metal_normal.jpg'),
        roughness: loader.load('metal_roughness.jpg'),
      },
      roughness: 0.3,
      metalness: 0.8,
    },
    {
      name: 'Rust Overlay',
      map: {
        color: loader.load('rust_color.jpg'),
        normal: loader.load('rust_normal.jpg'),
      },
      mask: {
        map: loader.load('rust_mask.png'),
        channel: 'r',
        useNoise: true,
      },
      blendMode: {
        color: 'overlay',
        normal: 'rnb',
      }
    }
  ]
});

// Apply to any mesh
const mesh = new THREE.Mesh(geometry, material);
```

## 🎨 Layer Configuration

Each layer supports these properties:

### Texture Maps
```typescript
map: {
  color?: THREE.Texture,      // Base color
  normal?: THREE.Texture,     // Normal map
  roughness?: THREE.Texture,  // Roughness
  metalness?: THREE.Texture,  // Metalness  
  ao?: THREE.Texture,         // Ambient Occlusion
  height?: THREE.Texture,     // Height map for parallax/blending
  arm?: THREE.Texture,        // Packed ARM (AO/Rough/Metal in RGB)
}
```

### Material Properties
```typescript
scale?: number;              // Texture tiling scale
roughness?: number;          // Fallback roughness (0-1)
metalness?: number;          // Fallback metalness (0-1)
```

## 🎭 Advanced Features

### 1. Edge Wear System
Realistic wear and tear on edges and corners:

```typescript
edgeWear: {
  enable: true,
  intensity: 1.5,           // How much wear to apply
  threshold: 0.1,           // Curvature threshold for wear
  falloff: 0.3,             // Smooth falloff range
  color: {r: 0.8, g: 0.7, b: 0.6}, // Exposed material color
  affectsMaterial: true,     // Also change roughness/metalness
  roughness: 0.2,           // Roughness at worn edges
  metalness: 1.0,           // Metalness at worn edges
  wearPattern: 'curvature', // 'curvature'|'ambient_occlusion'|'world_space'|'combined'
}
```

### 2. Texture Bombing
Eliminate tiling artifacts with stochastic sampling:

```typescript
textureBombing: {
  enable: true,
  blend: 0.6,  // Blend factor between samples (0-1)
}
```

### 3. Triplanar Mapping
Seamless projection on complex geometry:

```typescript
triplanar: {
  enable: true,
  useWorldPosition: true,  // Use world or object space
}
```

### 4. Advanced Masking

#### Slope-Based Masking (Terrain)
```typescript
mask: {
  useSlope: true,
  slopeMin: 0.3,  // Minimum slope angle (0=flat, 1=vertical)
  slopeMax: 0.7,  // Maximum slope angle
}
```

#### Height-Based Masking  
```typescript
mask: {
  useHeight: true,
  heightMin: 0.0,   // Minimum world height
  heightMax: 10.0,  // Maximum world height
}
```

#### Procedural Noise Masking
```typescript
mask: {
  useNoise: true,
  noiseType: 'perlin',  // 'perlin'|'voronoi'|'fbm'
  noiseScale: 2.0,
  noiseOctaves: 4,
  noiseThreshold: 0.5,  // Cutoff for binary masks
}
```

### 5. Blend Modes
Control how layers interact:

```typescript
blendMode: {
  color: 'overlay',      // 'normal'|'multiply'|'overlay'|'screen'|'add'|etc.
  normal: 'rnb',         // 'rnb'|'linear'|'whiteout'|'udn'|'partial_derivative'
  roughness: 'max',      // 'normal'|'min'|'max'|'multiply'|'average'
  metalness: 'min',      // 'normal'|'min'|'max'|'multiply'|'average'
  ao: 'multiply',        // 'normal'|'min'|'max'|'multiply'
}
```

### 6. Height-Based Blending
Use height maps for realistic transitions:

```typescript
heightBlend: {
  enable: true,
  strength: 2.0,     // How much height affects blending
  sharpness: 4.0,    // Sharpness of the blend edge
}
```

### 7. Parallax Occlusion
```typescript
parallax: {
  enable: true,
  scale: 0.1,    // Parallax strength
  steps: 8,      // Raymarching steps (quality)
}
```

## 🎪 Real-World Examples

### Terrain Material
```typescript
const terrainMaterial = new LayeredMaterial({
  layers: [
    {
      name: 'Grass Base',
      map: { color: grassColor, normal: grassNormal, roughness: grassRoughness },
      triplanar: { enable: true },
      textureBombing: { enable: true, blend: 0.6 },
      scale: 0.5,
    },
    {
      name: 'Cliff Rock', 
      map: { color: rockColor, normal: rockNormal, height: rockHeight },
      mask: {
        useSlope: true,
        slopeMin: 0.4,
        slopeMax: 0.8,
        useNoise: true,
        noiseType: 'voronoi',
      },
      heightBlend: { enable: true, strength: 3.0 },
      blendMode: { normal: 'rnb' },
    },
    {
      name: 'Sand Path',
      map: { color: sandColor, normal: sandNormal },
      mask: {
        map: pathMask,
        channel: 'r',
        useNoise: true,
      },
      edgeWear: {
        enable: true,
        intensity: 1.2,
        wearPattern: 'world_space',
      },
    }
  ]
});
```

### Painted Metal with Wear
```typescript
const metalMaterial = new LayeredMaterial({
  layers: [
    {
      name: 'Base Metal',
      map: { color: metalColor, normal: metalNormal, roughness: metalRoughness },
      roughness: 0.1,
      metalness: 0.9,
    },
    {
      name: 'Paint Layer',
      map: { color: paintColor, normal: paintNormal, roughness: paintRoughness },
      mask: { map: paintMask, channel: 'r' },
      edgeWear: {
        enable: true,
        intensity: 2.0,
        color: {r: 0.9, g: 0.8, b: 0.7}, // Worn metal color
        affectsMaterial: true,
        roughness: 0.3,
        metalness: 0.95,
        wearPattern: 'combined',
      },
      blendMode: {
        color: 'normal',
        normal: 'whiteout', // Sharp edges for paint chips
      },
    }
  ]
});
```

## 🔧 Runtime API

### Add/Remove Layers
```typescript
// Add new layer
material.addLayer({
  name: 'New Dirt Layer',
  map: { color: dirtColor, normal: dirtNormal },
  // ... config
});

// Update existing layer
material.updateLayer(1, {
  scale: 2.0,
  roughness: 0.8,
});

// Remove layer
material.removeLayer(0);
```

### Dynamic Modifications
All changes automatically trigger shader recompilation:
```typescript
// Enable/disable features at runtime
material.updateLayer(0, {
  edgeWear: { enable: true, intensity: 1.5 },
  textureBombing: { enable: false },
});

// Change blend modes dynamically
material.updateLayer(1, {
  blendMode: { color: 'multiply', normal: 'linear' }
});
```

## 🎯 Use Cases

### Perfect For:
- **Terrain systems** - Grass, rock, sand, snow layers with slope-based masking
- **Weathered props** - Paint wear, rust, dirt accumulation
- **Architectural materials** - Plaster, brick, concrete with edge wear
- **Vehicle materials** - Paint, dirt, scratches, exposed metal
- **Character materials** - Skin, fabric, armor with layered details

### Solves These Problems:
- ✅ **Tiling artifacts** - Texture bombing breaks up repetition
- ✅ **Seamless complex geometry** - Triplanar mapping
- ✅ **Realistic material transitions** - Height-based blending
- ✅ **Procedural wear and tear** - Curvature-based edge detection
- ✅ **Runtime material authoring** - No shader compilation needed

## 🧠 Mental Model

Think of the pipeline as:

```
Layer 1 → Sample textures → Apply edge wear → Output LayerData
Layer 2 → Sample textures → Apply edge wear → Output LayerData
...

Blender:
Base = Layer 1
For each additional layer:
  Mask = Calculate mask (texture + slope + height + noise)
  Blend = Height-based blend between base and layer using mask
  Base = Result
  
Return final blended material
```

## 🔮 What's Next?

The system is ready for:
- **GUI Inspector** (dat.GUI or Leva integration)
- **Debug Visualizer** - View masks, curvature, wear patterns in real-time  
- **Material Presets** - Common configurations (metal, terrain, fabric)
- **Export System** - Bake final materials to textures

---

## 💡 Pro Tips

1. **Start Simple** - Begin with 2-3 layers and add complexity gradually
2. **Use ARM Maps** - Pack AO/Roughness/Metalness for better performance
3. **Height Maps Matter** - Essential for realistic blending between layers
4. **Noise is Your Friend** - Add organic variation to break up patterns
5. **Test Different Blend Modes** - Each material interaction benefits from different blending approaches

This system gives you the power of offline material authoring tools with the flexibility of real-time procedural generation. No shader expertise required - just creative layer configuration!


---
---

# MaterialVariant Class Documentation

## Overview

The `MaterialVariant` class extends `LayeredMaterial` to create material variations that automatically inherit and sync with a base material while applying custom overrides. Think of it as **"smart material inheritance"** - when the base material changes, all variants automatically update while maintaining their unique customizations.

## Key Features

- 🔄 **Automatic Synchronization**: Variants update when base material changes
- 🎨 **Layer Overrides**: Customize specific properties while inheriting others
- ⚡ **Performance Optimized**: Two implementation strategies available
- 🔧 **Runtime Flexibility**: Update overrides dynamically
- 🎯 **Non-Destructive**: Base material remains unchanged

## Installation & Import

```typescript
import { MaterialVariant, ObservableLayeredMaterial, ObservableMaterialVariant } from './material-variant';
import LayeredMaterial from './layered-material';
```

## Basic Usage

### Creating a Simple Variant

```typescript
// Create base material
const baseMaterial = new LayeredMaterial({
  layers: [
    {
      name: 'Ground',
      map: { color: groundTexture, normal: groundNormal },
      scale: 1.0,
      roughness: 0.8,
      metalness: 0.0
    },
    {
      name: 'Grass', 
      map: { color: grassTexture, normal: grassNormal },
      scale: 0.5,
      roughness: 0.9,
      metalness: 0.0
    }
  ]
});

// Create variant with overrides
const dryGroundVariant = new MaterialVariant(baseMaterial, [
  {
    // Override ground layer
    scale: 2.0,           // Double the scale
    roughness: 0.95,      // Make drier/more rough
    metalness: 0.1        // Slight metallic sheen
  },
  {
    // Override grass layer  
    scale: 0.3,           // Smaller grass pattern
    roughness: 0.7        // Less rough grass
  }
]);

// Apply to mesh
const terrainMesh = new THREE.Mesh(geometry, dryGroundVariant);
```

### Observable Variant (Recommended)

```typescript
// Use ObservableLayeredMaterial for better performance
const observableBase = new ObservableLayeredMaterial({
  layers: [/* your layers */]
});

const observableVariant = new ObservableMaterialVariant(observableBase, [
  { scale: 2.0, roughness: 0.9 },
  { metalness: 0.2 }
]);
```

## API Reference

### Constructor

```typescript
new MaterialVariant(baseMaterial: LayeredMaterial, overrides: Partial<LayerConfig>[])
```

**Parameters:**
- `baseMaterial`: The source `LayeredMaterial` to inherit from
- `overrides`: Array of partial layer configurations (one per base layer)

**Example:**
```typescript
const variant = new MaterialVariant(baseMaterial, [
  { scale: 2.0 },           // Override layer 0 scale
  { roughness: 0.5 },       // Override layer 1 roughness
  {},                       // No override for layer 2 (if exists)
  { metalness: 0.8 }        // Override layer 3 metalness
]);
```

### Instance Methods

#### `setOverrides(overrides: Partial<LayerConfig>[])`

Update all overrides at once.

```typescript
// Change all overrides
variant.setOverrides([
  { scale: 3.0, roughness: 0.3 },
  { metalness: 0.5, scale: 0.8 }
]);
```

#### `updateOverride(layerIndex: number, override: Partial<LayerConfig>)`

Update a specific layer's override.

```typescript
// Update only the ground layer
variant.updateOverride(0, {
  scale: 1.5,
  roughness: 0.6
});

// Add override to a new layer
variant.updateOverride(2, {
  metalness: 0.3
});
```

#### `getOverrides(): Partial<LayerConfig>[]`

Get current overrides array.

```typescript
const currentOverrides = variant.getOverrides();
console.log(currentOverrides[0].scale); // 2.0
```

#### `getBaseMaterial(): LayeredMaterial`

Get the base material instance.

```typescript
const base = variant.getBaseMaterial();
base.addLayer(newLayerConfig); // Variant will auto-update
```

#### `clone(): MaterialVariant`

Create a deep clone of the variant.

```typescript
const variantCopy = variant.clone();
```

#### `dispose(): void`

Clean up resources and listeners.

```typescript
variant.dispose();
```

## Advanced Usage Patterns

### 1. Material Presets System

```typescript
// Define material presets
const MaterialPresets = {
  DRY: [
    { scale: 2.0, roughness: 0.95 },
    { scale: 0.3, roughness: 0.7 }
  ],
  WET: [
    { scale: 0.8, roughness: 0.3 },
    { scale: 0.6, roughness: 0.2 }
  ],
  SNOWY: [
    { scale: 1.2, roughness: 0.4 },
    { scale: 0.4, roughness: 0.3 }
  ]
};

// Create variant and apply preset
const weatherVariant = new MaterialVariant(baseMaterial, MaterialPresets.DRY);

// Change weather dynamically
function setWeather(weatherType: 'DRY' | 'WET' | 'SNOWY') {
  weatherVariant.setOverrides(MaterialPresets[weatherType]);
}
```

### 2. Progressive Material Wear

```typescript
class WearableMaterialVariant extends MaterialVariant {
  private wearLevel: number = 0;
  
  setWear(level: number) {
    this.wearLevel = level;
    
    // Increase roughness and reduce scale with wear
    this.setOverrides([
      {
        scale: 1.0 + level * 0.5,      // Pattern stretches with wear
        roughness: 0.8 + level * 0.2,  // Gets rougher
        metalness: level * 0.5         // Metal shows through
      },
      {
        scale: 0.5 - level * 0.2,      // Grass thins out
        roughness: 0.9 + level * 0.1
      }
    ]);
  }
}
```

### 3. Seasonal Material Transitions

```typescript
class SeasonalMaterialVariant extends MaterialVariant {
  private seasonProgress: number = 0; // 0 = spring, 0.25 = summer, etc.
  
  updateSeason(progress: number) {
    this.seasonProgress = progress;
    
    // Spring to Summer transition
    const springToSummer = this.interpolateOverrides(
      [
        { scale: 1.0, roughness: 0.8 },  // Spring
        { scale: 0.5, roughness: 0.6 }   // Summer grass
      ],
      [
        { scale: 0.8, roughness: 0.7 },  // Summer
        { scale: 0.3, roughness: 0.9 }   // Dry summer grass
      ],
      progress * 4 // Scale to spring-summer range
    );
    
    this.setOverrides(springToSummer);
  }
  
  private interpolateOverrides(
    start: Partial<LayerConfig>[], 
    end: Partial<LayerConfig>[], 
    factor: number
  ): Partial<LayerConfig>[] {
    // Implementation for smooth interpolation between override sets
    return start.map((startOverride, i) => ({
      ...this.lerpOverride(startOverride, end[i] || {}, factor)
    }));
  }
}
```

### 4. Multi-Variant Management

```typescript
class MaterialVariantManager {
  private variants = new Map<string, MaterialVariant>();
  private baseMaterial: LayeredMaterial;
  
  constructor(baseMaterial: LayeredMaterial) {
    this.baseMaterial = baseMaterial;
  }
  
  createVariant(name: string, overrides: Partial<LayerConfig>[]): MaterialVariant {
    const variant = new MaterialVariant(this.baseMaterial, overrides);
    this.variants.set(name, variant);
    return variant;
  }
  
  getVariant(name: string): MaterialVariant | undefined {
    return this.variants.get(name);
  }
  
  updateAllVariants(): void {
    // Force update all variants (useful after base material changes)
    this.variants.forEach(variant => {
      variant.setOverrides(variant.getOverrides());
    });
  }
}

// Usage
const manager = new MaterialVariantManager(baseMaterial);
manager.createVariant('dry', [{ scale: 2.0, roughness: 0.9 }]);
manager.createVariant('wet', [{ scale: 0.8, roughness: 0.3 }]);

const dryVariant = manager.getVariant('dry');
```

## Real-World Examples

### 1. Terrain Biome Variants

```typescript
// Base terrain material
const baseTerrain = new LayeredMaterial({
  layers: [
    { name: 'Soil', map: { color: soilTexture }, scale: 1.0 },
    { name: 'Grass', map: { color: grassTexture }, scale: 0.5 },
    { name: 'Rock', map: { color: rockTexture }, scale: 0.3 }
  ]
});

// Biome variants
const forestVariant = new MaterialVariant(baseTerrain, [
  { scale: 1.2 },  // Rich soil
  { scale: 0.8 },  // Dense grass
  { scale: 0.1 }   // Few rocks
]);

const desertVariant = new MaterialVariant(baseTerrain, [
  { scale: 0.6 },  // Sandy soil
  { scale: 0.1 },  // Sparse grass
  { scale: 0.8 }   // Many rocks
]);

const arcticVariant = new MaterialVariant(baseTerrain, [
  { scale: 0.3 },  // Frozen ground
  { scale: 0.0 },  // No grass
  { scale: 0.5 }   // Ice-covered rocks
]);
```

### 2. Building Material Aging

```typescript
// Base building material
const newBuilding = new LayeredMaterial({
  layers: [
    { name: 'Paint', map: { color: freshPaint }, roughness: 0.3 },
    { name: 'Concrete', map: { color: cleanConcrete }, roughness: 0.5 }
  ]
});

// Age variants
const aged5Years = new MaterialVariant(newBuilding, [
  { roughness: 0.5 },  // Paint faded
  { roughness: 0.6 }   // Concrete weathered
]);

const aged20Years = new MaterialVariant(newBuilding, [
  { roughness: 0.8 },  // Paint heavily worn
  { roughness: 0.9 }   // Concrete eroded
]);
```

### 3. Character Material Variants

```typescript
// Base character material
const baseCharacter = new LayeredMaterial({
  layers: [
    { name: 'Skin', map: { color: baseSkin }, roughness: 0.4 },
    { name: 'Clothing', map: { color: baseClothing }, roughness: 0.6 }
  ]
});

// Character state variants
const healthyVariant = new MaterialVariant(baseCharacter, [
  { /* Default skin */ },
  { /* Default clothing */ }
]);

const injuredVariant = new MaterialVariant(baseCharacter, [
  { 
    map: { color: paleSkinTexture }, // Pale when injured
    roughness: 0.6                   // Sweaty skin
  },
  {
    map: { color: bloodStainedTexture }, // Blood on clothing
    roughness: 0.8                       // Rough from damage
  }
]);

const poweredUpVariant = new MaterialVariant(baseCharacter, [
  {
    map: { color: glowingSkinTexture }, // Glowing effect
    roughness: 0.2                      // Smooth, energized
  }
]);
```

## Performance Considerations

### 1. Use Observable Variants When Possible

```typescript
// ✅ Good - More efficient
const observableBase = new ObservableLayeredMaterial({ layers: [] });
const observableVariant = new ObservableMaterialVariant(observableBase, overrides);

// ⚠️ Acceptable - Less efficient but works with any LayeredMaterial  
const regularVariant = new MaterialVariant(anyBaseMaterial, overrides);
```

### 2. Batch Override Updates

```typescript
// ✅ Good - Single update
variant.setOverrides(newOverrides);

// ❌ Avoid - Multiple updates
variant.updateOverride(0, { scale: 2.0 });
variant.updateOverride(1, { roughness: 0.5 });
variant.updateOverride(2, { metalness: 0.3 });
```

### 3. Limit Variant Count

```typescript
// For high-performance scenarios, consider:
class MaterialVariantPool {
  private pool: MaterialVariant[] = [];
  
  getVariant(base: LayeredMaterial, overrides: Partial<LayerConfig>[]): MaterialVariant {
    let variant = this.pool.find(v => 
      v.getBaseMaterial() === base && 
      JSON.stringify(v.getOverrides()) === JSON.stringify(overrides)
    );
    
    if (!variant) {
      variant = new MaterialVariant(base, overrides);
      this.pool.push(variant);
    }
    
    return variant;
  }
}
```

## Common Pitfalls

### 1. Circular References

```typescript
// ❌ Don't create variants of variants
const variant1 = new MaterialVariant(base, overrides1);
const variant2 = new MaterialVariant(variant1, overrides2); // Avoid

// ✅ Create all variants from the same base
const variant1 = new MaterialVariant(base, overrides1);
const variant2 = new MaterialVariant(base, overrides2);
```

### 2. Memory Leaks

```typescript
// Always dispose variants when no longer needed
const variant = new MaterialVariant(base, overrides);

// When done with variant:
variant.dispose();
```

### 3. Override Specificity

```typescript
// ✅ Clear what gets overridden
const overrides = [
  { scale: 2.0, roughness: 0.8 },    // Override scale and roughness
  { metalness: 0.5 }                 // Override only metalness
];

// ❌ Unclear overrides
const confusingOverrides = [
  { scale: 2.0 },
  { /* Empty - but is this intentional? */ }
];
```

## Migration Tips

### From Manual Material Copying

**Before:**
```typescript
// Manual copying (error-prone)
const variantLayers = JSON.parse(JSON.stringify(baseMaterial.layers));
variantLayers[0].scale = 2.0;
const variant = new LayeredMaterial({ layers: variantLayers });

// Need to manually update when base changes? 😥
```

**After:**
```typescript
// Automatic synchronization
const variant = new MaterialVariant(baseMaterial, [
  { scale: 2.0 }
]);
// Automatically updates when base changes! 🎉
```

The `MaterialVariant` system provides a robust way to create material variations that stay in sync with their base, reducing bugs and making your material system more maintainable and dynamic!





# DynamicLayeredMaterial Class Documentation

## Overview

The `DynamicLayeredMaterial` enables **real-time material transitions** between different material states. It allows you to smoothly blend from a source material configuration to a target configuration, perfect for dynamic environments, weather effects, time-of-day changes, and material state transitions.

## Key Features

- 🌊 **Smooth Transitions**: Interpolate between material states with full control
- ⏱️ **Temporal Control**: Control transition speed and timing
- 🎨 **Property Interpolation**: Different interpolation strategies per property type
- 🔄 **State Management**: Track transition progress and state
- 🚀 **Runtime Flexibility**: Start, cancel, or modify transitions at any time

## Basic Usage

### Creating a Dynamic Material

```typescript
import { DynamicLayeredMaterial } from './dynamic-layered-material';

// Create dynamic material with initial state
const dynamicMaterial = new DynamicLayeredMaterial({
  layers: [
    {
      name: 'Ground',
      map: { color: dryGroundTexture, normal: groundNormal },
      scale: 1.0,
      roughness: 0.8,
      metalness: 0.0
    }
  ]
});
```

### Simple Transition

```typescript
// Define target state
const wetGroundConfig = [
  {
    name: 'Wet Ground',
    map: { color: wetGroundTexture, normal: wetGroundNormal },
    scale: 0.8,
    roughness: 0.3,  // Wet surfaces are smoother
    metalness: 0.1   // Water reflection effect
  }
];

// Start transition over 3 seconds
dynamicMaterial.setTransition(wetGroundConfig, 0.5); // 50% progress

// Complete transition
setTimeout(() => {
  dynamicMaterial.setTransition(wetGroundConfig, 1.0); // 100% complete
}, 3000);
```

## API Reference

### Constructor

```typescript
new DynamicLayeredMaterial(options: LayeredMaterialOptions)
```

**Parameters:**
- `options`: Standard `LayeredMaterial` options for initial state

**Example:**
```typescript
const material = new DynamicLayeredMaterial({
  layers: [
    { name: 'Base', map: { color: baseColor }, roughness: 0.5 }
  ],
  blendSharpness: 8.0
});
```

### Instance Methods

#### `setTransition(targetLayers: LayerConfig[], factor: number): void`

Start or update a transition to target layers.

**Parameters:**
- `targetLayers`: Array of layer configurations for the target state
- `factor`: Transition progress (0 = source, 1 = target)

**Example:**
```typescript
// Gradual transition over time
let progress = 0;
function updateTransition() {
  progress += 0.01;
  material.setTransition(targetLayers, progress);
  if (progress < 1) requestAnimationFrame(updateTransition);
}
updateTransition();
```

#### `completeTransition(): void`

Immediately complete the current transition.

```typescript
// Snap to target state
material.completeTransition();
```

#### `cancelTransition(): void`

Cancel current transition and revert to source state.

```typescript
// Abort transition
material.cancelTransition();
```

#### `getTransitionProgress(): number`

Get current transition progress (0-1).

```typescript
const progress = material.getTransitionProgress();
console.log(`Transition ${(progress * 100).toFixed(1)}% complete`);
```

#### `isTransitioning(): boolean`

Check if material is currently transitioning.

```typescript
if (material.isTransitioning()) {
  console.log('Material is currently changing');
}
```

## Advanced Usage

### 1. Weather System Transitions

```typescript
class WeatherMaterialSystem {
  private material: DynamicLayeredMaterial;
  private currentWeather: string = 'clear';
  
  constructor() {
    this.material = new DynamicLayeredMaterial({
      layers: [
        {
          name: 'Terrain',
          map: { color: clearTerrainTexture, normal: terrainNormal },
          scale: 1.0,
          roughness: 0.7
        },
        {
          name: 'Vegetation',
          map: { color: clearVegetationTexture },
          scale: 0.5,
          roughness: 0.9
        }
      ]
    });
  }
  
  setWeather(weatherType: 'clear' | 'rainy' | 'snowy', duration: number = 5) {
    const targetConfig = this.getWeatherConfig(weatherType);
    this.currentWeather = weatherType;
    
    // Animate transition
    this.animateTransition(targetConfig, duration);
  }
  
  private getWeatherConfig(weatherType: string): LayerConfig[] {
    const configs = {
      clear: [
        { scale: 1.0, roughness: 0.7, metalness: 0.0 },
        { scale: 0.5, roughness: 0.9 }
      ],
      rainy: [
        { 
          scale: 0.8, 
          roughness: 0.3,  // Wet surfaces are smoother
          metalness: 0.2   // Water reflections
        },
        {
          scale: 0.6,
          roughness: 0.4   // Wet vegetation
        }
      ],
      snowy: [
        {
          scale: 1.2,
          roughness: 0.2,  // Smooth snow
          metalness: 0.0
        },
        {
          scale: 0.1,      // Less visible vegetation
          roughness: 0.3
        }
      ]
    };
    
    return configs[weatherType];
  }
  
  private animateTransition(targetConfig: LayerConfig[], duration: number) {
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;
    
    const update = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      
      this.material.setTransition(targetConfig, progress);
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        this.material.completeTransition();
      }
    };
    
    update();
  }
}

// Usage
const weatherSystem = new WeatherMaterialSystem();
weatherSystem.setWeather('rainy', 3); // Transition to rainy over 3 seconds
```

### 2. Time-of-Day System

```typescript
class TimeOfDayMaterial extends DynamicLayeredMaterial {
  private time: number = 0; // 0-1, where 0=midnight, 0.5=noon
  
  constructor() {
    super({
      layers: [
        {
          name: 'Day Material',
          map: { color: dayTexture, normal: dayNormal },
          roughness: 0.6,
          metalness: 0.0
        }
      ]
    });
  }
  
  setTimeOfDay(time: number) {
    this.time = time;
    
    // Calculate day/night blend factor
    const dayFactor = Math.sin(time * Math.PI); // 0 at night, 1 at day
    
    const nightConfig = [
      {
        map: { color: nightTexture, normal: nightNormal },
        roughness: 0.8,    // Rougher at night (dew, moisture)
        metalness: 0.1     // Slight metallic for moonlight
      }
    ];
    
    this.setTransition(nightConfig, 1 - dayFactor);
  }
  
  update(deltaTime: number) {
    // Advance time (1 unit = 24 hours)
    this.time += deltaTime / (24 * 60 * 60); 
    this.time %= 1;
    
    this.setTimeOfDay(this.time);
  }
}

// Usage in game loop
const timeMaterial = new TimeOfDayMaterial();
function gameLoop(deltaTime: number) {
  timeMaterial.update(deltaTime);
}
```

### 3. Damage & Wear Progression

```typescript
class DamageableMaterial extends DynamicLayeredMaterial {
  private health: number = 1.0;
  
  constructor() {
    super({
      layers: [
        {
          name: 'Healthy Material',
          map: { color: healthyTexture, normal: healthyNormal },
          roughness: 0.3,
          metalness: 0.0,
          edgeWear: {
            enable: true,
            intensity: 0.5,
            threshold: 0.1
          }
        }
      ]
    });
  }
  
  takeDamage(damage: number) {
    this.health = Math.max(0, this.health - damage);
    this.updateMaterialState();
  }
  
  repair(amount: number) {
    this.health = Math.min(1, this.health + amount);
    this.updateMaterialState();
  }
  
  private updateMaterialState() {
    const damagedConfig = [
      {
        roughness: 0.3 + (1 - this.health) * 0.6, // 0.3 to 0.9
        metalness: (1 - this.health) * 0.8,        // 0.0 to 0.8
        edgeWear: {
          enable: true,
          intensity: 0.5 + (1 - this.health) * 2.0, // 0.5 to 2.5
          threshold: 0.1 - (1 - this.health) * 0.08, // 0.1 to 0.02
          color: { 
            r: 0.7 + (1 - this.health) * 0.3, 
            g: 0.6, 
            b: 0.5 - (1 - this.health) * 0.3 
          }
        }
      }
    ];
    
    this.setTransition(damagedConfig, 1 - this.health);
  }
}

// Usage
const armorMaterial = new DamageableMaterial();
armorMaterial.takeDamage(0.3); // 30% damaged
armorMaterial.repair(0.1);     // Repair 10%
```

### 4. Seasonal Transitions

```typescript
class SeasonalMaterial extends DynamicLayeredMaterial {
  private season: number = 0; // 0=spring, 1=summer, 2=autumn, 3=winter
  
  constructor() {
    super({
      layers: [
        {
          name: 'Spring Ground',
          map: { color: springGroundTexture },
          scale: 1.0,
          roughness: 0.6
        },
        {
          name: 'Spring Vegetation',
          map: { color: springVegetationTexture },
          scale: 0.5,
          roughness: 0.8
        }
      ]
    });
  }
  
  setSeason(season: number, transitionDuration: number = 10) {
    const targetConfig = this.getSeasonConfig(season);
    
    // Animate seasonal transition
    this.animateSeasonTransition(targetConfig, transitionDuration);
    this.season = season;
  }
  
  private getSeasonConfig(season: number): LayerConfig[] {
    const seasons = {
      0: [ // Spring
        { scale: 1.0, roughness: 0.6 },
        { scale: 0.5, roughness: 0.8 }
      ],
      1: [ // Summer
        { scale: 0.8, roughness: 0.7 },
        { scale: 0.7, roughness: 0.9 }
      ],
      2: [ // Autumn
        { scale: 1.2, roughness: 0.8 },
        { 
          scale: 0.4, 
          roughness: 0.7,
          map: { color: autumnVegetationTexture } // Different texture
        }
      ],
      3: [ // Winter
        { scale: 1.5, roughness: 0.3 },
        { scale: 0.1, roughness: 0.4 }
      ]
    };
    
    return seasons[season];
  }
  
  private animateSeasonTransition(targetConfig: LayerConfig[], duration: number) {
    let progress = 0;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      progress = Math.min(elapsed / duration, 1);
      
      this.setTransition(targetConfig, progress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.completeTransition();
      }
    };
    
    animate();
  }
}

// Usage
const seasonalMaterial = new SeasonalMaterial();
seasonalMaterial.setSeason(2, 5); // Transition to autumn over 5 seconds
```

### 5. Interactive Material States

```typescript
class InteractiveMaterial extends DynamicLayeredMaterial {
  private states: Map<string, LayerConfig[]> = new Map();
  private currentState: string = 'default';
  
  constructor() {
    super({ layers: [] });
    this.initializeStates();
  }
  
  private initializeStates() {
    // Define different material states
    this.states.set('default', [
      { name: 'Default', map: { color: defaultTexture }, roughness: 0.5 }
    ]);
    
    this.states.set('highlighted', [
      { 
        name: 'Highlighted', 
        map: { color: highlightedTexture }, 
        roughness: 0.3,
        metalness: 0.2 
      }
    ]);
    
    this.states.set('selected', [
      { 
        name: 'Selected', 
        map: { color: selectedTexture }, 
        roughness: 0.2,
        metalness: 0.4 
      }
    ]);
    
    this.states.set('disabled', [
      { 
        name: 'Disabled', 
        map: { color: disabledTexture }, 
        roughness: 0.8,
        metalness: 0.0 
      }
    ]);
  }
  
  setState(state: string, instant: boolean = false) {
    const targetConfig = this.states.get(state);
    if (!targetConfig) return;
    
    this.currentState = state;
    
    if (instant) {
      this.completeTransition();
      this.setTransition(targetConfig, 1.0);
    } else {
      // Smooth transition
      this.animateStateTransition(targetConfig);
    }
  }
  
  private animateStateTransition(targetConfig: LayerConfig[]) {
    let progress = 0;
    
    const animate = () => {
      progress += 0.05;
      this.setTransition(targetConfig, progress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.completeTransition();
      }
    };
    
    animate();
  }
  
  getCurrentState(): string {
    return this.currentState;
  }
}

// Usage
const interactiveMaterial = new InteractiveMaterial();
interactiveMaterial.setState('highlighted'); // Smooth highlight
interactiveMaterial.setState('selected', true); // Instant selection
```

## Performance Considerations

### 1. Transition Optimization

```typescript
// ✅ Good - Batch transitions
material.setTransition(targetConfig, progress);

// ❌ Avoid - Rapid small updates
for (let i = 0; i <= 100; i++) {
  material.setTransition(targetConfig, i / 100);
}

// ✅ Better - Throttled updates
let lastUpdate = 0;
function updateTransition(progress: number) {
  const now = Date.now();
  if (now - lastUpdate > 16) { // ~60fps
    material.setTransition(targetConfig, progress);
    lastUpdate = now;
  }
}
```

### 2. Texture Management

```typescript
class OptimizedDynamicMaterial extends DynamicLayeredMaterial {
  private textureCache: Map<string, THREE.Texture> = new Map();
  
  preloadTextures(configs: LayerConfig[][]) {
    configs.forEach(config => {
      config.forEach(layer => {
        if (layer.map?.color) {
          this.cacheTexture(layer.map.color);
        }
        // Cache other textures...
      });
    });
  }
  
  private cacheTexture(texture: THREE.Texture) {
    const key = texture.uuid;
    if (!this.textureCache.has(key)) {
      this.textureCache.set(key, texture);
    }
  }
}

// Preload all transition states
const material = new OptimizedDynamicMaterial({ layers: initialConfig });
material.preloadTextures([sunnyConfig, rainyConfig, snowyConfig]);
```

### 3. Memory Management

```typescript
// Clean up when done
material.dispose();

// Monitor transition states
const transitionCount = /* count active transitions */;
if (transitionCount > 10) {
  console.warn('Too many simultaneous transitions');
}
```

## Common Patterns

### 1. Cyclic Transitions

```typescript
class CyclicMaterial extends DynamicLayeredMaterial {
  private cycleConfigs: LayerConfig[][];
  private currentCycle: number = 0;
  
  startCycling(interval: number = 2000) {
    setInterval(() => {
      this.currentCycle = (this.currentCycle + 1) % this.cycleConfigs.length;
      this.setTransition(this.cycleConfigs[this.currentCycle], 1);
    }, interval);
  }
}
```

### 2. Trigger-Based Transitions

```typescript
class TriggerMaterial extends DynamicLayeredMaterial {
  private triggers: Map<string, { config: LayerConfig[], duration: number }> = new Map();
  
  addTrigger(name: string, config: LayerConfig[], duration: number = 1) {
    this.triggers.set(name, { config, duration });
  }
  
  trigger(name: string) {
    const trigger = this.triggers.get(name);
    if (trigger) {
      this.animateTransition(trigger.config, trigger.duration);
    }
  }
}

// Usage
material.addTrigger('hit', hitConfig, 0.5);
material.addTrigger('powerup', powerupConfig, 2.0);

// Trigger effects
material.trigger('hit');     // Quick hit effect
material.trigger('powerup'); // Longer powerup effect
```

### 3. Layered Transitions

```typescript
class LayeredTransitionMaterial extends DynamicLayeredMaterial {
  private activeTransitions: Map<string, number> = new Map();
  
  addLayerTransition(layerId: string, targetConfig: LayerConfig[], progress: number) {
    this.activeTransitions.set(layerId, progress);
    this.updateCombinedTransition();
  }
  
  private updateCombinedTransition() {
    // Combine multiple layer transitions
    const combinedConfig = /* merge based on activeTransitions */;
    this.setTransition(combinedConfig, 1.0);
  }
}
```

The `DynamicLayeredMaterial` transforms static materials into living, breathing surfaces that can respond to game events, environmental changes, and player interactions in real-time!







## 🎯 **Purpose & Behavior**

### **Decals**
- **Purpose**: Surface applications that sit **on top** of the material
- **Behavior**: Like stickers, paint, logos, or temporary markings
- **Relationship**: **Additive** - they add new visual elements
- **Examples**: 
  - Company logos on vehicles
  - Graffiti on walls
  - Temporary paint markings
  - Blood splatters (in games)
  - Mud splashes

### **Damages**
- **Purpose**: Surface alterations that **reveal underlying** materials
- **Behavior**: Like wear, erosion, or material removal
- **Relationship**: **Subtractive/Revealing** - they expose what's underneath
- **Examples**:
  - Scratches showing metal under paint
  - Worn edges revealing wood under varnish
  - Corrosion eating through surfaces
  - Cracks exposing interior materials

## 🔧 **Technical Differences**

### **Decals**
```typescript
// Decals typically BLEND or OVERWRITE
blendMode: {
  color: 'normal',     // Complete color replacement
  normal: 'normal',    // Overwrite normals
  roughness: 'normal', // Direct replacement
}
// Result: Decal appears ON TOP of existing material
```

### **Damages**
```typescript
// Damages typically REVEAL or MODIFY
blendMode: {
  color: 'multiply',   // Darken or reveal underlying
  normal: 'rnb',       // Blend normals to show depth
  roughness: 'max',    // Make areas rougher
}
// Result: Damage shows WHAT'S UNDERNEATH existing material
```

## 🎨 **Visual Characteristics**

### **Decals**
- **Opacity**: Usually opaque or semi-transparent
- **Edges**: Sharp or soft, but clearly defined boundaries
- **Depth**: Sit on the surface plane
- **Interaction**: Don't affect underlying material properties much

### **Damages**
- **Opacity**: Often reveal completely different materials
- **Edges**: Organic, irregular, based on wear patterns
- **Depth**: Show actual material depth (scratches, dents)
- **Interaction**: Significantly alter material properties (roughness, metalness)

## ⏱️ **Temporal Behavior**

### **Decals**
```typescript
// Often temporary or removable
{
  lifetime: 30,        // Fades after 30 seconds
  fadeStartTime: Date.now(),
  priority: 1          // Can be layered
}
```

### **Damages**
```typescript
// Often permanent or slowly healing
{
  permanent: false,
  healRate: 0.02,      // Very slow natural healing
  intensity: 0.8       // Current damage level
}
```

## 🎪 **Real-World Examples**

### **Decals in Action:**
```typescript
// Adding a racing stripe to a car
material.addDecal({
  position: new THREE.Vector3(0, 1.2, 0),
  size: new THREE.Vector3(2, 0.1, 0.1),
  layer: {
    map: { color: racingStripeTexture },
    // Doesn't change the car's material properties
  }
});

// Adding a temporary mud splatter
material.addDecal({
  position: new THREE.Vector3(0, 0.5, -1),
  lifetime: 60, // Washes off after 60 seconds
  layer: {
    map: { color: mudTexture, roughness: mudRoughness },
    // Mud sits on top of existing paint
  }
});
```

### **Damages in Action:**
```typescript
// Adding wear on door edges
material.addDamage({
  type: 'scratch',
  position: new THREE.Vector3(0.8, 0.5, 0),
  layer: {
    map: { 
      color: exposedMetalColor,  // Shows metal under paint
      roughness: scratchedRoughness, // Rougher than paint
      metalness: 0.8             // Metal is more metallic
    },
    // Actually changes the material properties
  }
});

// Adding corrosion damage
material.addDamage({
  type: 'corrosion',
  position: new THREE.Vector3(-0.5, 0.3, 0),
  layer: {
    map: {
      color: rustColor,          // Rust replaces paint
      normal: corrodedNormal,    // Pitted surface
      roughness: 0.9            // Very rough corroded surface
    },
    // Permanently alters the material
  }
});
```

## 🔄 **Material Interaction**

### **Decals**
```
Base Material → Decal Applied
[Paint] + [Logo] = [Paint with Logo on top]
Properties mostly unchanged
```

### **Damages**
```
Base Material → Damage Applied  
[Paint over Metal] + [Scratch] = [Paint with Metal showing through]
Properties significantly changed in damaged areas
```

## 🎮 **Game Context Examples**

### **Decals (Temporary Effects):**
- **Blood splatters** after combat
- **Bullet impact marks** on walls
- **Footprints** in snow/mud
- **Temporary spray paint**
- **Projected light patterns**

### **Damages (Permanent Changes):**
- **Armor wear** showing underlying metal
- **Weapon scratches** from usage
- **Vehicle denting** from collisions
- **Building erosion** from weather
- **Character scarring** from injuries

## 💡 **When to Use Which**

### **Use Decals When:**
- Adding temporary visual elements
- Applying surface markings that don't alter material
- Need quick runtime application/removal
- Want layered visual effects (multiple decals)

### **Use Damages When:**
- Showing material wear and aging
- Revealing underlying material layers
- Creating permanent surface alterations
- Simulating physical erosion or destruction

## 🔧 **Hybrid Approach**

Sometimes you might use both together:
```typescript
// A bullet hole might be both:
// - A decal (the impact mark on the surface)
// - A damage (the exposed material underneath)

// Impact decal (surface marking)
material.addDecal({
  position: bulletHitPos,
  layer: { map: { color: impactSmoke } },
  lifetime: 5
});

// Structural damage (material alteration)  
material.addDamage({
  type: 'bullet',
  position: bulletHitPos,
  layer: { 
    map: { 
      color: exposedMetalColor,
      roughness: 0.9,
      metalness: 0.8
    }
  },
  permanent: true
});
```

## 🎯 **Quick Reference**

| Aspect | Decals | Damages |
|--------|---------|----------|
| **Purpose** | Add surface elements | Reveal underlying materials |
| **Blending** | Normal/Overlay | Multiply/Reveal |
| **Duration** | Often temporary | Often permanent |
| **Effect** | Visual addition | Material alteration |
| **Examples** | Logos, paint, blood | Scratches, corrosion, wear |

**TL;DR**: Decals add to the surface, damages reveal what's underneath!
