/**
 * FIFO 任务队列：同时最多 maxConcurrent 个任务在执行，其余排队等待。
 */
export class TaskConcurrencyQueue {
  private running = 0;
  private readonly pending: Array<() => void> = [];

  constructor(private readonly maxConcurrent: number) {}

  get activeCount(): number {
    return this.running;
  }

  get waitingCount(): number {
    return this.pending.length;
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const job = () => {
        this.running++;
        fn()
          .then(resolve, reject)
          .finally(() => {
            this.running--;
            this.dequeueNext();
          });
      };

      if (this.running < this.maxConcurrent) {
        job();
      } else {
        this.pending.push(job);
      }
    });
  }

  private dequeueNext(): void {
    if (this.running >= this.maxConcurrent || this.pending.length === 0) {
      return;
    }
    const next = this.pending.shift();
    next?.();
  }
}
