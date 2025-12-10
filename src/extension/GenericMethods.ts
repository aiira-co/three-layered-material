import { dot, fract, vec3 } from "three/tsl";
import { MeshPhysicalNodeMaterial, Node } from "three/webgpu";

export class GenericMethods extends MeshPhysicalNodeMaterial {
   /**
   * Hash function for texture bombing - generates pseudo-random values
   */
  protected hash2D(p: Node): Node {
    // Simple 2D hash function
    const p3 = fract(vec3(p.xyx).mul(vec3(0.1031, 0.1030, 0.0973)));
    const dp = dot(p3, vec3(p3.y, p3.z, p3.x).add(33.33));
    return fract(vec3(dp, dp, dp).mul(vec3(p3.x, p3.y, p3.z).add(p3.yxz)));
  }
}
