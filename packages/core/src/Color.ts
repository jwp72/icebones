/**
 * RGBA color with values in the 0–1 float range.
 */
export class Color {
  r: number;
  g: number;
  b: number;
  a: number;

  constructor(r = 0, g = 0, b = 0, a = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  set(r: number, g: number, b: number, a: number): this {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
    return this;
  }

  /**
   * Parse an 8-character hex string (RRGGBBAA) into this color.
   * Also accepts 6-character (RRGGBB, alpha defaults to 1).
   */
  setFromString(hex: string): this {
    const h = hex.startsWith('#') ? hex.slice(1) : hex;
    if (h.length === 8) {
      this.r = parseInt(h.substring(0, 2), 16) / 255;
      this.g = parseInt(h.substring(2, 4), 16) / 255;
      this.b = parseInt(h.substring(4, 6), 16) / 255;
      this.a = parseInt(h.substring(6, 8), 16) / 255;
    } else if (h.length === 6) {
      this.r = parseInt(h.substring(0, 2), 16) / 255;
      this.g = parseInt(h.substring(2, 4), 16) / 255;
      this.b = parseInt(h.substring(4, 6), 16) / 255;
      this.a = 1;
    }
    return this;
  }

  clone(): Color {
    return new Color(this.r, this.g, this.b, this.a);
  }
}
