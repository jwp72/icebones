# Editor Guide

Complete reference for the IceBones skeleton editor.

## Editor Layout

The editor uses a CSS Grid layout with five areas:

```
+----------------------------------------------+
|                   Toolbar                    |
+----------+--------------------+--------------+
|          |                    |              |
| Hierarchy|     Viewport       |  Properties  |
|  Panel   |     (Canvas)       |    Panel     |
|          |                    |              |
+----------+--------------------+--------------+
|                 Timeline Panel               |
+----------------------------------------------+
```

- **Toolbar** (top) -- tools, file operations, undo/redo, playback controls
- **Hierarchy Panel** (left) -- bone/slot tree view
- **Viewport** (center) -- PixiJS canvas for visual editing
- **Properties Panel** (right) -- editable properties for the selected bone or slot, plus a Skins tab
- **Timeline Panel** (bottom) -- animation timeline with keyframes and scrubber

---

## Toolbar

The toolbar is divided into four groups:

### Tools

| Button | Description |
|---|---|
| **Select** | Click bones in the viewport to select them. The selected bone is highlighted with a yellow diamond and white outline. |
| **Bone** | Click on the canvas to create a new bone. The new bone becomes a child of whichever bone is currently selected. If nothing is selected, a root bone is created. |
| **Pan** | Click and drag to pan the viewport. This is equivalent to holding Spacebar or using the middle mouse button. |

### File Operations

| Button | Description |
|---|---|
| **New** | Resets the document to an empty state. Prompts for confirmation to prevent accidental data loss. |
| **Import** | Opens a file picker to load a `.json` skeleton file. The imported data replaces the current document. |
| **Export** | Downloads the current document as a Spine-compatible `.json` file. |

### Edit Operations

| Button | Shortcut | Description |
|---|---|---|
| **Undo** | Ctrl+Z | Reverts the most recent command (bone creation, property change, etc.). |
| **Redo** | Ctrl+Y | Re-applies the most recently undone command. |

### Playback

| Button | Description |
|---|---|
| **Play / Pause** | Toggles animation playback for the currently selected animation. While playing, the timeline scrubber advances and bone transforms are interpolated in real time. |

---

## Viewport

The viewport is a PixiJS canvas that displays the skeleton in real time.

### Bone Visualization

- Bones are drawn as **green diamonds** connected by green lines.
- The **selected bone** is drawn as a larger yellow diamond with a white outline.
- Lines connect each bone to its parent.

### Navigation

| Action | Input |
|---|---|
| Pan | Middle mouse button drag, or Spacebar + left mouse drag, or select the Pan tool |
| Zoom | Mouse scroll wheel (zooms toward cursor position) |
| Zoom range | 10% to 1000% |

The current zoom percentage is displayed in the bottom-left corner of the viewport.

### Interaction

- In **Select** mode, click near a bone diamond to select it (15 px hit threshold, scaled by zoom).
- In **Bone** mode, click to create a new bone at the clicked world position. The bone's local coordinates are computed relative to the currently selected parent bone, accounting for parent rotation and scale.

### Grid

The viewport draws a background grid with:
- Small grid lines every 50 world units
- Major grid lines every 200 world units
- Origin crosshair at (0, 0)

---

## Hierarchy Panel

The left panel displays the skeleton as a tree.

### Tree Structure

- **Bone nodes** are shown with a diamond icon and the bone name.
- **Slot nodes** are shown beneath their parent bone with a square icon and the slot name.
- Child bones are indented under their parent.
- Click a bone to select it. Click a slot to select it.

### Adding Bones

Click the **+** button in the panel header to add a root bone. If no bones exist yet, the first bone is named `root`.

### Right-Click Context Menu

Right-click any bone in the hierarchy to open a context menu with these actions:

| Action | Description |
|---|---|
| **Add Child Bone** | Creates a new bone as a child of the right-clicked bone. |
| **Add Slot** | Creates a new slot attached to the right-clicked bone. |
| **Rename** | Opens a prompt to rename the bone. |
| **Delete** | Removes the bone and all its descendants. Associated slots are also removed. |

All context menu actions support undo/redo.

---

## Properties Panel

The right panel has two tabs: **Properties** and **Skins**.

### Properties Tab

Shows editable fields for the currently selected bone or slot. If nothing is selected, a placeholder message is shown.

#### Bone Properties

| Field | Type | Description |
|---|---|---|
| Name | text | Bone name (used in JSON export and timeline labels) |
| X | number | Local X position relative to parent |
| Y | number | Local Y position relative to parent |
| Rotation | number | Local rotation in degrees |
| Scale X | number | Local horizontal scale (default 1) |
| Scale Y | number | Local vertical scale (default 1) |
| Length | number | Visual bone length (cosmetic, exported to JSON) |

#### Slot Properties

| Field | Type | Description |
|---|---|---|
| Name | text | Slot name |
| Bone | dropdown | The bone this slot is attached to |
| Attachment | text | Default attachment name for the setup pose |
| Color | color picker | Slot tint color (stored as `rrggbbaa` hex) |

All property edits are recorded as undoable commands.

### Skins Tab

The Skins tab manages named skins. Each skin is a mapping of slot/attachment pairs.

- Click **+** to create a new skin.
- Click a skin name to select it.
- Click the **x** button to remove a skin.
- When a skin is selected, an attachment editor appears below the skin list showing one row per slot. Type an attachment name in the text field to map that attachment to the slot within the selected skin.

---

## Timeline Panel

The bottom panel is the animation timeline.

### Animation Selection

The dropdown at the top-left lists all animations in the document. Select an animation to view and edit its timelines.

### Controls

| Control | Description |
|---|---|
| **+ Anim** | Creates a new animation. Prompts for a name and duration. |
| **+ Key** | Adds keyframes for the selected bone at the current playback time. Records rotation, translation, and scale simultaneously. |
| **Play/Pause** | Toggles real-time playback of the selected animation (loops). |
| **Rewind** | Resets playback time to 0. |
| **Time display** | Shows the current time and total duration (e.g., `0.35s / 1.00s`). |

### Timeline Rows

Each timeline row represents one property channel (e.g., `bone_1 / rotate`). The row label is on the left; the track area on the right contains:

- **Keyframe diamonds** -- click to jump to that keyframe's time.
- **Scrubber line** -- a vertical line showing the current playback position.

### Adding Keyframes

1. Select a bone in the viewport or hierarchy.
2. Position the scrubber by clicking on the ruler or a track.
3. Click **+ Key**. Three keyframes are added: rotate, translate, and scale.

### Deleting Keyframes

Right-click a keyframe diamond and confirm the deletion prompt.

### Ruler

The ruler at the top of the timeline area shows time markers at every 0.1 seconds, with labels at whole seconds.

### Scrubbing

Click anywhere on the ruler or a track row to jump the playback head to that time. If the animation is paused, the skeleton updates immediately to show the interpolated pose.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Spacebar (hold) | Temporarily activate Pan mode |

---

## File Operations

### New Project

Toolbar > **New**. Resets all bones, slots, skins, and animations. Prompts for confirmation.

### Import JSON

Toolbar > **Import**. Opens a file picker for `.json` files. The imported data replaces the current document entirely. The importer reads the Spine-compatible format, including IceBones extensions.

### Export JSON

Toolbar > **Export**. Downloads the current document as a `.json` file. The exported format is a Spine 4.2 superset -- see the [JSON Format](json-format.md) reference for details.
