import { Attachment } from './Attachment.js';

/**
 * Composite key for the skin's attachment map: slotIndex + attachment name.
 */
function skinKey(slotIndex: number, name: string): string {
  return `${slotIndex}:${name}`;
}

/**
 * A skin is a named set of attachments.
 *
 * Each entry maps (slotIndex, attachmentName) to an Attachment instance.
 * A skeleton can switch skins at runtime, swapping all visuals at once.
 */
export class Skin {
  name: string;
  private attachments = new Map<string, Attachment>();

  constructor(name: string) {
    this.name = name;
  }

  setAttachment(slotIndex: number, name: string, attachment: Attachment): void {
    this.attachments.set(skinKey(slotIndex, name), attachment);
  }

  getAttachment(slotIndex: number, name: string): Attachment | null {
    return this.attachments.get(skinKey(slotIndex, name)) ?? null;
  }

  /**
   * Copy all attachments from another skin into this one, overwriting duplicates.
   */
  addSkin(other: Skin): void {
    for (const [key, attachment] of other.attachments) {
      this.attachments.set(key, attachment);
    }
  }

  /** Iterate over all entries. Useful for JSON export / debugging. */
  getEntries(): Array<{ slotIndex: number; name: string; attachment: Attachment }> {
    const result: Array<{ slotIndex: number; name: string; attachment: Attachment }> = [];
    for (const [key, attachment] of this.attachments) {
      const sep = key.indexOf(':');
      const slotIndex = parseInt(key.substring(0, sep), 10);
      const name = key.substring(sep + 1);
      result.push({ slotIndex, name, attachment });
    }
    return result;
  }
}
