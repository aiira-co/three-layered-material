import { cos, dot, float, normalWorld, positionWorld, pow, saturate, sin, smoothstep, vec3 } from "three/tsl";
import { Node } from "three/webgpu";
import { Noise } from "./Noise";

export class EdgeWear extends Noise {

  edgeWearMask(
    normal: Node,
    options: {
      intensity?: number;
      threshold?: number;
      falloff?: number;
      sharpness?: number;
      useNoise?: boolean; // Add variation
      wearPattern?: 'curvature' | 'ambient_occlusion' | 'world_space' | 'combined';
      curvatureMethod?: 'normal' | 'position' | 'simplified' | 'world' | 'laplace';
    } = {}
  ): Node {
    const {
      intensity = 1.0,
      threshold = 0.1,
      falloff = 0.3,
      sharpness = 2.0,
      useNoise = true,
      wearPattern = 'curvature',
      curvatureMethod = 'normal'
    } = options;

    let mask: Node;

    switch (wearPattern || 'curvature') {
      case 'ambient_occlusion':
        // Use screen-space ambient occlusion approximation
        mask = this.approximateSSAO();
        break;
      case 'world_space':
        // Wear based on world position and orientation
        const worldPos = positionWorld;
        const worldNorm = normalWorld;

        // Bottom-facing surfaces get more wear
        const upWear = dot(worldNorm, vec3(0, 1, 0)).oneMinus();

        // Surfaces facing dominant wind/water direction
        const windDir = vec3(1, 0, 0); // Example: wind from +X
        const windWear = dot(worldNorm, windDir).abs();

        // Combine factors
        mask = upWear.mul(0.7).add(windWear.mul(0.3));
        break;

      case 'combined':
        // Combine multiple wear patterns for most realistic results
        const curvatureWear = this.calculateAdvancedCurvature(normal, {
          method: curvatureMethod,
          intensity: 1.0,
          useMicroDetail: true
        });

        const ssaoWear = float(1.0).sub(this.approximateSSAO());
        const worldWear = dot(normalWorld, vec3(0, 1, 0)).oneMinus();

        mask = curvatureWear.mul(0.5)
          .add(ssaoWear.mul(0.3))
          .add(worldWear.mul(0.2));
        break;

      default:

        // Use curvature-based wear (most common)
        const curvature = this.calculateAdvancedCurvature(normal, {
          method: curvatureMethod,
          intensity: intensity,
          useMicroDetail: true
        });

        mask = smoothstep(
          float(threshold),
          float(threshold + falloff),
          curvature.mul(intensity)
        );
    }

    mask = pow(mask, float(sharpness || 2.0));

    // Add noise for natural variation
    if (useNoise) {
      const noise = this.fbmNoise(positionWorld.xz.mul(10.0), 3, 0.5);
      mask = mask.mul(noise.mul(0.4).add(0.6)); // 60-100% variation

      // Add micro-variation for more natural wear
      const microNoise = this.hash2D(positionWorld.xz.mul(50.0)).x;
      mask = mask.mul(microNoise.mul(0.1).add(0.95)); // 95-105% micro variation
    }


    return saturate(mask);
  }


  // private calculateCurvature(normal: Node): Node {
  //   /**
  //    * Calculate surface curvature based on normal variation
  //    * Higher curvature = more dramatic normal changes = sharper edges/corners
  //    */

  //   // Method 1: Using second derivatives of the normal (most accurate)
  //   const dX = normal.dFdx();
  //   const dY = normal.dFdy();

  //   // Curvature is proportional to the rate of change of the normal
  //   const curvature = dX.dot(dX).add(dY.dot(dY));

  //   // Alternative Method 2: Using world position derivatives (more stable)
  //   // const posDx = positionWorld.dFdx();
  //   // const posDy = positionWorld.dFdy();
  //   // const normalDx = normalWorld.dFdx();
  //   // const normalDy = normalWorld.dFdy();

  //   // Curvature as change in normal relative to surface change
  //   // const curvature = normalDx.dot(normalDx).add(normalDy.dot(normalDy))
  //   //   .div(posDx.dot(posDx).add(posDy.dot(posDy)).add(0.0001));

  //   return curvature.sqrt(); // Convert to more linear response
  // }


