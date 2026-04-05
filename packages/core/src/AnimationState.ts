import type { Animation } from './Animation.js';
import type { Skeleton } from './Skeleton.js';
import type { SkeletonData } from './SkeletonData.js';

/**
 * A single entry in an animation track, forming a linked list for queued animations.
 */
export class TrackEntry {
  animation: Animation;
  time = 0;
  loop: boolean;
  next: TrackEntry | null = null;

  constructor(animation: Animation, loop: boolean) {
    this.animation = animation;
    this.loop = loop;
  }
}

/**
 * Manages animation playback across multiple tracks.
 *
 * Each track can play one animation at a time, with a queue of upcoming animations.
 */
export class AnimationState {
  data: SkeletonData;
  tracks: (TrackEntry | null)[] = [];

  constructor(data: SkeletonData) {
    this.data = data;
  }

  /**
   * Set the current animation on a track, replacing any existing animation.
   * Returns the new TrackEntry, or null if the animation was not found.
   */
  setAnimation(trackIndex: number, animationName: string, loop: boolean): TrackEntry | null {
    const animation = this.data.findAnimation(animationName);
    if (!animation) return null;
    const entry = new TrackEntry(animation, loop);
    // Ensure tracks array is large enough.
    while (this.tracks.length <= trackIndex) {
      this.tracks.push(null);
    }
    this.tracks[trackIndex] = entry;
    return entry;
  }

  /**
   * Queue an animation to play after the current one on a track.
   * @param delay — seconds to wait after the current animation before starting this one.
   *                If 0, starts immediately when the current animation finishes.
   */
  addAnimation(
    trackIndex: number,
    animationName: string,
    loop: boolean,
    delay = 0,
  ): TrackEntry | null {
    const animation = this.data.findAnimation(animationName);
    if (!animation) return null;
    const entry = new TrackEntry(animation, loop);

    while (this.tracks.length <= trackIndex) {
      this.tracks.push(null);
    }

    const current = this.tracks[trackIndex];
    if (!current) {
      // Nothing playing — set directly, with a time offset of -delay.
      entry.time = -delay;
      this.tracks[trackIndex] = entry;
    } else {
      // Walk to the end of the queue.
      let tail = current;
      while (tail.next) {
        tail = tail.next;
      }
      tail.next = entry;
      entry.time = -delay;
    }
    return entry;
  }

  /**
   * Advance playback time on all tracks.
   */
  update(deltaTime: number): void {
    for (let i = 0; i < this.tracks.length; i++) {
      const entry = this.tracks[i];
      if (!entry) continue;

      entry.time += deltaTime;

      // If non-looping and past duration, advance to next queued animation.
      if (!entry.loop && entry.time >= entry.animation.duration && entry.next) {
        const overflow = entry.time - entry.animation.duration;
        const next = entry.next;
        next.time += overflow;
        this.tracks[i] = next;
      }
    }
  }

  /**
   * Apply the current animation state to the skeleton.
   */
  apply(skeleton: Skeleton): void {
    for (const entry of this.tracks) {
      if (!entry) continue;
      let time = entry.time;
      if (entry.loop && entry.animation.duration > 0) {
        time = time % entry.animation.duration;
        if (time < 0) time += entry.animation.duration;
      }
      entry.animation.apply(skeleton, time);
    }
  }

  /**
   * Clear all tracks.
   */
  clearTracks(): void {
    this.tracks.length = 0;
  }

  /**
   * Clear a specific track.
   */
  clearTrack(trackIndex: number): void {
    if (trackIndex < this.tracks.length) {
      this.tracks[trackIndex] = null;
    }
  }
}
