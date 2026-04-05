/**
 * A bone in a skeletal hierarchy.
 *
 * Local transform: x, y, rotation (degrees), scaleX, scaleY.
 * World transform: 2x3 affine matrix (a, b, c, d, worldX, worldY).
 *
 * World = Parent.world * Local  (or just Local if root).
 */
export class Bone {
  name: string;
  parent: Bone | null;
  children: Bone[] = [];
  length: number;

  // Local transform (relative to parent)
  x = 0;
  y = 0;
  rotation = 0; // degrees
  scaleX = 1;
  scaleY = 1;

  // World transform — 2x3 affine matrix
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  worldX = 0;
  worldY = 0;

  constructor(name: string, parent: Bone | null = null, length = 0) {
    this.name = name;
    this.parent = parent;
    this.length = length;
    if (parent) {
      parent.children.push(this);
    }
  }

  /**
   * Compute world transform by multiplying local transform with parent's world transform.
   *
   * Local matrix from (x, y, rotation, scaleX, scaleY):
   *   la = cos(rot) * scaleX
   *   lb = sin(rot) * scaleX
   *   lc = -sin(rot) * scaleY
   *   ld = cos(rot) * scaleY
   *   lx = x
   *   ly = y
   *
   * If parent exists: World = Parent * Local
   *   a  = pa * la + pb * lc
   *   b  = pa * lb + pb * ld
   *   c  = pc * la + pd * lc
   *   d  = pc * lb + pd * ld
   *   wx = pa * lx + pb * ly + pwx
   *   wy = pc * lx + pd * ly + pwy
   *
   * If no parent: World = Local
   */
  updateWorldTransform(): void {
    const rad = (this.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const la = cos * this.scaleX;
    const lb = sin * this.scaleX;
    const lc = -sin * this.scaleY;
    const ld = cos * this.scaleY;

    const p = this.parent;
    if (p) {
      this.a = p.a * la + p.b * lc;
      this.b = p.a * lb + p.b * ld;
      this.c = p.c * la + p.d * lc;
      this.d = p.c * lb + p.d * ld;
      this.worldX = p.a * this.x + p.b * this.y + p.worldX;
      this.worldY = p.c * this.x + p.d * this.y + p.worldY;
    } else {
      this.a = la;
      this.b = lb;
      this.c = lc;
      this.d = ld;
      this.worldX = this.x;
      this.worldY = this.y;
    }
  }
}
