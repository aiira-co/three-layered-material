import { Node } from "three/webgpu";
import { mix, float, saturate, pow } from "three/tsl";
import { ColorBlendMode } from "./BlendModeConfig";

/**
 * Handles all color blending operations between layers
 * Implements various Photoshop-style blend modes
 */
export class ColorBlender {
  /**
   * Blend two colors using specified blend mode
   * @param baseColor - Bottom layer color
   * @param topColor - Top layer color
   * @param blendFactor - Blend amount (0-1)
   * @param mode - Blend mode to use
   */
  blend(
    baseColor: Node,
    topColor: Node,
    blendFactor: Node,
    mode: ColorBlendMode = 'normal'
  ): Node {
    let blendedColor: Node;

    switch (mode) {
      case 'multiply':
        blendedColor = this.multiply(baseColor, topColor);
        break;

      case 'overlay':
        blendedColor = this.overlay(baseColor, topColor);
        break;

      case 'screen':
        blendedColor = this.screen(baseColor, topColor);
        break;

      case 'add':
        blendedColor = this.add(baseColor, topColor);
        break;

      case 'subtract':
        blendedColor = this.subtract(baseColor, topColor);
        break;

      case 'divide':
        blendedColor = this.divide(baseColor, topColor);
        break;

      case 'darken':
        blendedColor = this.darken(baseColor, topColor);
        break;

      case 'lighten':
        blendedColor = this.lighten(baseColor, topColor);
        break;

      case 'color-burn':
        blendedColor = this.colorBurn(baseColor, topColor);
        break;

      case 'color-dodge':
        blendedColor = this.colorDodge(baseColor, topColor);
        break;

      case 'soft-light':
        blendedColor = this.softLight(baseColor, topColor);
        break;

      case 'hard-light':
        blendedColor = this.hardLight(baseColor, topColor);
        break;

      default: // 'normal'
        return mix(baseColor, topColor, blendFactor);
    }

    // Apply blend factor
    return mix(baseColor, blendedColor, blendFactor);
  }

  private multiply(base: Node, top: Node): Node {
    return base.mul(top);
  }

  private screen(base: Node, top: Node): Node {
    // screen = 1 - (1-base) * (1-top)
    return float(1.0).sub(
      float(1.0).sub(base).mul(float(1.0).sub(top))
    );
  }

  private overlay(base: Node, top: Node): Node {
    // if base < 0.5: 2 * base * top
    // else: 1 - 2 * (1-base) * (1-top)
    const multiply = base.mul(top).mul(2.0);
    const screen = float(1.0).sub(
      float(1.0).sub(base).mul(float(1.0).sub(top)).mul(2.0)
    );

    // Mix based on base color luminance
    const threshold = float(0.5);
    const condition = base.lessThan(threshold);
    return mix(screen, multiply, condition);
  }

  private add(base: Node, top: Node): Node {
    return saturate(base.add(top));
  }

  private subtract(base: Node, top: Node): Node {
    return saturate(base.sub(top));
  }

  private divide(base: Node, top: Node): Node {
    // Prevent division by zero
    const safeTop = top.max(0.001);
    return saturate(base.div(safeTop));
  }

  private darken(base: Node, top: Node): Node {
    return base.min(top);
  }

  private lighten(base: Node, top: Node): Node {
    return base.max(top);
  }

  private colorBurn(base: Node, top: Node): Node {
    // colorBurn = 1 - (1 - base) / top
    const safeTop = top.max(0.001);
    return saturate(
      float(1.0).sub(float(1.0).sub(base).div(safeTop))
    );
  }

  private colorDodge(base: Node, top: Node): Node {
    // colorDodge = base / (1 - top)
    const denominator = float(1.0).sub(top).max(0.001);
    return saturate(base.div(denominator));
  }

  private softLight(base: Node, top: Node): Node {
    // Photoshop-style soft light
    // if top < 0.5: base - (1-2*top) * base * (1-base)
    // else: base + (2*top-1) * (sqrt(base) - base)
    const multiply = base.sub(
      float(1.0).sub(top.mul(2.0)).mul(base).mul(float(1.0).sub(base))
    );
    const screen = base.add(
      top.mul(2.0).sub(1.0).mul(base.sqrt().sub(base))
    );

    const condition = top.lessThan(0.5);
    return mix(screen, multiply, condition);
  }

  private hardLight(base: Node, top: Node): Node {
    // Hard light is overlay with base and top swapped
    const multiply = base.mul(top).mul(2.0);
    const screen = float(1.0).sub(
      float(1.0).sub(base).mul(float(1.0).sub(top)).mul(2.0)
    );

    const condition = top.lessThan(0.5);
    return mix(screen, multiply, condition);
  }
}
