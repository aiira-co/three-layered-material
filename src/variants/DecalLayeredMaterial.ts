import { Texture } from "three";
import { LayeredMaterial } from "../LayeredMaterial";
import { DecalConfig, DamageConfig, DecalDamageSystemConfig } from "./types/DecalConfig";
import {
  dot,
  float,
  fract,
  positionWorld,
  saturate,
  uv,
  vec2,
  vec3,
  normalWorld,
  mix,
  smoothstep
} from "three/tsl";
import { Node } from "three/webgpu";
import { LayerConfig, LayerData, LayeredMaterialOptions } from "../types";

export class DecalLayeredMaterial extends LayeredMaterial {
  private _decals: DecalConfig[] = [];
  private _damages: DamageConfig[] = [];
  private _decalSystemConfig: DecalDamageSystemConfig;
  private _decalTextureAtlas: Texture | null = null;
  private _damageMaskTexture: Texture | null = null;
  private _lastUpdateTime: number = 0;
  private _updateInterval: number = 100; // ms

  constructor(options: LayeredMaterialOptions & { decalSystem?: DecalDamageSystemConfig } = {}) {
    super(options);

    this._decalSystemConfig = {
      maxDecals: 50,
      maxDamages: 30,
      decalFadeTime: 10,
      damageHealRate: 0.1,
      useWorldSpace: true,
      enableAtlas: false,
      ...options.decalSystem
    };

    this.setupDecalDamageSystem();
  }

  private setupDecalDamageSystem(): void {
    if (this._decalSystemConfig.enableAtlas) {
      this.createDecalAtlas();
    }
    this.createDamageMaskTexture();
  }

  /**
   * Add a decal to the material
   */
  addDecal(decalConfig: Omit<DecalConfig, 'id'>): string {
    const id = `decal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const decal: DecalConfig = {
      ...decalConfig,
      id,
      projection: decalConfig.projection || 'planar',
      fadeStartTime: decalConfig.lifetime ? Date.now() : undefined
    };

    // Manage decal count
    if (this._decals.length >= this._decalSystemConfig.maxDecals!) {
      this.removeOldestDecal();
    }

    this._decals.push(decal);
    this._decals.sort((a, b) => b.priority - a.priority);

    this.updateDecalDamageSystem();
    return id;
  }

  /**
   * Add damage to the material
   */
  addDamage(damageConfig: Omit<DamageConfig, 'id'>): string {
    const id = `damage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const damage: DamageConfig = {
      ...damageConfig,
      id,
      intensity: Math.max(0, Math.min(1, damageConfig.intensity)) // Clamp to 0-1
    };

    // BUG FIX: Added max damages limit
    if (this._damages.length >= (this._decalSystemConfig.maxDamages || 30)) {
      this.removeOldestDamage();
    }

    this._damages.push(damage);
    this.updateDecalDamageSystem();
    return id;
  }

  /**
   * Remove a decal by ID
   */
  removeDecal(id: string): boolean {
    const index = this._decals.findIndex(decal => decal.id === id);
    if (index > -1) {
      this._decals.splice(index, 1);
      this.updateDecalDamageSystem();
      return true;
    }
    return false;
  }

  /**
   * Remove damage by ID
   */
  removeDamage(id: string): boolean {
    const index = this._damages.findIndex(damage => damage.id === id);
    if (index > -1) {
      this._damages.splice(index, 1);
      this.updateDecalDamageSystem();
      return true;
    }
    return false;
  }

  /**
   * Update decal/damage system (call this in animation loop)
   */
  update(deltaTime: number): void {
    const currentTime = Date.now();

    // Throttle updates
    if (this._lastUpdateTime + this._updateInterval > currentTime) {
      return;
    }

    let needsUpdate = false;

    // Update decal lifetimes
    needsUpdate = this.updateDecalLifetimes(currentTime) || needsUpdate;

    // Update damage healing
    needsUpdate = this.updateDamageHealing(deltaTime) || needsUpdate;

    if (needsUpdate) {
      this.updateDecalDamageSystem();
      this._lastUpdateTime = currentTime;
    }
  }

