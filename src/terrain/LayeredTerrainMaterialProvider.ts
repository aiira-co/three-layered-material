import { Texture, Material } from "three";
import { MeshPhysicalNodeMaterial, Node, UniformNode } from "three/webgpu";
import {
    texture,
    uv,
    uniform,
    vec2,
    vec3,
    float,
    positionLocal,
    attribute,
    add,
    mul,
    normalize,
    Fn,
    mix
} from "three/tsl";
import { LayeredMaterial } from "../LayeredMaterial";
import { LayeredMaterialOptions, LayerConfig, LayerData } from "../types";

/**
 * Context for terrain material creation
 * Mirrors TerrainMaterialContext from three-terrain-lod
 */
export interface TerrainContext {
    heightMap: Texture;
    diffuseTexture: Texture | null;
    maxHeight: number;
    worldSize: number;
    resolution: number;
    wireframe: boolean;
    showChunkBorders: boolean;
}

/**
 * Provider interface for terrain materials
 * Mirrors TerrainMaterialProvider from three-terrain-lod
 */
export interface TerrainProviderInterface {
    createMaterial(context: TerrainContext): Material;
    setWireframe?(enabled: boolean): void;
    setMaxHeight?(height: number): void;
    setShowChunkBorders?(enabled: boolean): void;
    dispose?(): void;
    onHeightMapUpdate?(heightMap: Texture): void;
}

/**
 * Configuration for LayeredTerrainMaterial
 */
export interface LayeredTerrainConfig extends LayeredMaterialOptions {
    /** Use blended height from layers for displacement (vs heightmap only) */
    useLayerHeightBlending?: boolean;
    /** How much layer heights affect displacement (0-1) */
    layerHeightInfluence?: number;
    /** Displacement scale multiplier */
    displacementScale?: number;
}

/**
 * LayeredTerrainMaterialProvider
 * 
 * An adapter that combines LayeredMaterial's layer blending system with
 * terrain vertex displacement. This allows using the full layered material
 * system (edge wear, blending, parallax, etc.) on terrain meshes.
 * 
 * Compatible with three-terrain-lod's TerrainMaterialProvider interface.
 * 
 * @example
 * ```typescript
 * import { LayeredTerrainMaterialProvider } from '@interverse/three-layered-material';
 * import { TerrainLOD } from '@interverse/three-terrain-lod';
 * 
 * const layeredProvider = new LayeredTerrainMaterialProvider({
 *   layers: [
 *     { name: 'Grass', map: { color: grassTex, height: grassHeight } },
 *     { name: 'Rock', map: { color: rockTex, height: rockHeight }, mask: { useSlope: true } }
 *   ],
 *   useLayerHeightBlending: true
 * });
 * 
 * const terrain = new TerrainLOD({ ... });
 * terrain.setMaterialProvider(layeredProvider);
 * ```
 */
export class LayeredTerrainMaterialProvider implements TerrainProviderInterface {
    private config: LayeredTerrainConfig;
    private material: MeshPhysicalNodeMaterial | null = null;
    private maxHeightUniform: UniformNode<number> | null = null;
    private showBordersUniform: UniformNode<number> | null = null;
    private context: TerrainContext | null = null;

    constructor(config: LayeredTerrainConfig = {}) {
        this.config = {
            layers: [],
            useLayerHeightBlending: false,
            layerHeightInfluence: 0.5,
            displacementScale: 1.0,
            ...config
        };
    }

