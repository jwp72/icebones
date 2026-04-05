import { useRef, useEffect, useCallback } from 'react';
import { useDocumentStore, type AnimNode, type BoneNode } from '../store/documentStore';
import { useEditorStore } from '../store/editorStore';

const TRACK_WIDTH = 600;
const PIXELS_PER_SECOND = 200;

/**
 * Bottom panel showing a timeline for the selected animation.
 * Displays keyframe rows, a scrubber, and playback controls.
 */
export function TimelinePanel() {
  const animations = useDocumentStore((s) => s.animations);
  const addAnimation = useDocumentStore((s) => s.addAnimation);
  const bones = useDocumentStore((s) => s.bones);
  const selectedAnimId = useEditorStore((s) => s.selectedAnimId);
  const selectAnim = useEditorStore((s) => s.selectAnim);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const playbackTime = useEditorStore((s) => s.playbackTime);
  const setPlaybackTime = useEditorStore((s) => s.setPlaybackTime);
  const lastFrameRef = useRef(0);

  const selectedAnim = animations.find((a) => a.id === selectedAnimId);

  function handleAddAnimation() {
    const name = prompt('Animation name:', `anim_${animations.length + 1}`);
    if (name) {
      const durationStr = prompt('Duration (seconds):', '1');
      const duration = parseFloat(durationStr || '1') || 1;
      const id = addAnimation(name, duration);
      selectAnim(id);
    }
  }

  function handleAddKeyframe() {
    if (!selectedAnim) return;
    const selectedBoneId = useEditorStore.getState().selectedBoneId;
    if (!selectedBoneId) {
      alert('Select a bone first, then add a keyframe.');
      return;
    }

    const bone = bones.find((b) => b.id === selectedBoneId);
    if (!bone) return;

    const { addKeyframe } = useDocumentStore.getState();
    const time = playbackTime;

    // Add rotation keyframe
    addKeyframe(selectedAnim.id, 'rotate', selectedBoneId, time, {
      angle: bone.rotation,
    });

    // Add translate keyframe
    addKeyframe(selectedAnim.id, 'translate', selectedBoneId, time, {
      x: bone.x,
      y: bone.y,
    });

    // Add scale keyframe
    addKeyframe(selectedAnim.id, 'scale', selectedBoneId, time, {
      x: bone.scaleX,
      y: bone.scaleY,
    });
  }

  // Animation playback loop
  useEffect(() => {
    if (!isPlaying || !selectedAnim) return;

    lastFrameRef.current = performance.now();

    function tick() {
      const now = performance.now();
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;

      const anim = useDocumentStore.getState().animations.find(
        (a) => a.id === selectedAnimId,
      );
      if (!anim || anim.duration <= 0) return;

      const { playbackTime: currentTime, setPlaybackTime: setTime } = useEditorStore.getState();
      let newTime = currentTime + dt;
      // Loop
      if (newTime >= anim.duration) {
        newTime = newTime % anim.duration;
      }
      setTime(newTime);

      // Apply animation to bone states
      applyAnimation(anim, newTime);

      if (useEditorStore.getState().isPlaying) {
        requestAnimationFrame(tick);
      }
    }

    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, selectedAnimId]);

  // Apply animation state to bones
  const applyAnimation = useCallback((anim: AnimNode, time: number) => {
    const { bones: currentBones, updateBone } = useDocumentStore.getState();
    const boneMap = new Map<string, BoneNode>();
    for (const b of currentBones) boneMap.set(b.id, b);

    for (const tl of anim.timelines) {
      if (tl.keyframes.length === 0) continue;
      const bone = boneMap.get(tl.targetId);
      if (!bone) continue;

      // Find surrounding keyframes
      const frames = tl.keyframes;
      let frameIdx = 0;
      for (let i = 0; i < frames.length; i++) {
        if (frames[i].time <= time) frameIdx = i;
      }

      const kf0 = frames[frameIdx];
      const kf1 = frameIdx < frames.length - 1 ? frames[frameIdx + 1] : null;

      // Interpolation factor
      let t = 0;
      if (kf1) {
        const dur = kf1.time - kf0.time;
        if (dur > 0) t = (time - kf0.time) / dur;
      }

      if (tl.type === 'rotate') {
        const a0 = (kf0.value.angle as number) ?? 0;
        const a1 = kf1 ? ((kf1.value.angle as number) ?? 0) : a0;
        updateBone(tl.targetId, { rotation: a0 + (a1 - a0) * t });
      } else if (tl.type === 'translate') {
        const x0 = (kf0.value.x as number) ?? 0;
        const y0 = (kf0.value.y as number) ?? 0;
        const x1 = kf1 ? ((kf1.value.x as number) ?? 0) : x0;
        const y1 = kf1 ? ((kf1.value.y as number) ?? 0) : y0;
        updateBone(tl.targetId, {
          x: x0 + (x1 - x0) * t,
          y: y0 + (y1 - y0) * t,
        });
      } else if (tl.type === 'scale') {
        const sx0 = (kf0.value.x as number) ?? 1;
        const sy0 = (kf0.value.y as number) ?? 1;
        const sx1 = kf1 ? ((kf1.value.x as number) ?? 1) : sx0;
        const sy1 = kf1 ? ((kf1.value.y as number) ?? 1) : sy0;
        updateBone(tl.targetId, {
          scaleX: sx0 + (sx1 - sx0) * t,
          scaleY: sy0 + (sy1 - sy0) * t,
        });
      }
    }
  }, []);

  function handleScrubberClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!selectedAnim || selectedAnim.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const totalWidth = Math.max(TRACK_WIDTH, selectedAnim.duration * PIXELS_PER_SECOND);
    const time = Math.max(0, Math.min(selectedAnim.duration, (x / totalWidth) * selectedAnim.duration));
    setPlaybackTime(time);

    // If not playing, still apply the animation at this time
    if (!isPlaying) {
      applyAnimation(selectedAnim, time);
    }
  }

  function timeToX(time: number, duration: number): number {
    const totalWidth = Math.max(TRACK_WIDTH, duration * PIXELS_PER_SECOND);
    return (time / Math.max(duration, 0.001)) * totalWidth;
  }

  return (
    <div className="panel timeline-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="timeline-controls">
        <select
          value={selectedAnimId ?? ''}
          onChange={(e) => selectAnim(e.target.value || null)}
        >
          <option value="">-- Select Animation --</option>
          {animations.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.duration.toFixed(1)}s)</option>
          ))}
        </select>
        <button onClick={handleAddAnimation}>+ Anim</button>
        <button onClick={handleAddKeyframe} disabled={!selectedAnim}>
          + Key
        </button>
        <button onClick={() => setPlaying(!isPlaying)} disabled={!selectedAnim}>
          {isPlaying ? '\u23F8' : '\u25B6'}
        </button>
        <button
          onClick={() => { setPlaybackTime(0); if (!isPlaying && selectedAnim) applyAnimation(selectedAnim, 0); }}
          disabled={!selectedAnim}
        >
          {'\u23EE'}
        </button>
        <span className="timeline-time">
          {playbackTime.toFixed(2)}s
          {selectedAnim ? ` / ${selectedAnim.duration.toFixed(2)}s` : ''}
        </span>
      </div>

      <div className="timeline-body">
        {!selectedAnim ? (
          <div className="empty-message">
            Select or create an animation to view its timeline.
          </div>
        ) : (
          <>
            {/* Ruler */}
            <div
              className="timeline-ruler"
              style={{ display: 'flex' }}
              onClick={handleScrubberClick}
            >
              <div style={{ width: 150, flexShrink: 0, borderRight: '1px solid var(--border)' }} />
              <div style={{ flex: 1, position: 'relative' }}>
                {renderRulerMarks(selectedAnim.duration)}
                {/* Scrubber on ruler */}
                <div
                  className="timeline-scrubber"
                  style={{
                    left: timeToX(playbackTime, selectedAnim.duration),
                  }}
                />
              </div>
            </div>

            {/* Timeline rows */}
            {selectedAnim.timelines.length === 0 ? (
              <div className="empty-message">
                Select a bone and click "+ Key" to add keyframes.
              </div>
            ) : (
              selectedAnim.timelines.map((tl, idx) => {
                const bone = bones.find((b) => b.id === tl.targetId);
                const label = `${bone?.name ?? tl.targetId} / ${tl.type}`;

                return (
                  <div key={idx} className="timeline-row">
                    <div className="timeline-row-label" title={label}>
                      {label}
                    </div>
                    <div
                      className="timeline-row-track"
                      onClick={handleScrubberClick}
                      style={{ position: 'relative' }}
                    >
                      {tl.keyframes.map((kf, kIdx) => (
                        <div
                          key={kIdx}
                          className="timeline-keyframe"
                          style={{
                            left: timeToX(kf.time, selectedAnim.duration),
                          }}
                          title={`t=${kf.time.toFixed(2)}s`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlaybackTime(kf.time);
                            if (!isPlaying) applyAnimation(selectedAnim, kf.time);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirm(`Delete keyframe at t=${kf.time.toFixed(2)}s?`)) {
                              useDocumentStore.getState().removeKeyframe(
                                selectedAnim.id, tl.type, tl.targetId, kf.time,
                              );
                            }
                          }}
                        />
                      ))}
                      {/* Scrubber line */}
                      <div
                        className="timeline-scrubber"
                        style={{
                          left: timeToX(playbackTime, selectedAnim.duration),
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}

function renderRulerMarks(duration: number) {
  const marks: React.ReactNode[] = [];
  const step = 0.1; // every 100ms
  const totalWidth = Math.max(TRACK_WIDTH, duration * PIXELS_PER_SECOND);

  for (let t = 0; t <= duration; t += step) {
    const x = (t / Math.max(duration, 0.001)) * totalWidth;
    const isMajor = Math.abs(t - Math.round(t)) < 0.01;

    if (isMajor) {
      marks.push(
        <span
          key={t}
          className="timeline-ruler-label"
          style={{ left: x }}
        >
          {t.toFixed(1)}s
        </span>,
      );
    }
  }

  return marks;
}
