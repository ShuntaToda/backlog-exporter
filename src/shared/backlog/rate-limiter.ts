export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

// Backlogのレート制限(100req/15s)対策: 100リクエストごとに15秒待機する
export class RateLimiter {
  private readonly onWait?: () => void
  private requestCount = 0

  constructor(onWait?: () => void) {
    this.onWait = onWait
  }

  getCount(): number {
    return this.requestCount
  }

  async increment(): Promise<number> {
    this.requestCount++

    if (this.requestCount > 1 && this.requestCount % 100 === 0) {
      this.onWait?.()
      await sleep(15_000)
    }

    return this.requestCount
  }

  setCount(count: number): void {
    this.requestCount = count
  }
}
