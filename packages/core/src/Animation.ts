import type { Skeleton } from './Skeleton.js';
import type { Timeline } from './Timeline.js';

/**
 * A named animation composed of multiple timelines.
 */
export class Animation {
  name: string;
  duration: number;
  timelines: Timeline[];

  constructor(name: string, timelines: Timeline[], duration: number) {
    this.name = name;
    this.timelines = timelines;
    this.duration = duration;
  }

  /**
   * Apply all timelines at the given time to the skeleton.
   */
  apply(skeleton: Skeleton, time: number): void {
    for (const timeline of this.timelines) {
      timeline.apply(skeleton, time);
    }
  }
}
