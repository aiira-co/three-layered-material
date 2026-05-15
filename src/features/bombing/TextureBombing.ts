
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
    if ((config?.mode ?? 'voronoi') === 'hex') {
      return this.sampleHex(map, uvCoords, blendAmount, config);
    }

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

    const uvA = this.transformUV(localUV, nearestCell, nearestHash, useRotation, useOffset, config?.scaleJitter ?? 0.0).uv;
    const uvB = this.transformUV(localUV, secondCell, secondHash, useRotation, useOffset, config?.scaleJitter ?? 0.0).uv;
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
    useOffset: boolean,
    scaleJitter: number = 0.0
  ): { uv: Node; angle: Node; scale: Node } {
    const jitterScale = float(1.0).add(hash.y.sub(0.5).mul(float(scaleJitter)));
    let uv = fractionalUV.sub(0.5).div(jitterScale).add(0.5);
    let angle: Node = float(0.0);

    // Random offset within cell
    let offset: Node = vec2(0, 0);
    if (useOffset) {
      offset = hash.xy.mul(2.0).sub(1.0).mul(0.5);
    }

    // Random rotation
    if (useRotation) {
      angle = hash.z.mul(6.28318530718); // 0 to 2*PI
      const cosA = cos(angle);
      const sinA = sin(angle);

      // Rotate UV around cell center
      const centeredUV = uv.sub(0.5);
      const rotatedU = centeredUV.x.mul(cosA).sub(centeredUV.y.mul(sinA));
      const rotatedV = centeredUV.x.mul(sinA).add(centeredUV.y.mul(cosA));
      uv = vec2(rotatedU, rotatedV).add(0.5);
    }

    // Add offset and tile
    return { uv: uv.add(offset).add(integerUV), angle, scale: jitterScale };
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

      const transformedUV = this.transformUV(fuv, cellUV, hash, true, true).uv;
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

  private uvToHex(uv: Node): Node {
    const q = uv.x;
    const r = uv.y.mul(1.1547).sub(uv.x.mul(0.5774));
    return vec2(q, r);
  }

  /**
   * Hex-grid scatter with a second neighbor sample near cell edges.
   */
  sampleHex(map: Texture, uvCoords: Node, blendAmount: number = 0.5, config?: BombingConfig): Node {
    const pair = this.getHexScatterPair(uvCoords, blendAmount, config);
    return mix(texture(map, pair.uvA), texture(map, pair.uvB), pair.blend);
  }

  /**
   * Normal-map variant that rotates tangent-space normals with the sampled cell.
   */
  sampleNormal(map: Texture, uvCoords: Node, blendAmount: number = 0.5, config?: BombingConfig): Node {
    const pair = this.getHexScatterPair(uvCoords, blendAmount, config);
    const sampleA = texture(map, pair.uvA).xyz.mul(2.0).sub(1.0);
    const sampleB = texture(map, pair.uvB).xyz.mul(2.0).sub(1.0);
    const shouldCorrect = config?.normalCorrection ?? ((config?.mode ?? 'voronoi') === 'hex');
    const normalA = shouldCorrect ? this.rotateNormalForCell(sampleA, pair.angleA) : sampleA;
    const normalB = shouldCorrect ? this.rotateNormalForCell(sampleB, pair.angleB) : sampleB;
    return (mix(normalA, normalB, pair.blend) as any).normalize();
  }

  private getHexScatterPair(
    uvCoords: Node,
    blendAmount: number = 0.5,
    config?: BombingConfig
  ): { uvA: Node; uvB: Node; angleA: Node; angleB: Node; blend: Node } {
    const hexUV = this.uvToHex(uvCoords);
    const cell = floor(hexUV);
    const localUV = fract(hexUV);
    const hashA = this.hash2D(cell);
    const neighborCell = cell.add(vec2(1, 0));
    const hashB = this.hash2D(neighborCell);
    const useRotation = config?.rotation ?? true;
    const useOffset = config?.offset ?? true;
    const scaleJitter = config?.scaleJitter ?? 0.0;
    const transformA = this.transformUV(localUV, cell, hashA, useRotation, useOffset, scaleJitter);
    const transformB = this.transformUV(localUV, neighborCell, hashB, useRotation, useOffset, scaleJitter);

    const local = localUV as any;
    const interiorX = smoothstep(float(0.0), float(0.18), local.x)
      .mul(float(1.0).sub(smoothstep(float(0.82), float(1.0), local.x)));
    const interiorY = smoothstep(float(0.0), float(0.18), local.y)
      .mul(float(1.0).sub(smoothstep(float(0.82), float(1.0), local.y)));
    const edgeMask = float(1.0).sub(interiorX.mul(interiorY));
    const blend = edgeMask.mul(float(blendAmount).mul(0.5)).clamp(0.0, 1.0);

    return { uvA: transformA.uv, uvB: transformB.uv, angleA: transformA.angle, angleB: transformB.angle, blend };
  }

  private rotateNormalForCell(normal: Node, angle: Node): Node {
    const cosA = cos(angle);
    const sinA = sin(angle);
    return vec3(
      normal.x.mul(cosA).sub(normal.y.mul(sinA)),
      normal.x.mul(sinA).add(normal.y.mul(cosA)),
      normal.z
    ).normalize();
  }
}
