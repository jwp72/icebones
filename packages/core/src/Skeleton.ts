import { Bone } from './Bone.js';
import { Skin } from './Skin.js';
import { Slot } from './Slot.js';
import type { SkeletonData } from './SkeletonData.js';

/**
 * A mutable skeleton instance created from immutable SkeletonData.
 *
 * Owns live Bone and Slot arrays. Supports skin switching and world-transform updates.
 */
export class Skeleton {
  data: SkeletonData;
  bones: Bone[];
  slots: Slot[];
  skin: Skin | null = null;

  constructor(data: SkeletonData) {
    this.data = data;

    // Create bones in order (parents are always before children).
    this.bones = [];
    for (const bd of data.bones) {
      const parent = bd.parentIndex >= 0 ? this.bones[bd.parentIndex] : null;
      const bone = new Bone(bd.name, parent, bd.length);
      bone.x = bd.x;
      bone.y = bd.y;
      bone.rotation = bd.rotation;
      bone.scaleX = bd.scaleX;
      bone.scaleY = bd.scaleY;
      this.bones.push(bone);
    }

    // Create slots.
    this.slots = [];
    for (const sd of data.slots) {
      const bone = this.bones[sd.boneIndex];
      const slot = new Slot(sd.name, bone);
      slot.attachmentName = sd.attachmentName;
      if (sd.color) {
        slot.color.setFromString(sd.color);
      }
      this.slots.push(slot);
    }
  }

  /**
   * Set the active skin, then apply setup-pose attachments from it.
   */
  setSkin(skin: Skin | null): void {
    this.skin = skin;
    this.setSlotsToSetupPose();
  }

  /**
   * Reset all slots to their setup-pose attachment from the current skin.
   * For slots with no default attachment name, checks if the skin provides
   * any attachment for that slot (equipment skin composition).
   */
  setSlotsToSetupPose(): void {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const sd = this.data.slots[i];
      // Restore color
      if (sd.color) {
        slot.color.setFromString(sd.color);
      } else {
        slot.color.set(1, 1, 1, 1);
      }
      // Restore attachment from skin
      if (sd.attachmentName && this.skin) {
        slot.attachment = this.skin.getAttachment(i, sd.attachmentName);
      } else {
        slot.attachment = null;
      }
    }

    // For slots still null, check if the skin has any attachment for that slot.
    // This handles equipment skins where the slot has no default attachment.
    if (this.skin) {
      for (const entry of this.skin.getEntries()) {
        const slot = this.slots[entry.slotIndex];
        if (slot && slot.attachment === null) {
          slot.attachment = entry.attachment;
        }
      }
    }
  }

  /**
   * Compute world transforms for all bones (parent-first order).
   */
  updateWorldTransform(): void {
    for (const bone of this.bones) {
      bone.updateWorldTransform();
    }
  }

  findBone(name: string): Bone | null {
    return this.bones.find((b) => b.name === name) ?? null;
  }

  findSlot(name: string): Slot | null {
    return this.slots.find((s) => s.name === name) ?? null;
  }

  findBoneIndex(name: string): number {
    return this.bones.findIndex((b) => b.name === name);
  }

  findSlotIndex(name: string): number {
    return this.slots.findIndex((s) => s.name === name);
  }
}
