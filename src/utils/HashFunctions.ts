import { vec3, fract, dot, sin, floor, float } from "three/tsl";
import { Node } from "three/webgpu";

/**
 * Hash functions for procedural generation
 */

/**
 * 2D hash function that generates pseudo-random vec3 from vec2 input
 * @param p - 2D input coordinates
 * @returns Pseudo-random vec3 in [0, 1] range
 */
export function hash2D(p: Node): Node {
  const p3 = fract(vec3(p.xyx).mul(vec3(0.1031, 0.1030, 0.0973)));
  const dp = dot(p3, vec3(p3.y, p3.z, p3.x).add(33.33));
  return fract(vec3(dp, dp, dp).mul(vec3(p3.x, p3.y, p3.z).add(p3.yxz)));
}

/**
 * 3D hash function that generates pseudo-random vec3 from vec3 input
 * @param p - 3D input coordinates
 * @returns Pseudo-random vec3 in [0, 1] range
 */
export function hash3D(p: Node): Node {
  const p3 = fract(p.mul(vec3(0.1031, 0.1030, 0.0973)));
  const dp = dot(p3, vec3(p3.y, p3.z, p3.x).add(33.33));
  return fract(vec3(dp, dp, dp).mul(vec3(p3.x, p3.y, p3.z).add(p3.yxz)));
}

/**
 * Simple 1D hash function
 * @param n - Input value
 * @returns Pseudo-random value in [0, 1] range
 */
export function hash1D(n: Node): Node {
  return fract(sin(n).mul(43758.5453123));
}

/**
 * Integer hash for grid-based operations
 * @param p - Integer 2D coordinates
 * @returns Pseudo-random float
 */
export function intHash2D(p: Node): Node {
  const i = floor(p);
  return hash1D(i.x.add(i.y.mul(157.0)));
}
