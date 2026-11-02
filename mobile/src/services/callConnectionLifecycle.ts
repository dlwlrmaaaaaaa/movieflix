/** Serialize connect/publish/cleanup so a peer is never closed mid-negotiation. */
export class CallConnectionLifecycle {
  private generation = 0;
  private pending: Promise<void> | null = null;
  private pendingRoom: string | null = null;
  private stopping: Promise<void> | null = null;

  run(roomCode: string, work: (isCurrent: () => boolean) => Promise<void>): Promise<void> {
    if (this.stopping) return this.stopping.then(() => this.run(roomCode, work));
    if (this.pending) {
      if (this.pendingRoom !== roomCode) return Promise.reject(new Error('Leave the current call before connecting to another room.'));
      return this.pending;
    }
    const generation = this.generation;
    const isCurrent = () => generation === this.generation;
    // Schedule work after storing the promise, including synchronous failures.
    const pending = Promise.resolve().then(() => work(isCurrent)).finally(() => {
      if (this.pending === pending) { this.pending = null; this.pendingRoom = null; }
    });
    this.pending = pending;
    this.pendingRoom = roomCode;
    return pending;
  }

  stop(cleanup: () => Promise<void>): Promise<void> {
    if (this.stopping) return this.stopping;
    ++this.generation;
    const stopping = Promise.resolve(this.pending).catch(() => undefined).then(cleanup).finally(() => {
      if (this.stopping === stopping) this.stopping = null;
    });
    this.stopping = stopping;
    return stopping;
  }
}
