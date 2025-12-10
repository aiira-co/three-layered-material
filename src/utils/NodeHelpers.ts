import { vec3, float, normalize } from "three/tsl";
import { Node } from "three/webgpu";

/**
 * Helper functions for working with TSL Nodes
 */

/**
 * Check if a node value is approximately zero
 * @param node - Node to check
 * @param epsilon - Threshold for "zero" (default 0.001)
 */
export function isNearZero(node: Node, epsilon: number = 0.001): Node {
  return node.abs().lessThan(epsilon);
}

/**
 * Safe divide that avoids division by zero
 * @param numerator - Numerator node
 * @param denominator - Denominator node
 * @param fallback - Value to return if denominator is near zero (default 0)
 */
export function safeDivide(numerator: Node, denominator: Node, fallback: number = 0): Node {
  const safeDenom = denominator.abs().max(0.0001);
  return numerator.div(safeDenom);
}

/**
 * Unpack normal from texture space [0,1] to tangent space [-1,1]
 * @param normalSample - Normal sampled from texture
 */
export function unpackNormal(normalSample: Node): Node {
  return normalSample.mul(2.0).sub(1.0);
}

/**
 * Pack normal from tangent space [-1,1] to texture space [0,1]
 * @param normal - Normal in tangent space
 */
export function packNormal(normal: Node): Node {
  return normal.mul(0.5).add(0.5);
}

/**
 * Create a default flat normal (pointing up in tangent space)
 */
export function flatNormal(): Node {
  return vec3(0, 0, 1);
}

/**
 * Create a default white color
 */
export function whiteColor(): Node {
  return vec3(1, 1, 1);
}

/**
 * Create a default black color
 */
export function blackColor(): Node {
  return vec3(0, 0, 0);
}

/**
 * Create a default gray color
 * @param value - Gray value (0-1)
 */
export function grayColor(value: number = 0.5): Node {
  return vec3(value, value, value);
}

/**
 * Ensure a normal vector is normalized
 * @param normal - Normal vector to normalize
 */
export function ensureNormalized(normal: Node): Node {
  return normalize(normal);
}

/**
 * Convert a scalar to a uniform color
 * @param scalar - Scalar value
 */
export function scalarToColor(scalar: Node): Node {
  return vec3(scalar, scalar, scalar);
}
