import { Animation } from './Animation.js';
import { Skin } from './Skin.js';

/**
 * Immutable data for a bone as loaded from JSON.
 */
export interface BoneData {
  index: number;
  name: string;
  parentIndex: number; // -1 for root
  length: number;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Immutable data for a slot as loaded from JSON.
 */
export interface SlotData {
  index: number;
  name: string;
  boneIndex: number;
  attachmentName: string | null;
  color: string; // hex "rrggbbaa"
}

/**
 * Immutable skeleton definition loaded from JSON.
 * Contains arrays of bone data, slot data, skin definitions, and animation definitions.
 */
export class SkeletonData {
  name = '';
  width = 0;
  height = 0;
  bones: BoneData[] = [];
  slots: SlotData[] = [];
  skins: Skin[] = [];
  animations: Animation[] = [];

  findBone(name: string): BoneData | null {
    return this.bones.find((b) => b.name === name) ?? null;
  }

  findBoneIndex(name: string): number {
    return this.bones.findIndex((b) => b.name === name);
  }

  findSlot(name: string): SlotData | null {
    return this.slots.find((s) => s.name === name) ?? null;
  }

  findSlotIndex(name: string): number {
    return this.slots.findIndex((s) => s.name === name);
  }

  findSkin(name: string): Skin | null {
    return this.skins.find((s) => s.name === name) ?? null;
  }

  findAnimation(name: string): Animation | null {
    return this.animations.find((a) => a.name === name) ?? null;
  }
}
