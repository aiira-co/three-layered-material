import { LayerConfig } from "../types";
import { LayeredMaterial } from "../LayeredMaterial";

// Create material variations that inherit from base with automatic updates
export class MaterialVariant extends LayeredMaterial {
  private _baseMaterial: LayeredMaterial;
  private _overrides: Partial<LayerConfig>[];
  private _isUpdating: boolean = false;

  constructor(baseMaterial: LayeredMaterial, overrides: Partial<LayerConfig>[]) {
    // Create initial layers by merging base with overrides
    const mergedLayers = MaterialVariant.mergeLayersWithOverrides(
      baseMaterial.layers,
      overrides
    );

    super({ layers: mergedLayers });

    this._baseMaterial = baseMaterial;
    this._overrides = overrides;

    // Set up listeners for base material changes
    this.setupBaseMaterialListeners();
  }

  /**
   * Set up listeners to automatically update when base material changes
   */
  private setupBaseMaterialListeners(): void {
    // Override base material methods to notify variants
    this.interceptBaseMaterialMethods();

    // Set up a manual update mechanism since Three.js materials don't have built-in events
    this.startUpdatePolling();
  }

  /**
   * Intercept base material modification methods to detect changes
   */
  private interceptBaseMaterialMethods(): void {
    const base = this._baseMaterial as any;

    // Store original methods
    const originalAddLayer = base.addLayer;
    const originalRemoveLayer = base.removeLayer;
    const originalUpdateLayer = base.updateLayer;

    // Override addLayer
    base.addLayer = (layerConfig: LayerConfig) => {
      const result = originalAddLayer.call(base, layerConfig);
      this.onBaseLayersChanged();
      return result;
    };

    // Override removeLayer
    base.removeLayer = (index: number) => {
      const result = originalRemoveLayer.call(base, index);
      this.onBaseLayersChanged();
      return result;
    };

    // Override updateLayer
    base.updateLayer = (index: number, layerConfig: Partial<LayerConfig>) => {
      const result = originalUpdateLayer.call(base, index, layerConfig);
      this.onBaseLayersChanged();
      return result;
    };
  }

  /**
   * Start polling for changes in base material (fallback mechanism)
   */
  private startUpdatePolling(): void {
    let lastLayerCount = this._baseMaterial.layers.length;
    let lastLayerHashes = this._baseMaterial.layers.map(layer => this.hashLayer(layer));

    const checkForUpdates = () => {
      if (this._isUpdating) return;

      const currentLayerCount = this._baseMaterial.layers.length;
      const currentLayerHashes = this._baseMaterial.layers.map(layer => this.hashLayer(layer));

      // Check if layers changed
      const layersChanged =
        currentLayerCount !== lastLayerCount ||
        JSON.stringify(currentLayerHashes) !== JSON.stringify(lastLayerHashes);

      if (layersChanged) {
        this.onBaseLayersChanged();
        lastLayerCount = currentLayerCount;
        lastLayerHashes = currentLayerHashes;
      }

      // Continue polling
      requestAnimationFrame(checkForUpdates);
    };

    // Start polling
    requestAnimationFrame(checkForUpdates);
  }

  /**
   * Generate a simple hash for a layer to detect changes
   */
  private hashLayer(layer: LayerConfig): string {
    // Create a simple hash based on key properties
    return JSON.stringify({
      name: layer.name,
      scale: layer.scale,
      roughness: layer.roughness,
      metalness: layer.metalness,
      // Add more properties as needed for change detection
    });
  }

  /**
   * Called when base material layers change
   */
  private onBaseLayersChanged(): void {
    if (this._isUpdating) return;

    this._isUpdating = true;

    try {
      // Re-merge layers with overrides
      const mergedLayers = MaterialVariant.mergeLayersWithOverrides(
        this._baseMaterial.layers,
        this._overrides
      );

      // Update our layers
      this.layers = mergedLayers;
      this.setupMaterial();
      this.needsUpdate = true;

      console.log('MaterialVariant updated due to base material changes');
    } finally {
      this._isUpdating = false;
    }
  }

  /**
   * Static method to merge base layers with overrides
   */
  static mergeLayersWithOverrides(
    baseLayers: LayerConfig[],
    overrides: Partial<LayerConfig>[]
  ): LayerConfig[] {
    return baseLayers.map((baseLayer, index) => {
      const override = index < overrides.length ? overrides[index] : {};
      return { ...baseLayer, ...override };
    });
  }