    /**
     * Create the terrain material with layered features + displacement
     */
    createMaterial(context: TerrainContext): Material {
        this.context = context;

        // Create uniforms
        this.maxHeightUniform = uniform(context.maxHeight);
        this.showBordersUniform = uniform(context.showChunkBorders ? 1.0 : 0.0);

        // Create the base material
        const material = new MeshPhysicalNodeMaterial();

        // Get per-instance UV transform
        const instUVTransform = attribute('instanceUVTransform', 'vec3');
        const instUVScale = instUVTransform.x;
        const instUVOffset = vec2(instUVTransform.y, instUVTransform.z);

        // Build UV coordinates (flip Y for heightmap)
        const uvNode = vec2(uv().x, float(1.0).sub(uv().y));
        const scaledUV = uvNode.mul(vec2(instUVScale, instUVScale));
        const globalUV = scaledUV.add(instUVOffset);

        // Sample terrain heightmap
        const terrainHeight = texture(context.heightMap, globalUV).r;

        // Create layered material for surface properties
        const layeredMat = new LayeredMaterial({
            layers: this.config.layers,
            blendSharpness: this.config.blendSharpness
        });

        // Build layer blending
        const layerResult = this.buildLayerBlendingWithHeight(layeredMat, globalUV);

        // Calculate final displacement height
        let finalHeight: Node;
        if (this.config.useLayerHeightBlending && layerResult.height) {
            // Blend between terrain heightmap and layer heights
            const layerInfluence = float(this.config.layerHeightInfluence ?? 0.5);
            finalHeight = mix(terrainHeight, layerResult.height, layerInfluence);
        } else {
            finalHeight = terrainHeight;
        }

        // Apply displacement scale
        const scaledHeight = finalHeight.mul(this.config.displacementScale ?? 1.0);

        // Vertex displacement
        const displacement = vec3(0, 1, 0).mul(scaledHeight.mul(this.maxHeightUniform!));
        material.positionNode = positionLocal.add(displacement);

        // Apply layer surface properties
        material.colorNode = layerResult.color;
        material.normalNode = layerResult.normal;
        material.roughnessNode = layerResult.roughness;
        material.metalnessNode = layerResult.metalness;
        material.aoNode = layerResult.ao;

        // Apply chunk borders if enabled
        if (context.showChunkBorders) {
            const borderColor = this.createChunkBorderOverlay(uvNode);
            material.colorNode = mix(
                layerResult.color,
                vec3(1, 1, 0),
                borderColor.mul(this.showBordersUniform!)
            );
        }

        material.wireframe = context.wireframe;
        material.side = 2; // DoubleSide

        this.material = material;
        return material;
    }

    /**
     * Build layer blending and return the blended result including height
     */
    private buildLayerBlendingWithHeight(
        layeredMat: LayeredMaterial,
        globalUV: Node
    ): LayerData {
        // Access the internal layer blending from LayeredMaterial
        // We need to sample layers with the terrain UV
        const layers = this.config.layers || [];

        if (layers.length === 0) {
            return {
                color: vec3(0.5, 0.5, 0.5),
                normal: vec3(0, 0, 1),
                roughness: float(0.5),
                metalness: float(0),
                ao: float(1),
                height: float(0.5)
            };
        }

        // Use the layered material's built-in blending
        // Note: This returns the fully blended result
        return (layeredMat as any).buildLayerBlending();
    }

    /**
     * Create chunk border overlay for debugging
     */
    private createChunkBorderOverlay(uvNode: Node): Node {
        const maxUV1 = uvNode.x.max(uvNode.y);
        const border1 = maxUV1.step(0.98);
        const maxUV2 = float(1).sub(uvNode.x).max(float(1).sub(uvNode.y));
        const border2 = maxUV2.step(0.98);
        return border1.add(border2).mul(0.3);
    }

    /**
     * Set wireframe mode
     */
    setWireframe(enabled: boolean): void {
        if (this.material) {
            this.material.wireframe = enabled;
            this.material.needsUpdate = true;
        }
    }

    /**
     * Set maximum height
     */
    setMaxHeight(height: number): void {
        if (this.maxHeightUniform) {
            this.maxHeightUniform.value = height;
        }
    }

    /**
     * Set chunk border visibility
     */
    setShowChunkBorders(enabled: boolean): void {
        if (this.showBordersUniform) {
            this.showBordersUniform.value = enabled ? 1.0 : 0.0;
        }
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.material?.dispose();
        this.material = null;
    }

    /**
     * Update the layers configuration
     */
    updateLayers(layers: LayerConfig[]): void {
        this.config.layers = layers;
        // Note: This would require rebuilding the material
        // For runtime layer updates, use the material's updateLayer method
    }

    /**
     * Get the underlying material
     */
    getMaterial(): MeshPhysicalNodeMaterial | null {
        return this.material;
    }
}
