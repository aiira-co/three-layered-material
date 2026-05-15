export interface TriplanarConfig {
  enable?: boolean;
  useWorldPosition?: boolean;
  scale?: number;
  /**
   * Higher values make axis transitions tighter and reduce contribution from
   * off-axis projections. Useful for directional textures.
   */
  sharpness?: number;
  /**
   * Removes weak projection weights before normalization. This helps suppress
   * faint lines from the other two planes on broad surfaces.
   */
  cutoff?: number;
}
