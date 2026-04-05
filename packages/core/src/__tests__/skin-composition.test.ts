import { describe, expect, it } from 'vitest';
import { RegionAttachment } from '../Attachment.js';
import { Skin } from '../Skin.js';

describe('Skin composition', () => {
  it('stores and retrieves attachments by (slotIndex, name)', () => {
    const skin = new Skin('test');
    const att = new RegionAttachment('body');
    skin.setAttachment(0, 'body', att);

    expect(skin.getAttachment(0, 'body')).toBe(att);
    expect(skin.getAttachment(0, 'other')).toBeNull();
    expect(skin.getAttachment(1, 'body')).toBeNull();
  });

  it('addSkin merges two skins together', () => {
    const skinA = new Skin('skinA');
    const attA1 = new RegionAttachment('helmet');
    const attA2 = new RegionAttachment('sword');
    skinA.setAttachment(0, 'helmet', attA1);
    skinA.setAttachment(1, 'sword', attA2);

    const skinB = new Skin('skinB');
    const attB1 = new RegionAttachment('shield');
    const attB2 = new RegionAttachment('boots');
    skinB.setAttachment(2, 'shield', attB1);
    skinB.setAttachment(3, 'boots', attB2);

    const combined = new Skin('combined');
    combined.addSkin(skinA);
    combined.addSkin(skinB);

    expect(combined.getAttachment(0, 'helmet')).toBe(attA1);
    expect(combined.getAttachment(1, 'sword')).toBe(attA2);
    expect(combined.getAttachment(2, 'shield')).toBe(attB1);
    expect(combined.getAttachment(3, 'boots')).toBe(attB2);
  });

  it('addSkin overwrites duplicate keys', () => {
    const skinA = new Skin('skinA');
    const att1 = new RegionAttachment('body-v1');
    skinA.setAttachment(0, 'body', att1);

    const skinB = new Skin('skinB');
    const att2 = new RegionAttachment('body-v2');
    skinB.setAttachment(0, 'body', att2);

    const combined = new Skin('combined');
    combined.addSkin(skinA);
    combined.addSkin(skinB);

    // skinB's attachment should overwrite skinA's
    expect(combined.getAttachment(0, 'body')).toBe(att2);
  });

  it('getEntries returns all attachments', () => {
    const skin = new Skin('test');
    skin.setAttachment(0, 'a', new RegionAttachment('a'));
    skin.setAttachment(1, 'b', new RegionAttachment('b'));
    skin.setAttachment(2, 'c', new RegionAttachment('c'));

    const entries = skin.getEntries();
    expect(entries).toHaveLength(3);
    const names = entries.map((e) => e.name).sort();
    expect(names).toEqual(['a', 'b', 'c']);
  });
});
