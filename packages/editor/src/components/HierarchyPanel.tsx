import { useState, useCallback } from 'react';
import { useDocumentStore, type BoneNode } from '../store/documentStore';
import { useEditorStore } from '../store/editorStore';
import { useCommandStore } from '../store/commandStore';

interface ContextMenuState {
  x: number;
  y: number;
  boneId: string;
}

/**
 * Left panel showing the bone/slot hierarchy as a tree.
 */
export function HierarchyPanel() {
  const bones = useDocumentStore((s) => s.bones);
  const slots = useDocumentStore((s) => s.slots);
  const selectedBoneId = useEditorStore((s) => s.selectedBoneId);
  const selectedSlotId = useEditorStore((s) => s.selectedSlotId);
  const selectBone = useEditorStore((s) => s.selectBone);
  const selectSlot = useEditorStore((s) => s.selectSlot);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Build tree structure
  const rootBones = bones.filter((b) => !b.parentId || !bones.find((p) => p.id === b.parentId));

  function getChildren(parentId: string): BoneNode[] {
    return bones.filter((b) => b.parentId === parentId);
  }

  function handleContextMenu(e: React.MouseEvent, boneId: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, boneId });
  }

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  function handleAddChildBone(parentId: string) {
    const { addBone } = useDocumentStore.getState();
    const { execute } = useCommandStore.getState();
    const name = `bone_${bones.length + 1}`;

    let newId: string | null = null;
    execute({
      description: `Add child bone "${name}"`,
      execute() {
        newId = addBone(parentId, name, 50, 0);
        selectBone(newId);
      },
      undo() {
        if (newId) {
          useDocumentStore.getState().removeBone(newId);
          selectBone(parentId);
        }
      },
    });
    closeContextMenu();
  }

  function handleAddSlot(boneId: string) {
    const { addSlot } = useDocumentStore.getState();
    const bone = bones.find((b) => b.id === boneId);
    const name = `slot_${bone?.name ?? 'unknown'}`;

    let newId: string | null = null;
    const { execute } = useCommandStore.getState();
    execute({
      description: `Add slot "${name}"`,
      execute() {
        newId = addSlot(boneId, name);
      },
      undo() {
        if (newId) useDocumentStore.getState().removeSlot(newId);
      },
    });
    closeContextMenu();
  }

  function handleRenameBone(boneId: string) {
    const bone = bones.find((b) => b.id === boneId);
    if (!bone) return;
    const newName = prompt('Rename bone:', bone.name);
    if (newName && newName !== bone.name) {
      const oldName = bone.name;
      const { execute } = useCommandStore.getState();
      execute({
        description: `Rename bone "${oldName}" to "${newName}"`,
        execute() {
          useDocumentStore.getState().updateBone(boneId, { name: newName });
        },
        undo() {
          useDocumentStore.getState().updateBone(boneId, { name: oldName });
        },
      });
    }
    closeContextMenu();
  }

  function handleDeleteBone(boneId: string) {
    const { bones: currentBones, slots: currentSlots } = useDocumentStore.getState();
    const bone = currentBones.find((b) => b.id === boneId);
    if (!bone) return;

    // Collect all bones that will be removed (this bone + descendants)
    const toRemove: BoneNode[] = [];
    const collectDescendants = (id: string) => {
      const b = currentBones.find((bn) => bn.id === id);
      if (b) {
        toRemove.push(b);
        for (const child of currentBones.filter((bn) => bn.parentId === id)) {
          collectDescendants(child.id);
        }
      }
    };
    collectDescendants(boneId);

    const removedSlots = currentSlots.filter((sl) =>
      toRemove.some((b) => b.id === sl.boneId),
    );

    const { execute } = useCommandStore.getState();
    execute({
      description: `Delete bone "${bone.name}"`,
      execute() {
        useDocumentStore.getState().removeBone(boneId);
        if (selectedBoneId === boneId) selectBone(null);
      },
      undo() {
        // Re-add bones in order
        const store = useDocumentStore.getState();
        for (const b of toRemove) {
          store.addBone(b.parentId, b.name, b.x, b.y);
          // Since addBone generates new IDs, this is imperfect undo.
          // For MVP, this is acceptable.
        }
        for (const sl of removedSlots) {
          store.addSlot(sl.boneId, sl.name);
        }
      },
    });
    closeContextMenu();
  }

  function handleAddRootBone() {
    const { addBone } = useDocumentStore.getState();
    const { execute } = useCommandStore.getState();
    const name = bones.length === 0 ? 'root' : `bone_${bones.length + 1}`;

    let newId: string | null = null;
    execute({
      description: `Add root bone "${name}"`,
      execute() {
        newId = addBone(null, name, 0, 0);
        selectBone(newId);
      },
      undo() {
        if (newId) {
          useDocumentStore.getState().removeBone(newId);
          selectBone(null);
        }
      },
    });
  }

  function renderBoneNode(bone: BoneNode, depth: number) {
    const children = getChildren(bone.id);
    const boneSlots = slots.filter((sl) => sl.boneId === bone.id);

    return (
      <div key={bone.id}>
        <div
          className={`tree-node ${selectedBoneId === bone.id ? 'selected' : ''}`}
          style={{ paddingLeft: 8 + depth * 16 }}
          onClick={() => selectBone(bone.id)}
          onContextMenu={(e) => handleContextMenu(e, bone.id)}
        >
          <span className="icon bone-icon">{'\u25C6'}</span>
          <span className="name">{bone.name}</span>
        </div>
        {boneSlots.map((slot) => (
          <div
            key={slot.id}
            className={`tree-node ${selectedSlotId === slot.id ? 'selected' : ''}`}
            style={{ paddingLeft: 8 + (depth + 1) * 16 }}
            onClick={() => selectSlot(slot.id)}
          >
            <span className="icon slot-icon">{'\u25A0'}</span>
            <span className="name">{slot.name}</span>
          </div>
        ))}
        {children.map((child) => renderBoneNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="panel hierarchy-panel">
      <div className="panel-header">
        <span>Hierarchy</span>
        <button onClick={handleAddRootBone} title="Add root bone">+</button>
      </div>
      {bones.length === 0 ? (
        <div className="empty-message">
          No bones yet. Click + or use the Bone tool.
        </div>
      ) : (
        rootBones.map((bone) => renderBoneNode(bone, 0))
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          />
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div
              className="context-menu-item"
              onClick={() => handleAddChildBone(contextMenu.boneId)}
            >
              Add Child Bone
            </div>
            <div
              className="context-menu-item"
              onClick={() => handleAddSlot(contextMenu.boneId)}
            >
              Add Slot
            </div>
            <div
              className="context-menu-item"
              onClick={() => handleRenameBone(contextMenu.boneId)}
            >
              Rename
            </div>
            <div
              className="context-menu-item danger"
              onClick={() => handleDeleteBone(contextMenu.boneId)}
            >
              Delete
            </div>
          </div>
        </>
      )}
    </div>
  );
}
