import { Container, Sprite, Texture, Graphics, Ticker } from 'pixi.js';
import {
  Skeleton,
  AnimationState,
  SkeletonData,
  RegionAttachment,
} from '@icebones/core';

/**
 * PixiJS 8 renderer for an IceBones skeleton.
 *
 * Extends `Container` so it can be added directly to a PixiJS stage.
 * Automatically updates the skeleton animation each frame when `autoUpdate` is true.
 *
 * Usage:
 * ```ts
 * const data = new SkeletonJson().readSkeletonData(json);
 * const renderer = new SkeletonRenderer(data);
 * renderer.setRegionTextures(myTextures);
 * renderer.animationState.setAnimation(0, 'idle', true);
 * app.stage.addChild(renderer);
 * ```
 */
export class SkeletonRenderer extends Container {
  skeleton: Skeleton;
  animationState: AnimationState;
  autoUpdate = true;
  debug = false;

  /** Maps slotIndex to its Sprite child. */
  private slotSprites: Map<number, Sprite> = new Map();

  /** Region name/attachment name to PixiJS Texture. */
  private regionTextures: Map<string, Texture> = new Map();

  /** Graphics object for debug drawing. */
  private debugGraphics: Graphics | null = null;

  /** Stored ticker callback so we can remove it on destroy. */
  private tickerCallback: ((ticker: Ticker) => void) | null = null;

  /** Whether we have already hooked into the shared ticker. */
  private tickerBound = false;

  constructor(skeletonData: SkeletonData) {
    super();
    this.skeleton = new Skeleton(skeletonData);
    this.animationState = new AnimationState(skeletonData);

    // Hook into PixiJS shared ticker for auto-update.
    this.tickerCallback = (ticker: Ticker) => {
      if (this.autoUpdate) {
        // PixiJS 8 Ticker.deltaTime is in frames; deltaMS is milliseconds.
        // Convert ms to seconds for IceBones which expects seconds.
        this.update(ticker.deltaMS / 1000);
      }
    };

    // Bind on the next frame via onRender to ensure we are in a stage.
    this.onRender = this._firstRender.bind(this);
  }

  /**
   * Called on the first render frame. Hooks into the shared Ticker and
   * replaces itself with a no-op so it only fires once.
   */
  private _firstRender(): void {
    if (!this.tickerBound && this.tickerCallback) {
      Ticker.shared.add(this.tickerCallback);
      this.tickerBound = true;
    }
    // Remove the onRender hook — we only needed it once.
    this.onRender = undefined as unknown as () => void;
  }

  /**
   * Provide textures for region attachments.
   * Maps region/attachment name to a PixiJS Texture.
   */
  setRegionTextures(textures: Map<string, Texture> | Record<string, Texture>): void {
    if (textures instanceof Map) {
      this.regionTextures = new Map(textures);
    } else {
      this.regionTextures = new Map(Object.entries(textures));
    }
  }

  /**
   * Manually advance the skeleton by `dt` seconds.
   * Called automatically each frame when `autoUpdate` is true.
   */
  update(dt: number): void {
    this.animationState.update(dt);
    this.animationState.apply(this.skeleton);
    this.skeleton.updateWorldTransform();
    this.syncSprites();
    if (this.debug) {
      this.drawDebug();
    }
  }

