/** Bound upstream work and waiting requests without holding database resources. */
export class RequestLimiter {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(private readonly concurrency = 4, private readonly maxQueued = 64) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      if (this.queue.length >= this.maxQueued) throw new Error('Upstream request queue is full.');
      await new Promise<void>((resolve) => this.queue.push(resolve));
    } else this.active++;
    try { return await work(); }
    finally {
      const next = this.queue.shift();
      if (next) next(); else this.active--;
    }
  }
}
