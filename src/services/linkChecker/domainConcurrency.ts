const DOMAIN_LOCK_POLL_MS = 25;

/**
 * 同一域名同时只允许一个 HTTP 探测在进行；
 * 不同域名由 batchRunner 的 worker 池并行，避免对单站连发触发风控。
 */
export class DomainConcurrencyGate {
  private readonly inFlight = new Set<string>();

  async acquire(domain: string): Promise<void> {
    while (this.inFlight.has(domain)) {
      await new Promise(resolve => setTimeout(resolve, DOMAIN_LOCK_POLL_MS));
    }
    this.inFlight.add(domain);
  }

  release(domain: string): void {
    this.inFlight.delete(domain);
  }
}