  // BUG FIX: Changed return type to boolean to indicate if update needed
  private updateDecalLifetimes(currentTime: number): boolean {
    let needsUpdate = false;

    for (let i = this._decals.length - 1; i >= 0; i--) {
      const decal = this._decals[i];

      if (decal.lifetime && decal.fadeStartTime) {
        const elapsed = (currentTime - decal.fadeStartTime) / 1000;

        if (elapsed >= decal.lifetime) {
          this._decals.splice(i, 1);
          needsUpdate = true;
        }
      }
    }

    return needsUpdate;
  }

  // BUG FIX: Changed return type to boolean
  private updateDamageHealing(deltaTime: number): boolean {
    let needsUpdate = false;

    for (let i = this._damages.length - 1; i >= 0; i--) {
      const damage = this._damages[i];

      if (!damage.permanent && damage.healRate) {
        damage.intensity = Math.max(0, damage.intensity - damage.healRate * deltaTime);

        if (damage.intensity <= 0) {
          this._damages.splice(i, 1);
          needsUpdate = true;
        } else {
          needsUpdate = true;
        }
      }
    }

    return needsUpdate;
  }

  private removeOldestDecal(): void {
    if (this._decals.length === 0) return;

    // BUG FIX: Use reduce for cleaner code
    const oldestIndex = this._decals.reduce((oldest, decal, index, array) => {
      const oldestTime = array[oldest].fadeStartTime || Date.now();
      const currentTime = decal.fadeStartTime || Date.now();
      return currentTime < oldestTime ? index : oldest;
    }, 0);

    this._decals.splice(oldestIndex, 1);
  }

  // BUG FIX: Added missing method
  private removeOldestDamage(): void {
    if (this._damages.length === 0) return;
    this._damages.shift(); // Remove first (oldest) damage
  }

  /**
   * Update the material with current decals and damages
   */
  private updateDecalDamageSystem(): void {
    this.setupMaterial();
    this.needsUpdate = true;
  }

  /**
   * Override buildLayerBlending to include decals and damages
   */
  protected override buildLayerBlending(): LayerData {
    let result = super.buildLayerBlending();

    // Apply in correct order: damages first (affect base), then decals (on top)
    result = this.applyDamages(result);
    result = this.applyDecals(result);

    return result;
  }

  /**
   * Apply damage layers to the base material
   */
  private applyDamages(baseData: LayerData): LayerData {
    if (this._damages.length === 0) return baseData;

    let result = baseData;

    for (const damage of this._damages) {
      const damageLayer = this.sampleLayer(damage.layer);
      const damageMask = this.calculateDamageMask(damage);

      result = this.blendLayers(result, damageLayer, damageMask, damage.layer);
    }

    return result;
  }

  /**
   * Apply decal layers to the material
   */
  private applyDecals(baseData: LayerData): LayerData {
    if (this._decals.length === 0) return baseData;

    let result = baseData;

    // Apply decals in priority order (already sorted)
    for (const decal of this._decals) {
      const decalLayer = this.sampleLayer(decal.layer);
      const decalMask = this.calculateDecalMask(decal);

      const decalConfigWithBlend: LayerConfig = {
        ...decal.layer,
        blendMode: {
          color: 'normal',
          normal: 'rnb',
          roughness: 'normal',
          metalness: 'normal',
          ao: 'normal'
        }
      };

      result = this.blendLayers(result, decalLayer, decalMask, decalConfigWithBlend);
    }

    return result;
  }