  /**
   * Synchronise PixiJS sprites to match the skeleton's current bone/slot state.
   *
   * Iterates slots in draw order and creates/updates/hides sprites as needed.
   */
  private syncSprites(): void {
    const slots = this.skeleton.slots;

    // Track which slot indices are active this frame so we can hide stale ones.
    const activeSlots = new Set<number>();

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const attachment = slot.attachment;

      if (!attachment || !(attachment instanceof RegionAttachment)) {
        // No visible attachment — hide the sprite if it exists.
        const existing = this.slotSprites.get(i);
        if (existing) {
          existing.visible = false;
        }
        continue;
      }

      activeSlots.add(i);

      const region = attachment as RegionAttachment;

      // Resolve texture by regionName first, then attachment name as fallback.
      const texture =
        this.regionTextures.get(region.regionName) ??
        this.regionTextures.get(region.name) ??
        null;

      // Get or create sprite for this slot.
      let sprite = this.slotSprites.get(i);
      if (!sprite) {
        sprite = new Sprite();
        sprite.anchor.set(0.5, 0.5);
        this.slotSprites.set(i, sprite);
        this.addChild(sprite);
      }

      sprite.visible = true;

      if (texture) {
        sprite.texture = texture;
      }

      // Compute world vertices to position the sprite.
      // We use the bone's world transform combined with the attachment's local transform.
      const bone = slot.bone;

      // Scale the attachment to match its declared width/height vs texture pixel size.
      // This is how Spine works: attachment width/height define the display size,
      // and the texture is scaled to fit.
      let texScaleX = region.scaleX;
      let texScaleY = region.scaleY;
      if (texture && texture.width > 0 && texture.height > 0) {
        texScaleX *= region.width / texture.width;
        texScaleY *= region.height / texture.height;
      }

      // The attachment has its own local offset/rotation/scale on top of the bone.
      // Compute the combined transform: bone world * attachment local.
      const attRad = (region.rotation * Math.PI) / 180;
      const attCos = Math.cos(attRad);
      const attSin = Math.sin(attRad);
      const la = attCos * texScaleX;
      const lb = attSin * texScaleX;
      const lc = -attSin * texScaleY;
      const ld = attCos * texScaleY;

      // Combined world transform for attachment center:
      // Position = bone.world * attachment.localPos
      const worldPosX = bone.a * region.x + bone.b * region.y + bone.worldX;
      const worldPosY = bone.c * region.x + bone.d * region.y + bone.worldY;

      // Combined rotation + scale matrix: bone.world * attachment.local
      const wa = bone.a * la + bone.b * lc;
      const wb = bone.a * lb + bone.b * ld;
      const wc = bone.c * la + bone.d * lc;
      const wd = bone.c * lb + bone.d * ld;

      sprite.position.set(worldPosX, worldPosY);

      // Extract rotation from the combined matrix.
      sprite.rotation = Math.atan2(wc, wa);

      // Extract scale from the combined matrix.
      // scaleX = length of column 0 (wa, wc), scaleY = length of column 1 (wb, wd)
      const sx = Math.sqrt(wa * wa + wc * wc);
      const sy = Math.sqrt(wb * wb + wd * wd);

      // Detect negative scale via cross product (determinant).
      const det = wa * wd - wb * wc;
      sprite.scale.set(sx, det < 0 ? -sy : sy);

      // Apply slot colour as tint and alpha.
      const { r, g, b, a } = slot.color;
      sprite.tint =
        (Math.round(r * 255) << 16) |
        (Math.round(g * 255) << 8) |
        Math.round(b * 255);
      sprite.alpha = a;

      // Maintain draw order: ensure child order matches slot order.
      // We'll reorder at the end.
    }

    // Reorder children so slot draw order is respected.
    // Collect visible sprites in slot order, then re-add them.
    const orderedChildren: Sprite[] = [];
    for (let i = 0; i < slots.length; i++) {
      const sprite = this.slotSprites.get(i);
      if (sprite && sprite.visible) {
        orderedChildren.push(sprite);
      }
    }

    // Only reorder if needed (keep debug graphics at the end).
    for (let idx = 0; idx < orderedChildren.length; idx++) {
      const sprite = orderedChildren[idx];
      const currentIndex = this.getChildIndex(sprite);
      if (currentIndex !== idx) {
        this.setChildIndex(sprite, idx);
      }
    }
  }

  /**
   * Draw debug visualisation: bone lines, bone positions, and attachment bounds.
   */
  private drawDebug(): void {
    if (!this.debugGraphics) {
      this.debugGraphics = new Graphics();
      this.addChild(this.debugGraphics);
    }

    const gfx = this.debugGraphics;
    gfx.clear();

    // Ensure debug graphics are on top.
    if (this.children.indexOf(gfx) !== this.children.length - 1) {
      this.setChildIndex(gfx, this.children.length - 1);
    }

    const bones = this.skeleton.bones;

    // Draw bones: green lines from bone to parent, green circles at bone positions.
    for (const bone of bones) {
      // Small circle at bone world position.
      gfx.circle(bone.worldX, bone.worldY, 3);
      gfx.fill({ color: 0x00ff00, alpha: 0.8 });

      // Line to parent.
      if (bone.parent) {
        gfx.moveTo(bone.parent.worldX, bone.parent.worldY);
        gfx.lineTo(bone.worldX, bone.worldY);
        gfx.stroke({ width: 1, color: 0x00ff00, alpha: 0.6 });
      }
    }

    // Draw attachment bounds (yellow rectangles).
    const slots = this.skeleton.slots;
    for (const slot of slots) {
      if (slot.attachment && slot.attachment instanceof RegionAttachment) {
        const region = slot.attachment as RegionAttachment;
        const verts: number[] = new Array(8);
        region.computeWorldVertices(slot.bone, verts, 0);

        gfx.moveTo(verts[0], verts[1]);
        gfx.lineTo(verts[2], verts[3]);
        gfx.lineTo(verts[4], verts[5]);
        gfx.lineTo(verts[6], verts[7]);
        gfx.closePath();
        gfx.stroke({ width: 1, color: 0xffff00, alpha: 0.5 });
      }
    }
  }

  /**
   * Clean up ticker listener and internal state.
   */
  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    // Remove ticker callback.
    if (this.tickerCallback && this.tickerBound) {
      Ticker.shared.remove(this.tickerCallback);
      this.tickerCallback = null;
      this.tickerBound = false;
    }

    // Clear sprite references.
    this.slotSprites.clear();
    this.regionTextures.clear();
    this.debugGraphics = null;

    super.destroy(options);
  }
}
