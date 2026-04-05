# Getting Started

This guide walks you through installing IceBones, creating your first skeleton in the editor, and rendering it in a PixiJS game.

## Prerequisites

- **Node.js 20+** (LTS recommended)
- A modern browser (Chrome, Firefox, Edge, or Safari)

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-org/icebones.git
cd icebones
npm install
```

## Running the Editor

```bash
cd packages/editor
npm run dev
```

Vite will print a local URL (typically `http://localhost:5173`). Open it in your browser.

## Creating Your First Skeleton

### 1. Open the editor

After running `npm run dev`, open the URL in your browser. You will see a dark canvas in the center with a toolbar at the top, a hierarchy panel on the left, a properties panel on the right, and a timeline at the bottom.

### 2. Select the Bone tool

Click the **Bone** button in the toolbar (or look for the `+` icon labeled "Bone"). This activates bone-creation mode.

### 3. Create the root bone

Click anywhere on the canvas. A bone named `root` appears at that position, and it is automatically selected.

### 4. Create child bones

With the root bone selected, click elsewhere on the canvas to create a child bone. The new bone becomes a child of whatever bone is currently selected. Repeat to build out your hierarchy -- for example, create a spine, then shoulders, then arms.

### 5. Switch to the Select tool

Click **Select** in the toolbar. Now click on any bone diamond in the viewport to select it. The hierarchy panel on the left highlights the selected bone.

### 6. Edit properties

With a bone selected, the right panel shows its properties:

| Property | Description |
|---|---|
| Name | Display name used in JSON export and timeline labels |
| X, Y | Local position relative to the parent bone |
| Rotation | Local rotation in degrees |
| Scale X, Scale Y | Local scale factors |
| Length | Visual length of the bone (cosmetic) |

Adjust values by typing in the input fields. All changes are undoable with Ctrl+Z.

### 7. Create an animation

In the timeline panel at the bottom, click **+ Anim**. Enter a name (e.g., `idle`) and a duration in seconds (e.g., `1`). The new animation appears in the dropdown and is selected automatically.

### 8. Add keyframes

1. Select a bone in the viewport or hierarchy panel.
2. Use the timeline scrubber or type a time to position the playback head.
3. Click **+ Key** in the timeline panel. This records the bone's current rotation, translation, and scale at that time.
4. Change the bone's properties in the right panel (e.g., rotate it 30 degrees).
5. Move the scrubber to a later time and click **+ Key** again.

### 9. Press Play to preview

Click the **Play** button in the toolbar or the play icon in the timeline controls. The editor will loop the animation, interpolating between your keyframes.

### 10. Export as JSON

Click **Export** in the toolbar. The browser downloads a `.json` file containing your skeleton, slots, skins, and animations in Spine-compatible format.

## Opening an Exported File in a Game

Here is a minimal PixiJS 8 example that loads an IceBones JSON file and plays an animation:

```typescript
import { Application } from 'pixi.js';
import { SkeletonJson } from '@icebones/core';
import { SkeletonRenderer } from '@icebones/pixi';

async function main() {
  // Initialize PixiJS
  const app = new Application();
  await app.init({ background: 0x1a1a2e, width: 800, height: 600 });
  document.body.appendChild(app.canvas as HTMLCanvasElement);

  // Load your exported JSON (fetch, import, or inline)
  const response = await fetch('skeleton.json');
  const jsonData = await response.json();

  // Parse skeleton data
  const parser = new SkeletonJson();
  const skeletonData = parser.readSkeletonData(jsonData);

  // Create the renderer (it extends PixiJS Container)
  const renderer = new SkeletonRenderer(skeletonData);
  renderer.position.set(400, 500); // center on screen
  renderer.scale.set(1, -1);      // flip Y if your skeleton uses Y-up

  // Play an animation
  renderer.animationState.setAnimation(0, 'idle', true);

  // Add to stage
  app.stage.addChild(renderer);
}

main();
```

Install the runtime packages:

```bash
npm install @icebones/core @icebones/pixi pixi.js
```

See the [Runtime Guide](runtime-guide.md) for the full API reference.