  /**
   * Calculate mask for a damage area
   */
  private calculateDamageMask(damage: DamageConfig): Node {
    const worldPos = positionWorld;
    const damagePos = vec3(damage.position.x, damage.position.y, damage.position.z);
    const distance = worldPos.sub(damagePos).length();

    // Radial falloff
    const falloff = saturate(float(1.0).sub(distance.div(float(damage.radius))));

    // Apply intensity
    let mask = falloff.mul(float(damage.intensity));

    // Add noise for organic damage
    const noise = this.generateNoise(worldPos.xz.mul(10.0), {
      useNoise: true,
      noiseType: 'fbm',
      noiseScale: 1.0,
      noiseOctaves: 3,
      noisePersistence: 0.5
    });
    mask = mask.mul(noise.mul(0.3).add(0.7));

    // Damage type specific patterns
    switch (damage.type) {
      case 'scratch':
        if (damage.direction) {
          const scratchDir = vec3(damage.direction.x, damage.direction.y, damage.direction.z).normalize();
          const scratchMask = this.calculateScratchMask(worldPos, damagePos, scratchDir.xy);
          mask = mask.mul(scratchMask);
        }
        break;

      case 'crack':
        const crackNoise = this.generateNoise(worldPos.xz.mul(5.0), {
          useNoise: true,
          noiseType: 'voronoi',
          noiseScale: 1.0,
          noiseOctaves: 2
        });
        mask = mask.mul(crackNoise.oneMinus());
        break;

      case 'bullet':
        // Concentric rings
        const ringPattern = fract(distance.mul(3.0)).oneMinus().pow(2.0);
        mask = mask.mul(ringPattern);
        break;

      case 'dent':
        // Smooth depression
        mask = mask.mul(falloff);
        break;

      case 'corrosion':
        // Irregular organic pattern
        const corrosionNoise = this.generateNoise(worldPos.xyz.mul(8.0), {
          useNoise: true,
          noiseType: 'fbm',
          noiseScale: 1.0,
          noiseOctaves: 4,
          noisePersistence: 0.6,
          noiseThreshold: 0.4
        });
        mask = mask.mul(corrosionNoise);
        break;
    }

    return saturate(mask);
  }

  /**
   * Calculate mask for a decal
   */
  private calculateDecalMask(decal: DecalConfig): Node {
    switch (decal.projection) {
      case 'box':
        return this.calculateBoxDecalMask(decal);
      case 'sphere':
        return this.calculateSphereDecalMask(decal);
      default: // 'planar'
        return this._decalSystemConfig.useWorldSpace
          ? this.calculateWorldSpaceDecalMask(decal)
          : this.calculateUVSpaceDecalMask(decal);
    }
  }

  /**
   * World-space planar decal projection
   */
  private calculateWorldSpaceDecalMask(decal: DecalConfig): Node {
    const worldPos = positionWorld;
    const decalPos = vec3(decal.position.x, decal.position.y, decal.position.z);

    // Transform to decal local space
    const localPos = worldPos.sub(decalPos);

    // TODO: Apply proper rotation using decal.rotation
    // For now, simple XZ projection
    const decalUV = localPos.xz.div(vec2(decal.size.x, decal.size.z)).add(0.5);

    // Bounds checking
    const inBoundsX = saturate(float(1.0).sub(decalUV.x.sub(0.5).abs().mul(2.0)));
    const inBoundsY = saturate(float(1.0).sub(decalUV.y.sub(0.5).abs().mul(2.0)));
    const inBounds = inBoundsX.mul(inBoundsY);

    // Soft falloff from center
    const centerDist = decalUV.sub(0.5).length().mul(2.0);
    const falloff = saturate(float(1.0).sub(centerDist)).pow(1.5);

    let mask = inBounds.mul(falloff);

    // Apply lifetime fade
    if (decal.lifetime && decal.fadeStartTime) {
      const currentTime = Date.now();
      const elapsed = (currentTime - decal.fadeStartTime) / 1000;
      const fadeProgress = Math.min(elapsed / decal.lifetime, 1.0);
      const fadeFactor = 1.0 - fadeProgress;
      mask = mask.mul(float(fadeFactor));
    }

    // Angle-based fade (decals fade at grazing angles)
    const decalNormal = vec3(0, 1, 0); // Simplified
    const surfaceAlignment = dot(normalWorld, decalNormal).abs();
    const angleFade = smoothstep(float(0.1), float(0.5), surfaceAlignment);
    mask = mask.mul(angleFade);

    return saturate(mask);
  }