  private calculateAdvancedCurvature(
    normal: Node,
    options: {
      method?: 'normal' | 'position' | 'simplified' | 'world' | 'laplace';
      intensity?: number;
      useMicroDetail?: boolean;
    } = {}
  ): Node {
    const {
      method = 'normal',
      intensity = 1.0,
      useMicroDetail = true
    } = options;

    let curvature: Node;

    switch (method) {
      case 'position':
        curvature = this.calculatePositionBasedCurvature();
        break;
      case 'simplified':
        curvature = this.calculateSimplifiedCurvature(normal);
        break;
      case 'world':
        curvature = this.calculateWorldNormalCurvature();
        break;
      case 'laplace':
        curvature = this.calculateLaplaceBeltramiCurvature();
        break;
      default: // 'normal'
        curvature = this.calculateNormalDerivativeCurvature(normal);
    }

    // Add high-frequency detail from normal maps
    if (useMicroDetail) {
      const microCurvature = normal.dFdx().dot(normal.dFdx())
        .add(normal.dFdy().dot(normal.dFdy()))
        .sqrt()
        .mul(0.5);

      curvature = curvature.add(microCurvature);
    }

    // Apply non-linear response curve
    curvature = pow(curvature, float(0.7)); // Compress high values

    return curvature.mul(float(intensity));
  }

  // Individual method implementations for the advanced version
  private calculateNormalDerivativeCurvature(normal: Node): Node {
    const dX = normal.dFdx();
    const dY = normal.dFdy();
    return dX.dot(dX).add(dY.dot(dY)).sqrt();
  }

  private calculatePositionBasedCurvature(): Node {
    const worldPos = positionWorld;
    const d2pdx2 = worldPos.dFdx().dFdx();
    const d2pdy2 = worldPos.dFdy().dFdy();
    const curvature = d2pdx2.dot(d2pdx2).add(d2pdy2.dot(d2pdy2));
    return curvature.sqrt().mul(0.1);
  }

  private calculateSimplifiedCurvature(normal: Node): Node {
    const normalZ = normal.z;
    const dZdx = normalZ.dFdx();
    const dZdy = normalZ.dFdy();
    return dZdx.mul(dZdx).add(dZdy.mul(dZdy)).sqrt().mul(2.0);
  }

  private calculateWorldNormalCurvature(): Node {
    const dX = normalWorld.dFdx();
    const dY = normalWorld.dFdy();
    return dX.dot(dX).add(dY.dot(dY)).sqrt();
  }

  private calculateLaplaceBeltramiCurvature(): Node {
    const worldPos = positionWorld;
    const dx = worldPos.dFdx();
    const dy = worldPos.dFdy();
    const dxx = dx.dFdx();
    const dyy = dy.dFdy();
    return dxx.dot(dxx).add(dyy.dot(dyy)).sqrt().mul(0.05);
  }

  private approximateSSAO(): Node {
    /**
     * Approximate Screen-Space Ambient Occlusion using local geometry
     * This is a cheap approximation that works well for edge wear
     */

    const worldPos = positionWorld;
    const worldNorm = normalWorld;

    // Sample surrounding positions in world space
    const sampleRadius = float(0.1);
    const samples = 4;

    let occlusion: Node = float(0.0);

    // Simple 4-sample SSAO approximation
    for (let i = 0; i < samples; i++) {
      // Create sample directions in tangent space
      const angle = float(i).div(float(samples)).mul(6.28318530718);
      const offset = vec3(cos(angle), sin(angle), 0.0).mul(sampleRadius);

      // Transform to world space using TBN-like basis
      const tangent = positionWorld.dFdx().normalize();
      const bitangent = positionWorld.dFdy().normalize();
      const sampleDir = tangent.mul(offset.x).add(bitangent.mul(offset.y));

      // Sample position at offset
      const samplePos = worldPos.add(sampleDir);

      // Simple height-based occlusion (cheaper than ray marching)
      // This assumes the geometry has some height variation
      const heightAtSample = this.getApproximateHeight(samplePos);
      const currentHeight = worldPos.y;

      // If sample position is lower than current, it might be occluded
      const heightDiff = currentHeight.sub(heightAtSample);
      occlusion = occlusion.add(saturate(heightDiff.mul(10.0)));
    }

    occlusion = occlusion.div(float(samples));

    // Alternative: Normal-based SSAO (even cheaper)
    // const normalOcclusion = dot(worldNorm, vec3(0, 1, 0)).oneMinus().pow(2.0);
    // occlusion = occlusion.mul(0.7).add(normalOcclusion.mul(0.3));

    return saturate(occlusion);
  }

  private getApproximateHeight(worldPos: Node): Node {
    /**
     * Cheap height approximation using noise and position
     * In a real scenario, you'd sample from a height map
     */

    // Use simple noise based on world position
    const noise = this.fbmNoise(worldPos.xz.mul(0.1), 2, 0.5);

    // Add some micro-variation
    const micro = this.hash2D(worldPos.xz.mul(2.0)).x.mul(0.05);

    return noise.add(micro);
  }

}
