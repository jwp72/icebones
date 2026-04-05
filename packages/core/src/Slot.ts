import { Attachment } from './Attachment.js';
import { Bone } from './Bone.js';
import { Color } from './Color.js';

/**
 * A slot references a bone and holds the current visual attachment + tint color.
 * Slots define the draw order of a skeleton.
 */
export class Slot {
  name: string;
  bone: Bone;
  color: Color;
  attachment: Attachment | null;

  /** The default attachment name from the setup pose (used by setSlotsToSetupPose). */
  attachmentName: string | null;

  constructor(name: string, bone: Bone) {
    this.name = name;
    this.bone = bone;
    this.color = new Color(1, 1, 1, 1);
    this.attachment = null;
    this.attachmentName = null;
  }
}
