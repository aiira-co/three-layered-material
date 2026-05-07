import { vec3, fract, dot, sin, floor, float } from "three/tsl";

type Node = any;



/**
 * Hash functions for procedural generation
 */

/**
 * 2D hash function that generates pseudo-random vec3 from vec2 input
 * @param p - 2D input coordinates
 * @returns Pseudo-random vec3 in [0, 1] range
 */
export function hash2D(p: Node): Node {
  const p3: any = fract(vec3((p as any).xyx).mul(vec3(0.1031, 0.1030, 0.0973))) as any;
  const dp: any = dot(p3 as any, vec3((p3 as any).y, (p3 as any).z, (p3 as any).x).add(33.33) as any) as any;
  return fract(vec3(dp as any, dp as any, dp as any).mul(vec3((p3 as any).x, (p3 as any).y, (p3 as any).z).add((p3 as any).yxz) as any) as any) as any;
}

/**
 * 3D hash function that generates pseudo-random vec3 from vec3 input
 * @param p - 3D input coordinates
 * @returns Pseudo-random vec3 in [0, 1] range
 */
export function hash3D(p: Node): Node {
  const p3: any = fract((p as any).mul(vec3(0.1031, 0.1030, 0.0973)) as any) as any;
  const dp: any = dot(p3 as any, vec3((p3 as any).y, (p3 as any).z, (p3 as any).x).add(33.33) as any) as any;
  return fract(vec3(dp as any, dp as any, dp as any).mul(vec3((p3 as any).x, (p3 as any).y, (p3 as any).z).add((p3 as any).yxz) as any) as any) as any;
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
  const i: any = floor(p as any) as any;
  return hash1D((i as any).x.add((i as any).y.mul(157.0)) as any);
}
