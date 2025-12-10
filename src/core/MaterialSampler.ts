import { Node } from "three/webgpu";
import { LayerConfig, LayerData } from "./../types";
import { MaterialExtractor } from "./../input/MaterialExtractor";
import { TextureSampler } from "./../input/TextureSampler";
import { DefaultLayerFactory } from "./../input/DefaultLayerFactory";
import { TriplanarSampler } from "./../features/triplanar/TriplanarSampler";

export class MaterialSampler {
  private materialExtractor: MaterialExtractor;
  private textureSampler: TextureSampler;
  private defaultFactory: DefaultLayerFactory;
  private triplanarSampler: TriplanarSampler;

  constructor() {
    this.materialExtractor = new MaterialExtractor();
    this.textureSampler = new TextureSampler();
    this.defaultFactory = new DefaultLayerFactory();
    this.triplanarSampler = new TriplanarSampler();
  }

  sampleLayer(layer: LayerConfig): LayerData {
    // Priority 1: Material input
    if (layer.materialInput) {
      return this.materialExtractor.extractFromMaterial(layer);
    }

    // Priority 2: Textures
    if (layer.map || layer.triplanar?.enable) {
      if (layer.triplanar?.enable) {
        return this.triplanarSampler.sample(layer);
      }
      return this.textureSampler.sample(layer);
    }

    // Priority 3: Default/solid colors
    return this.defaultFactory.create(layer);
  }
}
