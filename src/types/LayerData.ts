import { Node } from "three/webgpu";

export interface LayerData {
  color: Node;
  normal: Node;
  roughness: Node;
  metalness: Node;
  ao: Node;
  height?: Node;
}