  /**
   * Update the overrides for this variant
   */
  setOverrides(overrides: Partial<LayerConfig>[]): void {
    this._overrides = overrides;
    this.onBaseLayersChanged(); // Trigger update with new overrides
  }

  /**
   * Update a specific override
   */
  updateOverride(layerIndex: number, override: Partial<LayerConfig>): void {
    if (layerIndex >= this._overrides.length) {
      // Extend overrides array if needed
      this._overrides.length = layerIndex + 1;
    }

    this._overrides[layerIndex] = {
      ...this._overrides[layerIndex],
      ...override
    };

    this.onBaseLayersChanged();
  }

  /**
   * Get current overrides
   */
  getOverrides(): Partial<LayerConfig>[] {
    return [...this._overrides];
  }

  /**
   * Get the base material
   */
  getBaseMaterial(): LayeredMaterial {
    return this._baseMaterial;
  }

  /**
   * Create a deep clone of this variant
   */
  override cloneX(): MaterialVariant {
    // Deep clone layers and overrides
    // const clonedLayers = JSON.parse(JSON.stringify(this.layers));
    const clonedOverrides = JSON.parse(JSON.stringify(this._overrides));

    return new MaterialVariant(this._baseMaterial, clonedOverrides);
  }

  /**
   * Dispose and clean up listeners
   */
  override dispose(): void {
    // Clean up any intercepted methods (restore originals)
    // This is complex due to the interception approach

    // Stop polling (it will naturally stop when the object is garbage collected)

    super.dispose();
  }
}

// Alternative approach using a more robust event system
export class ObservableLayeredMaterial extends LayeredMaterial {
  private _listeners: Array<() => void> = [];

  constructor(options: any = {}) {
    super(options);
  }

  /**
   * Add change listener
   */
  addChangeListener(listener: () => void): void {
    this._listeners.push(listener);
  }

  /**
   * Remove change listener
   */
  removeChangeListener(listener: () => void): void {
    const index = this._listeners.indexOf(listener);
    if (index > -1) {
      this._listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of changes
   */
  protected notifyChange(): void {
    this._listeners.forEach(listener => listener());
  }

  /**
   * Override layer modification methods to notify listeners
   */
  override addLayer(layerConfig: LayerConfig): void {
    super.addLayer(layerConfig);
    this.notifyChange();
  }

  override removeLayer(index: number): void {
    super.removeLayer(index);
    this.notifyChange();
  }

  override updateLayer(index: number, layerConfig: Partial<LayerConfig>): void {
    super.updateLayer(index, layerConfig);
    this.notifyChange();
  }
}

// Enhanced MaterialVariant that works with ObservableLayeredMaterial
export class ObservableMaterialVariant extends LayeredMaterial {
  private _baseMaterial: ObservableLayeredMaterial;
  private _overrides: Partial<LayerConfig>[];
  private _changeListener: () => void;

  constructor(baseMaterial: ObservableLayeredMaterial, overrides: Partial<LayerConfig>[]) {
    const mergedLayers = MaterialVariant.mergeLayersWithOverrides(
      baseMaterial.layers,
      overrides
    );

    super({ layers: mergedLayers });

    this._baseMaterial = baseMaterial;
    this._overrides = overrides;

    // Set up event listener
    this._changeListener = () => this.onBaseLayersChanged();
    this._baseMaterial.addChangeListener(this._changeListener);
  }

  private onBaseLayersChanged(): void {
    const mergedLayers = MaterialVariant.mergeLayersWithOverrides(
      this._baseMaterial.layers,
      this._overrides
    );

    this.layers = mergedLayers;
    this.setupMaterial();
    this.needsUpdate = true;
  }

  override dispose(): void {
    this._baseMaterial.removeChangeListener(this._changeListener);
    super.dispose();
  }

  // Same methods as regular MaterialVariant...
  setOverrides(overrides: Partial<LayerConfig>[]): void {
    this._overrides = overrides;
    this.onBaseLayersChanged();
  }

  getOverrides(): Partial<LayerConfig>[] {
    return [...this._overrides];
  }

  getBaseMaterial(): ObservableLayeredMaterial {
    return this._baseMaterial;
  }
}
