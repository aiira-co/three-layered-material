
import {
  vec2,
  vec3,
  floor,
  fract,
  dot,
  cos,
  sin,
  mix,
  smoothstep,
  float,
  texture,
  select
} from "three/tsl";
import { Texture } from "three";
import { BombingConfig } from "./BombingConfig";

type Node = any;


/**
 * Texture bombing (stochastic sampling) to eliminate tiling patterns
 * Samples texture multiple times with random rotations and offsets
 */
export class TextureBombing {
  /**
   * Sample texture with bombing to eliminate repetition
   * @param map - Texture to sample
   * @param uvCoords - UV coordinates
   * @param blendAmount - Blend factor between samples (0-1)
   * @param config - Optional bombing configuration
   */
  sample(
    map: Texture,
    uvCoords: Node,
    blendAmount: number = 0.5,
    config?: BombingConfig
  ): Node {
    const useRotation = config?.rotation ?? true;
    const useOffset = config?.offset ?? true;

    // Cell decomposition
    const cellUV = floor(uvCoords);
    const localUV = fract(uvCoords);

    // Find two closest jittered cell features (Voronoi-style) to reduce seams.
    let nearestDist: Node = float(1e6);
    let secondDist: Node = float(1e6);
    let nearestCell: Node = cellUV;
    let secondCell: Node = cellUV;
    let nearestHash: Node = this.hash2D(cellUV);
    let secondHash: Node = nearestHash;

    const offsets = [
      vec2(-1, -1), vec2(0, -1), vec2(1, -1),
      vec2(-1, 0), vec2(0, 0), vec2(1, 0),
      vec2(-1, 1), vec2(0, 1), vec2(1, 1)
    ];

    for (const offset of offsets) {
      const candidateCell = cellUV.add(offset);
      const candidateHash = this.hash2D(candidateCell);

      // Jitter feature point within candidate cell.
      const feature = offset.add(candidateHash.xy.mul(0.8).add(0.1));
      const delta = localUV.sub(feature);
      const dist = dot(delta, delta);

      const isNewNearest = dist.lessThan(nearestDist);
      const isNewSecond = dist.lessThan(secondDist).and(dist.greaterThanEqual(nearestDist));

      // Shift nearest to second when a new nearest is found.
      secondDist = select(isNewNearest, nearestDist, secondDist);
      secondCell = select(isNewNearest, nearestCell, secondCell);
      secondHash = select(isNewNearest, nearestHash, secondHash);

      nearestDist = select(isNewNearest, dist, nearestDist);
      nearestCell = select(isNewNearest, candidateCell, nearestCell);
      nearestHash = select(isNewNearest, candidateHash, nearestHash);

      secondDist = select(isNewSecond, dist, secondDist);
      secondCell = select(isNewSecond, candidateCell, secondCell);
      secondHash = select(isNewSecond, candidateHash, secondHash);
    }

    const uvA = this.transformUV(localUV, nearestCell, nearestHash, useRotation, useOffset);
    const uvB = this.transformUV(localUV, secondCell, secondHash, useRotation, useOffset);
    const sampleA = texture(map, uvA);
    const sampleB = texture(map, uvB);

    // Blend only near Voronoi edges; keep nearest sample in cell interiors.
    const edgeDistance = secondDist.sub(nearestDist).max(0.0);
    const edgeWidth = float(0.05).add(float(blendAmount).mul(0.35));
    const edgeFactor = smoothstep(float(0.0), edgeWidth, edgeDistance);
    const neighborMix = float(1.0).sub(edgeFactor).mul(float(0.5).mul(blendAmount));

    return mix(sampleA, sampleB, neighborMix);
  }

  /**
   * Transform UV with random rotation and offset
   */
  private transformUV(
    fractionalUV: Node,
    integerUV: Node,
    hash: Node,
    useRotation: boolean,
    useOffset: boolean
  ): Node {
    let uv = fractionalUV;

    // Random offset within cell
    let offset: Node = vec2(0, 0);
    if (useOffset) {
      offset = hash.xy.mul(2.0).sub(1.0).mul(0.5);
    }

    // Random rotation
    if (useRotation) {
      const angle = hash.z.mul(6.28318530718); // 0 to 2*PI
      const cosA = cos(angle);
      const sinA = sin(angle);

      // Rotate UV around cell center
      const centeredUV = uv.sub(0.5);
      const rotatedU = centeredUV.x.mul(cosA).sub(centeredUV.y.mul(sinA));
      const rotatedV = centeredUV.x.mul(sinA).add(centeredUV.y.mul(cosA));
      uv = vec2(rotatedU, rotatedV).add(0.5);
    }

    // Add offset and tile
    return uv.add(offset).add(integerUV);
  }

  /**
   * Multi-sample bombing for higher quality (more expensive)
   */
  sampleMulti(
    map: Texture,
    uvCoords: Node,
    samples: number = 4,
    blendRadius: number = 0.5
  ): Node {
    const uvScaled = uvCoords.mul(1.0);
    const iuv = floor(uvScaled);
    const fuv = fract(uvScaled);

    let result: Node = float(0);
    let totalWeight: Node = float(0);

    // Sample from neighboring cells
    const offsets = [
      vec2(0, 0), vec2(1, 0), vec2(0, 1), vec2(1, 1),
      vec2(-1, 0), vec2(0, -1), vec2(-1, -1), vec2(1, -1)
    ];

    for (let i = 0; i < Math.min(samples, offsets.length); i++) {
      const offset = offsets[i];
      const cellUV = iuv.add(offset);
      const hash = this.hash2D(cellUV);

      const transformedUV = this.transformUV(fuv, cellUV, hash, true, true);
      const sample = texture(map, transformedUV);

      // Weight based on distance to cell center
      const cellCenter = offset.add(0.5);
      const dist = fuv.sub(cellCenter).length();
      const weight = smoothstep(float(blendRadius), float(0.0), dist);

      result = result.add(sample.mul(weight));
      totalWeight = totalWeight.add(weight);
    }

    return result.div(totalWeight.max(0.001));
  }

  /**
   * Hash function for generating pseudo-random values
   */
  private hash2D(p: Node): Node {
    const p3 = fract(vec3(p.xyx).mul(vec3(0.1031, 0.1030, 0.0973)));
    const dp = dot(p3, vec3(p3.y, p3.z, p3.x).add(33.33));
    return fract(vec3(dp, dp, dp).mul(vec3(p3.x, p3.y, p3.z).add(p3.yxz)));
  }

  /**
   * Hex grid bombing for more organic patterns
   */
  sampleHex(map: Texture, uvCoords: Node, blendAmount: number = 0.5): Node {
    // Convert to hex grid coordinates
    const hexUV = this.uvToHex(uvCoords);

    // Sample from hex cell
    const hash = this.hash2D(floor(hexUV));
    const transformedUV = this.transformUV(
      fract(hexUV),
      floor(hexUV),
      hash,
      true,
      true
    );

    return texture(map, transformedUV);
  }

  private uvToHex(uv: Node): Node {
    const q = uv.x;
    const r = uv.y.mul(1.1547).sub(uv.x.mul(0.5774));
    return vec2(q, r);
  }
}
