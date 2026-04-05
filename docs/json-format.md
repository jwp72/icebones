# JSON Format Reference

IceBones uses a Spine 4.2-superset JSON format. Files exported by IceBones can be loaded by standard Spine runtimes -- the IceBones-specific extensions are simply ignored by parsers that do not recognize them.

## Complete Structure

```jsonc
{
  "skeleton": { ... },
  "bones": [ ... ],
  "slots": [ ... ],
  "skins": [ ... ],
  "animations": { ... }
}
```

---

## `skeleton` Section

Top-level metadata about the skeleton.

```json
{
  "skeleton": {
    "icebones": "1.0.0",
    "width": 256,
    "height": 384
  }
}
```

| Field | Type | Description |
|---|---|---|
| `icebones` | string | IceBones version that exported this file. (Extension -- ignored by Spine runtimes.) |
| `width` | number | Reference width of the skeleton in pixels. |
| `height` | number | Reference height of the skeleton in pixels. |

---

## `bones` Array

An ordered list of bone definitions. **Parents always appear before their children** in the array.

```json
{
  "bones": [
    { "name": "root" },
    { "name": "spine", "parent": "root", "x": 0, "y": 50, "length": 40 },
    { "name": "head", "parent": "spine", "x": 0, "y": 30, "rotation": 10, "length": 20 }
  ]
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | string | (required) | Unique bone name. |
| `parent` | string | (none) | Name of the parent bone. Omitted for the root bone. |
| `x` | number | `0` | Local X offset from parent. |
| `y` | number | `0` | Local Y offset from parent. |
| `rotation` | number | `0` | Local rotation in degrees. |
| `scaleX` | number | `1` | Local horizontal scale. |
| `scaleY` | number | `1` | Local vertical scale. |
| `length` | number | `0` | Visual bone length (used for editor display and hit testing). |

Fields at their default value are omitted from the export to keep files compact.

---

## `slots` Array

An ordered list of slot definitions. The array order determines draw order (first slot is drawn first / behind later slots).

```json
{
  "slots": [
    { "name": "torso", "bone": "spine", "attachment": "torso-sprite" },
    { "name": "head", "bone": "head", "attachment": "head-sprite", "color": "ff8800ff" }
  ]
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | string | (required) | Unique slot name. |
| `bone` | string | (required) | Name of the bone this slot is attached to. |
| `attachment` | string | `null` | Default attachment name for the setup pose. |
| `color` | string | `"ffffffff"` | Slot tint color as 8-character hex (`RRGGBBAA`). Omitted when white/fully opaque. |

---

## `skins` Array

Each skin is a named set of attachment definitions. A skin maps `(slotName, attachmentName)` to an attachment object.

```json
{
  "skins": [
    {
      "name": "default",
      "attachments": {
        "torso": {
          "torso-sprite": {
            "x": 0,
            "y": 5,
            "width": 64,
            "height": 80
          }
        },
        "head": {
          "head-sprite": {
            "x": 0,
            "y": 0,
            "width": 48,
            "height": 48,
            "name": "head-region"
          }
        }
      }
    }
  ]
}
```

### Skin Object

| Field | Type | Description |
|---|---|---|
| `name` | string | Skin name. |
| `attachments` | object | Nested map: `slotName` -> `attachmentName` -> attachment definition. |

### Attachment Definition (Region)

| Field | Type | Default | Description |
|---|---|---|---|
| `type` | string | `"region"` | Attachment type. `"region"` is the default and can be omitted. |
| `name` | string | (same as key) | Region/texture name if different from the attachment name. Used to look up the texture. |
| `x` | number | `0` | Local X offset from the bone. |
| `y` | number | `0` | Local Y offset from the bone. |
| `rotation` | number | `0` | Local rotation in degrees. |
| `scaleX` | number | `1` | Local horizontal scale. |
| `scaleY` | number | `1` | Local vertical scale. |
| `width` | number | `0` | Region width in pixels. |
| `height` | number | `0` | Region height in pixels. |

---

## `animations` Object

A map of animation name to animation definition. Each animation contains optional `bones` and `slots` sections with per-target timelines.

```json
{
  "animations": {
    "idle": {
      "bones": {
        "spine": {
          "rotate": [
            { "time": 0, "angle": 0 },
            { "time": 0.5, "angle": 5 },
            { "time": 1.0, "angle": 0 }
          ],
          "translate": [
            { "time": 0, "x": 0, "y": 0 },
            { "time": 0.5, "x": 0, "y": 3 },
            { "time": 1.0, "x": 0, "y": 0 }
          ],
          "scale": [
            { "time": 0, "x": 1, "y": 1 }
          ]
        }
      },
      "slots": {
        "torso": {
          "color": [
            { "time": 0, "color": "ffffffff" },
            { "time": 0.5, "color": "ff8888ff" }
          ],
          "attachment": [
            { "time": 0, "name": "torso-sprite" },
            { "time": 0.5, "name": "torso-sprite-alt" }
          ]
        }
      }
    }
  }
}
```

### Bone Timelines

Located under `animations.<name>.bones.<boneName>`.

#### `rotate`

| Field | Type | Description |
|---|---|---|
| `time` | number | Time in seconds. |
| `angle` | number | Rotation in degrees (default 0). |

#### `translate`

| Field | Type | Description |
|---|---|---|
| `time` | number | Time in seconds. |
| `x` | number | X offset (default 0). |
| `y` | number | Y offset (default 0). |

#### `scale`

| Field | Type | Description |
|---|---|---|
| `time` | number | Time in seconds. |
| `x` | number | Scale X (default 1). |
| `y` | number | Scale Y (default 1). |

### Slot Timelines

Located under `animations.<name>.slots.<slotName>`.

#### `color`

| Field | Type | Description |
|---|---|---|
| `time` | number | Time in seconds. |
| `color` | string | 8-character hex color (`RRGGBBAA`, default `"ffffffff"`). |

#### `attachment`

| Field | Type | Description |
|---|---|---|
| `time` | number | Time in seconds. |
| `name` | string or null | Attachment name to switch to, or `null` to hide the slot. |

### Interpolation

All numeric values (angles, positions, scales, colors) use **linear interpolation** between keyframes. The runtime performs binary search to find the surrounding keyframes and computes a normalized `t` factor.

### Animation Duration

The animation duration is the maximum `time` value across all its keyframes. There is no explicit `duration` field in the JSON -- the runtime computes it during parsing.

---

## IceBones Extensions

IceBones may include additional top-level fields in exported JSON that are not part of the Spine specification. These are safely ignored by Spine runtimes.

| Field | Type | Description |
|---|---|---|
| `skeleton.icebones` | string | IceBones version string. |
| `tintZones` | object | (Reserved) Named color-tint zone definitions for team colors. |
| `statTags` | object | (Reserved) Metadata tags for gameplay integration. |
| `previewConfig` | object | (Reserved) Editor-specific preview settings. |

---

## Compatibility Notes

- **Loading in Spine runtimes**: Files exported by IceBones follow the Spine 4.2 JSON structure. Standard Spine runtimes will parse the `skeleton`, `bones`, `slots`, `skins`, and `animations` sections normally and ignore unrecognized fields.
- **Loading Spine files in IceBones**: The `SkeletonJson` parser accepts standard Spine 4.2 JSON files. Features not yet supported by IceBones (mesh attachments, IK constraints, blend modes, etc.) are gracefully skipped -- unrecognized attachment types produce a base `Attachment` instance.
- **Character encoding**: JSON files should be UTF-8 encoded.
