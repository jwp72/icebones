import { describe, expect, it } from 'vitest';
import { Bone } from '../Bone.js';

describe('Bone transforms', () => {
  it('root bone world transform equals local transform', () => {
    const root = new Bone('root');
    root.x = 10;
    root.y = 20;
    root.updateWorldTransform();

    expect(root.worldX).toBe(10);
    expect(root.worldY).toBe(20);
    expect(root.a).toBeCloseTo(1);
    expect(root.d).toBeCloseTo(1);
  });

  it('child bone world position includes parent translation', () => {
    const root = new Bone('root');
    root.x = 100;
    root.y = 0;

    const hip = new Bone('hip', root);
    hip.x = 0;
    hip.y = 50;

    root.updateWorldTransform();
    hip.updateWorldTransform();

    expect(hip.worldX).toBeCloseTo(100);
    expect(hip.worldY).toBeCloseTo(50);
  });

  it('3-bone chain (root → hip → torso) computes correct world positions', () => {
    const root = new Bone('root');
    root.x = 0;
    root.y = 0;

    const hip = new Bone('hip', root);
    hip.x = 0;
    hip.y = 170;

    const torso = new Bone('torso', hip);
    torso.x = 0;
    torso.y = 100;

    root.updateWorldTransform();
    hip.updateWorldTransform();
    torso.updateWorldTransform();

    expect(root.worldX).toBeCloseTo(0);
    expect(root.worldY).toBeCloseTo(0);
    expect(hip.worldX).toBeCloseTo(0);
    expect(hip.worldY).toBeCloseTo(170);
    expect(torso.worldX).toBeCloseTo(0);
    expect(torso.worldY).toBeCloseTo(270);
  });

  it('parent rotation rotates child position', () => {
    const root = new Bone('root');
    root.x = 0;
    root.y = 0;
    root.rotation = 90; // 90 degrees CCW

    const child = new Bone('child', root);
    child.x = 100;
    child.y = 0;

    root.updateWorldTransform();
    child.updateWorldTransform();

    // After 90-degree rotation:
    // a=cos(90)≈0, b=sin(90)=1, c=-sin(90)=-1, d=cos(90)≈0
    // worldX = a*100 + b*0 = 0
    // worldY = c*100 + d*0 = -100
    expect(child.worldX).toBeCloseTo(0, 5);
    expect(child.worldY).toBeCloseTo(-100, 5);
  });

  it('parent scale affects child world position', () => {
    const root = new Bone('root');
    root.scaleX = 2;
    root.scaleY = 3;

    const child = new Bone('child', root);
    child.x = 10;
    child.y = 20;

    root.updateWorldTransform();
    child.updateWorldTransform();

    expect(child.worldX).toBeCloseTo(20); // 10 * 2
    expect(child.worldY).toBeCloseTo(60); // 20 * 3
  });

  it('combined rotation + translation in 3-bone chain', () => {
    const root = new Bone('root');
    root.x = 50;
    root.y = 50;

    const hip = new Bone('hip', root);
    hip.rotation = 90;
    hip.x = 0;
    hip.y = 0;

    const torso = new Bone('torso', hip);
    torso.x = 100;
    torso.y = 0;

    root.updateWorldTransform();
    hip.updateWorldTransform();
    torso.updateWorldTransform();

    // Root at (50,50). Hip inherits root position, no local offset.
    expect(hip.worldX).toBeCloseTo(50);
    expect(hip.worldY).toBeCloseTo(50);

    // Torso: hip's 90-deg rotation: a≈0, b=1, c=-1, d≈0
    // worldX = a*100 + b*0 + 50 = 50
    // worldY = c*100 + d*0 + 50 = -100 + 50 = -50
    expect(torso.worldX).toBeCloseTo(50, 5);
    expect(torso.worldY).toBeCloseTo(-50, 5);
  });

  it('children array is maintained', () => {
    const root = new Bone('root');
    const a = new Bone('a', root);
    const b = new Bone('b', root);

    expect(root.children).toHaveLength(2);
    expect(root.children[0]).toBe(a);
    expect(root.children[1]).toBe(b);
    expect(a.parent).toBe(root);
    expect(b.parent).toBe(root);
  });
});
