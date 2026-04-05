/**
 * IceBones Runtime Demo
 *
 * A standalone smoke test that proves the complete pipeline works in a browser:
 *   JSON skeleton -> SkeletonJson parser -> Skeleton -> AnimationState -> SkeletonRenderer -> PixiJS canvas
 *
 * Uses a hardcoded 3-bone, 2-slot skeleton with an idle breathing animation.
 * No images are loaded — the renderer runs in debug mode to show bones and attachment bounds.
 */

import { Application } from 'pixi.js';
import { SkeletonJson } from '@icebones/core';
import { SkeletonRenderer } from '@icebones/pixi';

// ─── Hardcoded skeleton JSON (matches editor export format) ──────────────────

const DEMO_SKELETON_JSON = {
  skeleton: { icebones: '1.0.0', width: 256, height: 384 },
  bones: [
    { name: 'root' },
    { name: 'hip', parent: 'root', x: 0, y: -50 },
    { name: 'torso', parent: 'hip', x: 0, y: -80 },
    { name: 'head', parent: 'torso', x: 0, y: -60 },
  ],
  slots: [
    { name: 'body-slot', bone: 'hip', attachment: 'body' },
    { name: 'head-slot', bone: 'head', attachment: 'head' },
  ],
  skins: [
    {
      name: 'default',
      attachments: {
        'body-slot': {
          body: { type: 'region', x: 0, y: -40, width: 60, height: 100 },
        },
        'head-slot': {
          head: { type: 'region', x: 0, y: 0, width: 40, height: 40 },
        },
      },
    },
  ],
  animations: {
    idle: {
      bones: {
        hip: {
          translate: [
            { time: 0, x: 0, y: -50 },
            { time: 1, x: 0, y: -45 },
            { time: 2, x: 0, y: -50 },
          ],
        },
        torso: {
          rotate: [
            { time: 0, angle: 0 },
            { time: 1, angle: 2 },
            { time: 2, angle: 0 },
          ],
        },
        head: {
          rotate: [
            { time: 0, angle: 0 },
            { time: 0.8, angle: -3 },
            { time: 1.6, angle: 3 },
            { time: 2, angle: 0 },
          ],
        },
      },
      slots: {
        'body-slot': {
          color: [
            { time: 0, color: '88bbffff' },
            { time: 1, color: 'aaddffff' },
            { time: 2, color: '88bbffff' },
          ],
        },
      },
    },
  },
};

// ─── Initialize PixiJS and IceBones ──────────────────────────────────────────

async function main() {
  const container = document.getElementById('demo-canvas');
  if (!container) throw new Error('Demo canvas container not found');

  // Create PixiJS application
  const app = new Application();
  await app.init({
    background: 0x0a0a1e,
    resizeTo: container,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });
  container.appendChild(app.canvas as HTMLCanvasElement);

  // Parse skeleton JSON
  const parser = new SkeletonJson();
  const skeletonData = parser.readSkeletonData(DEMO_SKELETON_JSON);

  // Create the PixiJS renderer (extends Container)
  const renderer = new SkeletonRenderer(skeletonData);
  renderer.debug = true; // Show bone lines and attachment bounds

  // Set skin
  const defaultSkin = skeletonData.findSkin('default');
  if (defaultSkin) {
    renderer.skeleton.setSkin(defaultSkin);
  }

  // Start idle animation (looping)
  renderer.animationState.setAnimation(0, 'idle', true);

  // Position the skeleton in the center of the canvas
  renderer.position.set(app.screen.width / 2, app.screen.height * 0.75);

  // Add to stage
  app.stage.addChild(renderer);

  // Log success
  console.log('[IceBones Demo] Skeleton loaded and animating.');
  console.log(`  Bones: ${skeletonData.bones.length}`);
  console.log(`  Slots: ${skeletonData.slots.length}`);
  console.log(`  Skins: ${skeletonData.skins.length}`);
  console.log(`  Animations: ${skeletonData.animations.length}`);

  // Handle window resize
  window.addEventListener('resize', () => {
    renderer.position.set(app.screen.width / 2, app.screen.height * 0.75);
  });
}

main().catch(console.error);
