import { uniform, float, vec3, mul } from "three/tsl";
import { LayeredMaterial } from "../LayeredMaterial";
import { LayerConfig, LayeredMaterialOptions } from "../types";
import { MeshPhysicalNodeMaterial, UniformNode } from "three/webgpu";

/**
 * UniformDynamicMaterial with real-time property transitions
 * 
 * Uses TSL uniforms for roughness, metalness, and color tint,
 * allowing real-time transitions WITHOUT shader recompilation.
 * 
 * Performance: 60fps smooth transitions vs. shader rebuild stuttering
 */
export class UniformDynamicMaterial extends LayeredMaterial {
    // Uniforms for real-time updates
    private _roughnessUniform: UniformNode<number>;
    private _metalnessUniform: UniformNode<number>;
    private _colorTintRUniform: UniformNode<number>;
    private _colorTintGUniform: UniformNode<number>;
    private _colorTintBUniform: UniformNode<number>;

    private _sourceLayers: LayerConfig[];
    private _targetLayers: LayerConfig[] = [];
    private _transitionFactor: number = 0;

    constructor(options: LayeredMaterialOptions = {}) {
        super(options);
        this._sourceLayers = [...this.layers];

        // Initialize uniforms with current values
        const layer = this.layers[0] || {};
        this._roughnessUniform = uniform(layer.roughness ?? 0.5);
        this._metalnessUniform = uniform(layer.metalness ?? 0.0);
        this._colorTintRUniform = uniform(layer.colorTint?.r ?? 1.0);
        this._colorTintGUniform = uniform(layer.colorTint?.g ?? 1.0);
        this._colorTintBUniform = uniform(layer.colorTint?.b ?? 1.0);

        // Rebuild material with uniform nodes
        this._setupWithUniforms();
    }

    /**
     * Override the material setup to use uniform nodes
     */
    private _setupWithUniforms(): void {
        // Get the base material's nodes (color, normal, etc.)
        // Then override roughness and metalness with our uniforms

        // Access the underlying MeshPhysicalNodeMaterial
        const mat = this as unknown as MeshPhysicalNodeMaterial;

        // Apply uniform-based roughness and metalness
        mat.roughnessNode = this._roughnessUniform;
        mat.metalnessNode = this._metalnessUniform;

        // Apply color tint to the existing color node
        if (mat.colorNode) {
            const tint = vec3(this._colorTintRUniform, this._colorTintGUniform, this._colorTintBUniform);
            mat.colorNode = mul(mat.colorNode, tint);
        }

        this.needsUpdate = true;
    }

    /**
     * Set transition target and factor (0-1) WITHOUT shader rebuild
     * This only updates uniform values, which is GPU-fast
     */
    setTransitionFast(targetLayers: LayerConfig[], factor: number): void {
        this._targetLayers = targetLayers;
        this._transitionFactor = Math.max(0, Math.min(1, factor));

        const source = this._sourceLayers[0] || {};
        const target = this._targetLayers[0] || {};

        // Interpolate and update uniform values
        this._roughnessUniform.value = this._lerp(
            source.roughness ?? 0.5,
            target.roughness ?? 0.5,
            factor
        );

        this._metalnessUniform.value = this._lerp(
            source.metalness ?? 0.0,
            target.metalness ?? 0.0,
            factor
        );

        // Color tint
        const srcTint = source.colorTint || { r: 1, g: 1, b: 1 };
        const tgtTint = target.colorTint || { r: 1, g: 1, b: 1 };
        this._colorTintRUniform.value = this._lerp(srcTint.r, tgtTint.r, factor);
        this._colorTintGUniform.value = this._lerp(srcTint.g, tgtTint.g, factor);
        this._colorTintBUniform.value = this._lerp(srcTint.b, tgtTint.b, factor);

        // Note: No needsUpdate = true needed for uniform value changes!
    }

    /**
     * Complete transition and update source layers
     */
    completeTransition(): void {
        this._sourceLayers = [...this._targetLayers];
        this._transitionFactor = 0;
    }

    /**
     * Get current transition progress
     */
    getTransitionProgress(): number {
        return this._transitionFactor;
    }

    /**
     * Get current roughness value
     */
    getRoughness(): number {
        return this._roughnessUniform.value;
    }

    /**
     * Get current metalness value
     */
    getMetalness(): number {
        return this._metalnessUniform.value;
    }

    /**
     * Get current color tint
     */
    getColorTint(): { r: number; g: number; b: number } {
        return {
            r: this._colorTintRUniform.value,
            g: this._colorTintGUniform.value,
            b: this._colorTintBUniform.value
        };
    }

    private _lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }
}
