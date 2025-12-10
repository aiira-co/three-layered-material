export interface BlendModeConfig {
  color?: 'normal' | 'multiply' | 'overlay' | 'screen' | 'add' | 'subtract' | 'divide' | 'darken' | 'lighten';
  normal?: 'rnb' | 'linear' | 'whiteout' | 'udn' | 'partial_derivative' | 'overlay';
  roughness?: 'min' | 'max' | 'multiply' | 'average' | 'normal';
  metalness?: 'min' | 'max' | 'multiply' | 'average' | 'normal';
  ao?: 'min' | 'max' | 'multiply' | 'normal';
}