  /**
   * UV-space decal projection
   */
  private calculateUVSpaceDecalMask(decal: DecalConfig): Node {
    const uvCoords = uv();

    // Map decal position to UV space (simplified)
    const decalUV = uvCoords;

    const inBoundsX = saturate(float(1.0).sub(decalUV.x.sub(0.5).abs().mul(2.0)));
    const inBoundsY = saturate(float(1.0).sub(decalUV.y.sub(0.5).abs().mul(2.0)));
    const inBounds = inBoundsX.mul(inBoundsY);

    const centerDist = decalUV.sub(0.5).length().mul(2.0);
    const falloff = saturate(float(1.0).sub(centerDist)).pow(1.5);

    return saturate(inBounds.mul(falloff));
  }

  /**
   * Box projection decal
   */
  private calculateBoxDecalMask(decal: DecalConfig): Node {
    const worldPos = positionWorld;
    const decalPos = vec3(decal.position.x, decal.position.y, decal.position.z);
    const localPos = worldPos.sub(decalPos);

    // Check if within box bounds
    const halfSize = vec3(decal.size.x, decal.size.y, decal.size.z).mul(0.5);
    const inBoundsX = saturate(float(1.0).sub(localPos.x.abs().div(halfSize.x)));
    const inBoundsY = saturate(float(1.0).sub(localPos.y.abs().div(halfSize.y)));
    const inBoundsZ = saturate(float(1.0).sub(localPos.z.abs().div(halfSize.z)));

    return inBoundsX.mul(inBoundsY).mul(inBoundsZ);
  }

  /**
   * Sphere projection decal
   */
  private calculateSphereDecalMask(decal: DecalConfig): Node {
    const worldPos = positionWorld;
    const decalPos = vec3(decal.position.x, decal.position.y, decal.position.z);
    const distance = worldPos.sub(decalPos).length();
    const radius = Math.max(decal.size.x, decal.size.y, decal.size.z) * 0.5;

    return saturate(float(1.0).sub(distance.div(float(radius))));
  }

  /**
   * Calculate scratch pattern mask
   */
  private calculateScratchMask(worldPos: Node, scratchPos: Node, direction: Node): Node {
    const toScratch = worldPos.sub(scratchPos);
    const dir2D = direction.normalize();

    // Project onto scratch direction
    const alongScratch = toScratch.x.mul(dir2D.x).add(toScratch.z.mul(dir2D.y));
    const acrossScratch = toScratch.x.mul(dir2D.y).sub(toScratch.z.mul(dir2D.x)).abs();

    // Scratch is long and thin
    const lengthMask = saturate(float(1.0).sub(alongScratch.abs().div(1.0)));
    const widthMask = saturate(float(1.0).sub(acrossScratch.div(0.02)));

    return lengthMask.mul(widthMask);
  }

  private createDecalAtlas(): void {
    // TODO: Implement texture atlas for performance
  }

  private createDamageMaskTexture(): void {
    // TODO: Implement damage mask texture
  }

  // Public API
  getDecals(): ReadonlyArray<DecalConfig> {
    return [...this._decals];
  }

  getDamages(): ReadonlyArray<DamageConfig> {
    return [...this._damages];
  }

  clearDecals(): void {
    this._decals = [];
    this.updateDecalDamageSystem();
  }

  clearDamages(): void {
    this._damages = [];
    this.updateDecalDamageSystem();
  }

  setDecalSystemConfig(config: Partial<DecalDamageSystemConfig>): void {
    this._decalSystemConfig = { ...this._decalSystemConfig, ...config };
    this.updateDecalDamageSystem();
  }

  // Override dispose to clean up
  override dispose(): void {
    this.clearDecals();
    this.clearDamages();
    super.dispose();
  }
}
