export type ColorBlendMode =
  | 'normal'
  | 'multiply'
  | 'overlay'
  | 'screen'
  | 'add'
  | 'subtract'
  | 'divide'
  | 'darken'
  | 'lighten'
  | 'color-burn'
  | 'color-dodge'
  | 'soft-light'
  | 'hard-light';

export type NormalBlendMode =
  | 'rnb'                 // Reoriented Normal Blending (best)
  | 'linear'              // Simple linear interpolation
  | 'whiteout'            // Whiteout blending
  | 'udn'                 // Unity-style Detail Normal
  | 'partial_derivative'  // Partial derivative preservation
  | 'overlay';            // Overlay blending

export type ScalarBlendMode =
  | 'normal'              // Linear interpolation
  | 'min'                 // Take minimum value
  | 'max'                 // Take maximum value
  | 'multiply'            // Multiply values
  | 'average'             // Average of both
  | 'overlay'             // Overlay blend
  | 'add'                 // Additive
  | 'subtract';           // Subtractive

export interface BlendModeConfig {
  color?: ColorBlendMode;
  normal?: NormalBlendMode;
  roughness?: ScalarBlendMode;
  metalness?: ScalarBlendMode;
  ao?: ScalarBlendMode;
}
