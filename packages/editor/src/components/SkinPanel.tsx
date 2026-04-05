import { useDocumentStore } from '../store/documentStore';
import { useEditorStore } from '../store/editorStore';

/**
 * Panel for managing skins. Shown as a tab in the properties panel area.
 */
export function SkinPanel() {
  const skins = useDocumentStore((s) => s.skins);
  const addSkin = useDocumentStore((s) => s.addSkin);
  const removeSkin = useDocumentStore((s) => s.removeSkin);
  const selectedSkinId = useEditorStore((s) => s.selectedSkinId);
  const selectSkin = useEditorStore((s) => s.selectSkin);
  const slots = useDocumentStore((s) => s.slots);

  function handleAddSkin() {
    const name = prompt('Skin name:', `skin_${skins.length + 1}`);
    if (name) {
      const id = addSkin(name);
      selectSkin(id);
    }
  }

  function handleRemoveSkin(id: string) {
    removeSkin(id);
    if (selectedSkinId === id) selectSkin(null);
  }

  const selectedSkin = skins.find((s) => s.id === selectedSkinId);

  return (
    <div>
      <div className="panel-header">
        <span>Skins</span>
        <button onClick={handleAddSkin} title="Add skin">+</button>
      </div>

      {skins.length === 0 ? (
        <div className="empty-message">No skins yet. Click + to add one.</div>
      ) : (
        skins.map((skin) => (
          <div
            key={skin.id}
            className={`skin-list-item ${selectedSkinId === skin.id ? 'selected' : ''}`}
            onClick={() => selectSkin(skin.id)}
          >
            <span style={{ flex: 1 }}>{skin.name}</span>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--danger)',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '0 4px',
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveSkin(skin.id);
              }}
              title="Remove skin"
            >
              {'\u00D7'}
            </button>
          </div>
        ))
      )}

      {selectedSkin && (
        <div>
          <div className="panel-header" style={{ marginTop: 8 }}>
            <span>Attachments: {selectedSkin.name}</span>
          </div>
          {slots.length === 0 ? (
            <div className="empty-message">No slots to map attachments to.</div>
          ) : (
            slots.map((slot) => {
              // Collect all attachments for this slot (keys are "slotId:attName")
              const slotAtts: Array<[string, import('../store/documentStore').SkinAttachment]> = [];
              for (const [key, att] of selectedSkin.attachments) {
                const sepIdx = key.indexOf(':');
                const keySlotId = sepIdx >= 0 ? key.substring(0, sepIdx) : key;
                if (keySlotId === slot.id) slotAtts.push([key, att]);
              }
              const firstAtt = slotAtts.length > 0 ? slotAtts[0][1] : null;
              return (
                <div key={slot.id} className="property-row">
                  <label style={{ width: 80 }}>{slot.name}</label>
                  <input
                    type="text"
                    value={firstAtt?.name ?? ''}
                    placeholder="(no attachment)"
                    onChange={(e) => {
                      const name = e.target.value;
                      const newAttachments = new Map(selectedSkin.attachments);
                      // Remove all existing entries for this slot
                      for (const [key] of slotAtts) {
                        newAttachments.delete(key);
                      }
                      if (name) {
                        newAttachments.set(`${slot.id}:${name}`, {
                          name,
                          regionName: name,
                          x: firstAtt?.x ?? 0,
                          y: firstAtt?.y ?? 0,
                          width: firstAtt?.width ?? 0,
                          height: firstAtt?.height ?? 0,
                        });
                      }
                      // Directly update the skin's attachments in the store
                      useDocumentStore.setState((s) => ({
                        skins: s.skins.map((sk) =>
                          sk.id === selectedSkin.id
                            ? { ...sk, attachments: newAttachments }
                            : sk,
                        ),
                      }));
                    }}
                  />
                  {slotAtts.length > 1 && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 4 }}>
                      +{slotAtts.length - 1} more
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
