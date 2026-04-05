import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkeletonData, SkeletonJson } from '@icebones/core';

// PixiJS requires a WebGL/Canvas context that is not available in Vitest.
// We mock pixi.js to test the SkeletonRenderer structurally.
vi.mock('pixi.js', () => {
  class MockContainer {
    children: unknown[] = [];
    onRender: (() => void) | undefined;
    addChild(child: unknown): unknown {
      this.children.push(child);
      return child;
    }
    removeChild(child: unknown): void {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
    }
    getChildIndex(child: unknown): number {
      return this.children.indexOf(child);
    }
    setChildIndex(child: unknown, index: number): void {
      const idx = this.children.indexOf(child);
      if (idx >= 0) {
        this.children.splice(idx, 1);
        this.children.splice(index, 0, child);
      }
    }
    destroy(): void {
      this.children.length = 0;
    }
  }

  class MockSprite {
    texture: unknown = null;
    visible = true;
    tint = 0xffffff;
    alpha = 1;
    rotation = 0;
    position = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };
    scale = { x: 1, y: 1, set(x: number, y: number) { this.x = x; this.y = y; } };
    anchor = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };
  }

  class MockTexture {}

  class MockGraphics {
    clear(): this { return this; }
    circle(): this { return this; }
    fill(): this { return this; }
    moveTo(): this { return this; }
    lineTo(): this { return this; }
    stroke(): this { return this; }
    closePath(): this { return this; }
  }

  const sharedTicker = {
    add: vi.fn(),
    remove: vi.fn(),
    deltaMS: 16.67,
  };

  class MockTicker {
    static shared = sharedTicker;
    deltaMS = 16.67;
  }

  return {
    Container: MockContainer,
    Sprite: MockSprite,
    Texture: MockTexture,
    Graphics: MockGraphics,
    Ticker: MockTicker,
  };
});

// Import after mocking.
import { SkeletonRenderer } from '../SkeletonRenderer.js';

/**
 * Helper to create a minimal SkeletonData for testing.
 */
function createTestSkeletonData(): SkeletonData {
  const json = {
    skeleton: { width: 100, height: 200 },
    bones: [{ name: 'root' }, { name: 'hip', parent: 'root', y: 50 }],
    slots: [
      { name: 'body', bone: 'hip', attachment: 'body-region' },
      { name: 'head', bone: 'hip', attachment: 'head-region' },
    ],
    skins: [
      {
        name: 'default',
        attachments: {
          body: {
            'body-region': { type: 'region', width: 40, height: 60 },
          },
          head: {
            'head-region': { type: 'region', width: 30, height: 30 },
          },
        },
      },
    ],
    animations: {
      idle: {
        bones: {
          hip: {
            translate: [
              { time: 0, x: 0, y: 0 },
              { time: 1, x: 0, y: 10 },
            ],
          },
        },
      },
    },
  };
  return new SkeletonJson().readSkeletonData(json);
}

describe('SkeletonRenderer', () => {
  let data: SkeletonData;

  beforeEach(() => {
    data = createTestSkeletonData();
  });

  it('should be instantiable with SkeletonData', () => {
    const renderer = new SkeletonRenderer(data);
    expect(renderer).toBeInstanceOf(SkeletonRenderer);
  });

  it('should expose skeleton and animationState properties', () => {
    const renderer = new SkeletonRenderer(data);
    expect(renderer.skeleton).toBeDefined();
    expect(renderer.skeleton.bones).toHaveLength(2);
    expect(renderer.skeleton.slots).toHaveLength(2);
    expect(renderer.animationState).toBeDefined();
  });

  it('should have a setRegionTextures method', () => {
    const renderer = new SkeletonRenderer(data);
    expect(typeof renderer.setRegionTextures).toBe('function');
  });

  it('should accept a Record for setRegionTextures', () => {
    const renderer = new SkeletonRenderer(data);
    // Should not throw.
    renderer.setRegionTextures({});
  });

  it('should accept a Map for setRegionTextures', () => {
    const renderer = new SkeletonRenderer(data);
    renderer.setRegionTextures(new Map());
  });

  it('should have an update method', () => {
    const renderer = new SkeletonRenderer(data);
    expect(typeof renderer.update).toBe('function');
  });

  it('should have autoUpdate defaulting to true', () => {
    const renderer = new SkeletonRenderer(data);
    expect(renderer.autoUpdate).toBe(true);
  });

  it('should have debug defaulting to false', () => {
    const renderer = new SkeletonRenderer(data);
    expect(renderer.debug).toBe(false);
  });

  it('should run update without errors when no skin is set', () => {
    const renderer = new SkeletonRenderer(data);
    // No skin set, so no attachments — should still work fine.
    expect(() => renderer.update(1 / 60)).not.toThrow();
  });

  it('should run update without errors when a skin with attachments is set', () => {
    const renderer = new SkeletonRenderer(data);
    const skin = data.findSkin('default');
    expect(skin).not.toBeNull();
    renderer.skeleton.setSkin(skin!);
    renderer.animationState.setAnimation(0, 'idle', true);
    // Multiple updates should be fine.
    expect(() => {
      renderer.update(1 / 60);
      renderer.update(1 / 60);
      renderer.update(1 / 60);
    }).not.toThrow();
  });

  it('should create sprites for slots with region attachments after update', () => {
    const renderer = new SkeletonRenderer(data);
    const skin = data.findSkin('default');
    renderer.skeleton.setSkin(skin!);
    renderer.update(1 / 60);
    // Two slots with region attachments → should have children (sprites).
    // children may also include debug graphics if debug=true, but debug is false.
    expect(renderer.children.length).toBe(2);
  });

  it('should run debug drawing without errors', () => {
    const renderer = new SkeletonRenderer(data);
    const skin = data.findSkin('default');
    renderer.skeleton.setSkin(skin!);
    renderer.debug = true;
    expect(() => renderer.update(1 / 60)).not.toThrow();
  });

  it('should destroy without errors', () => {
    const renderer = new SkeletonRenderer(data);
    const skin = data.findSkin('default');
    renderer.skeleton.setSkin(skin!);
    renderer.update(1 / 60);
    expect(() => renderer.destroy()).not.toThrow();
  });
});
