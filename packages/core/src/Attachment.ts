import { Bone } from './Bone.js';

/**
 * Base class for visual attachments bound to a slot.
 */
export class Attachment {
  name: string;

  constructor(name: string) {
    this.name = name;
  }
}

/**
 * A rectangular region attachment (sprite).
 *
 * Has its own local offset (x, y, rotation, scaleX, scaleY) relative to
 * the bone it is attached to, plus width/height for the region dimensions.
 */
export class RegionAttachment extends Attachment {
  x = 0;
  y = 0;
  rotation = 0;
  scaleX = 1;
  scaleY = 1;
  width = 0;
  height = 0;
  regionName: string;

  constructor(name: string) {
    super(name);
    this.regionName = name;
  }

  /**
   * Compute the 4 corner vertices of this region in world space.
   *
   * The region is centered at its local (x, y) with the given width/height,
   * then transformed by the bone's world matrix.
   *
   * @param bone - The bone whose world transform to use.
   * @param worldVertices - Output array to write 8 floats (x0,y0, x1,y1, x2,y2, x3,y3).
   * @param offset - Starting index in the output array.
   */
  computeWorldVertices(bone: Bone, worldVertices: number[], offset: number): void {
    const rad = (this.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const localA = cos * this.scaleX;
    const localB = sin * this.scaleX;
    const localC = -sin * this.scaleY;
    const localD = cos * this.scaleY;

    const hw = this.width / 2;
    const hh = this.height / 2;

    // 4 corners in region-local space (before attachment transform)
    const corners = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ];

    for (let i = 0; i < 4; i++) {
      const cx = corners[i][0];
      const cy = corners[i][1];

      // Apply attachment local transform
      const lx = localA * cx + localC * cy + this.x;
      const ly = localB * cx + localD * cy + this.y;

      // Apply bone world transform
      worldVertices[offset + i * 2] = bone.a * lx + bone.b * ly + bone.worldX;
      worldVertices[offset + i * 2 + 1] = bone.c * lx + bone.d * ly + bone.worldY;
    }
  }
}
