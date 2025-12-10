import { float, clamp, smoothstep as tslSmoothstep } from "three/tsl";
import { Node } from "three/webgpu";

/**
 * Math helper functions for TSL operations
 */

/**
 * Clamp a value between min and max
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 */
export function saturate(value: Node): Node {
  return clamp(value, 0.0, 1.0);
}

/**
 * Remap a value from one range to another
 * @param value - Value to remap
 * @param inMin - Input range minimum
 * @param inMax - Input range maximum
 * @param outMin - Output range minimum
 * @param outMax - Output range maximum
 */
export function remap(
  value: Node,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): Node {
  const t = value.sub(inMin).div(float(inMax - inMin));
  return t.mul(float(outMax - outMin)).add(outMin);
}

/**
 * Smooth minimum function for blending between values
 * @param a - First value
 * @param b - Second value
 * @param k - Smoothness factor
 */
export function smoothMin(a: Node, b: Node, k: number): Node {
  const h = clamp(float(0.5).add(float(0.5).mul(b.sub(a).div(k))), 0.0, 1.0);
  return b.mul(h).add(a.mul(float(1.0).sub(h))).sub(float(k).mul(h).mul(float(1.0).sub(h)));
}

/**
 * Smooth maximum function for blending between values
 * @param a - First value
 * @param b - Second value
 * @param k - Smoothness factor
 */
export function smoothMax(a: Node, b: Node, k: number): Node {
  return smoothMin(a, b, -k).negate();
}

/**
 * Quintic interpolation curve (smoother than cubic)
 * @param t - Input value (0-1)
 */
export function quintic(t: Node): Node {
  return t.mul(t).mul(t).mul(t.mul(float(6.0).mul(t).sub(15.0)).add(10.0));
}

/**
 * Inverse linear interpolation - returns how far value is between a and b
 * @param a - Start value
 * @param b - End value
 * @param value - Value to find position of
 */
export function inverseLerp(a: Node, b: Node, value: Node): Node {
  return value.sub(a).div(b.sub(a));
}
