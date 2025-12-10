import { Node } from "three/webgpu";
import { LayerData, LayerConfig } from "../types";
import { ColorBlender } from "../blending/ColorBlender";
import { NormalBlender } from "../blending/NormalBlender";
import { ScalarBlender } from "../blending/ScalarBlender";
import { mix } from "three/tsl";

export class LayerBlender {
  private colorBlender: ColorBlender;
  private normalBlender: NormalBlender;
  private scalarBlender: ScalarBlender;

  constructor() {
    this.colorBlender = new ColorBlender();
    this.normalBlender = new NormalBlender();
    this.scalarBlender = new ScalarBlender();
  }

  blend(
    baseLayer: LayerData,
    topLayer: LayerData,
    mask: Node,
    config: LayerConfig
  ): LayerData {
    const blendFactor = this.calculateBlendFactor(baseLayer, topLayer, mask, config);

    return {
      color: this.colorBlender.blend(
        baseLayer.color,
        topLayer.color,
        blendFactor,
        config.blendMode?.color || 'normal'
      ),
      normal: this.normalBlender.blend(
        baseLayer.normal,
        topLayer.normal,
        blendFactor,
        config.blendMode?.normal || 'rnb'
      ),
      roughness: this.scalarBlender.blend(
        baseLayer.roughness,
        topLayer.roughness,
        blendFactor,
        config.blendMode?.roughness || 'normal'
      ),
      metalness: this.scalarBlender.blend(
        baseLayer.metalness,
        topLayer.metalness,
        blendFactor,
        config.blendMode?.metalness || 'normal'
      ),
      ao: this.scalarBlender.blend(
        baseLayer.ao,
        topLayer.ao,
        blendFactor,
        config.blendMode?.ao || 'normal'
      ),
      height: baseLayer.height ? mix(baseLayer.height, topLayer.height as Node, blendFactor) : topLayer.height
    };
  }

  private calculateBlendFactor(
    baseLayer: LayerData,
    topLayer: LayerData,
    mask: Node,
    config: LayerConfig
  ): Node {
    // Height blend logic
    // Return computed blend factor
    return mask; // Simplified
  }
}
