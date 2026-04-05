import { useState } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { useEditorStore } from '../store/editorStore';
import { useCommandStore } from '../store/commandStore';
import { SkinPanel } from './SkinPanel';

type Tab = 'properties' | 'skins';

/**
 * Right panel showing context-sensitive properties for the selected bone or slot.
 * Also includes a Skins tab.
 */
export function PropertiesPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('properties');

  return (
    <div className="panel properties-panel">
      <div className="tab-bar">
        <button
          className={activeTab === 'properties' ? 'active' : ''}
          onClick={() => setActiveTab('properties')}
        >
          Properties
        </button>
        <button
          className={activeTab === 'skins' ? 'active' : ''}
          onClick={() => setActiveTab('skins')}
        >
          Skins
        </button>
      </div>
      {activeTab === 'properties' ? <PropertiesContent /> : <SkinPanel />}
    </div>
  );
}

function PropertiesContent() {
  const selectedBoneId = useEditorStore((s) => s.selectedBoneId);
  const selectedSlotId = useEditorStore((s) => s.selectedSlotId);

  if (selectedBoneId) {
    return <BoneProperties boneId={selectedBoneId} />;
  }
  if (selectedSlotId) {
    return <SlotProperties slotId={selectedSlotId} />;
  }

  return (
    <div className="empty-message">
      Select a bone or slot to edit its properties.
    </div>
  );
}

function BoneProperties({ boneId }: { boneId: string }) {
  const bone = useDocumentStore((s) => s.bones.find((b) => b.id === boneId));
  const updateBone = useDocumentStore((s) => s.updateBone);
  const execute = useCommandStore((s) => s.execute);

  if (!bone) return null;

  function handleChange(field: string, rawValue: string) {
    if (!bone) return;
    const numericFields = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'length'];

    if (numericFields.includes(field)) {
      const value = parseFloat(rawValue);
      if (isNaN(value)) return;
      const oldValue = bone[field as keyof typeof bone] as number;
      execute({
        description: `Set ${bone.name}.${field} = ${value}`,
        execute() { updateBone(boneId, { [field]: value }); },
        undo() { updateBone(boneId, { [field]: oldValue }); },
      });
    } else {
      const oldValue = bone[field as keyof typeof bone] as string;
      execute({
        description: `Set ${bone.name}.${field} = ${rawValue}`,
        execute() { updateBone(boneId, { [field]: rawValue }); },
        undo() { updateBone(boneId, { [field]: oldValue }); },
      });
    }
  }

  return (
    <div>
      <div className="panel-header">
        <span>Bone: {bone.name}</span>
      </div>
      <div className="property-row">
        <label>Name</label>
        <input
          type="text"
          value={bone.name}
          onChange={(e) => handleChange('name', e.target.value)}
        />
      </div>
      <div className="property-row">
        <label>X</label>
        <input
          type="number"
          value={bone.x}
          step={1}
          onChange={(e) => handleChange('x', e.target.value)}
        />
      </div>
      <div className="property-row">
        <label>Y</label>
        <input
          type="number"
          value={bone.y}
          step={1}
          onChange={(e) => handleChange('y', e.target.value)}
        />
      </div>
      <div className="property-row">
        <label>Rotation</label>
        <input
          type="number"
          value={bone.rotation}
          step={1}
          onChange={(e) => handleChange('rotation', e.target.value)}
        />
      </div>
      <div className="property-row">
        <label>Scale X</label>
        <input
          type="number"
          value={bone.scaleX}
          step={0.1}
          onChange={(e) => handleChange('scaleX', e.target.value)}
        />
      </div>
      <div className="property-row">
        <label>Scale Y</label>
        <input
          type="number"
          value={bone.scaleY}
          step={0.1}
          onChange={(e) => handleChange('scaleY', e.target.value)}
        />
      </div>
      <div className="property-row">
        <label>Length</label>
        <input
          type="number"
          value={bone.length}
          step={1}
          onChange={(e) => handleChange('length', e.target.value)}
        />
      </div>
    </div>
  );
}

function SlotProperties({ slotId }: { slotId: string }) {
  const slot = useDocumentStore((s) => s.slots.find((sl) => sl.id === slotId));
  const bones = useDocumentStore((s) => s.bones);
  const updateSlot = useDocumentStore((s) => s.updateSlot);
  const execute = useCommandStore((s) => s.execute);

  if (!slot) return null;

  function handleChange(field: string, value: string) {
    if (!slot) return;
    const oldValue = slot[field as keyof typeof slot] as string;
    execute({
      description: `Set slot ${slot.name}.${field}`,
      execute() { updateSlot(slotId, { [field]: value }); },
      undo() { updateSlot(slotId, { [field]: oldValue }); },
    });
  }

  function handleColorChange(hexColor: string) {
    if (!slot) return;
    // Convert #rrggbb to rrggbbaa
    const hex = hexColor.replace('#', '') + 'ff';
    const oldColor = slot.color;
    execute({
      description: `Set slot ${slot.name} color`,
      execute() { updateSlot(slotId, { color: hex }); },
      undo() { updateSlot(slotId, { color: oldColor }); },
    });
  }

  // Convert rrggbbaa to #rrggbb for color picker
  const displayColor = '#' + (slot.color || 'ffffff').substring(0, 6);

  return (
    <div>
      <div className="panel-header">
        <span>Slot: {slot.name}</span>
      </div>
      <div className="property-row">
        <label>Name</label>
        <input
          type="text"
          value={slot.name}
          onChange={(e) => handleChange('name', e.target.value)}
        />
      </div>
      <div className="property-row">
        <label>Bone</label>
        <select
          value={slot.boneId}
          onChange={(e) => handleChange('boneId', e.target.value)}
        >
          {bones.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div className="property-row">
        <label>Attachment</label>
        <input
          type="text"
          value={slot.attachmentName ?? ''}
          onChange={(e) => handleChange('attachmentName', e.target.value || '')}
          placeholder="(none)"
        />
      </div>
      <div className="property-row">
        <label>Color</label>
        <input
          type="color"
          value={displayColor}
          onChange={(e) => handleColorChange(e.target.value)}
        />
      </div>
    </div>
  );
}
