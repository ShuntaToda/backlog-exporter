/**
 * 指定したミリ秒だけ待機する
 * @param ms 待機時間（ミリ秒）
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/**
 * APIリクエストのレート制限対策のためのユーティリティ
 * 100リクエストごとに15秒間待機する
 */
export class RateLimiter {
  private readonly onWait?: () => void
  private requestCount = 0

  /**
   * @param onWait 待機を開始する直前に呼ばれるコールバック（ユーザーへの通知用）
   */
  constructor(onWait?: () => void) {
    this.onWait = onWait
  }

  /**
   * 現在のリクエスト数を取得する
   */
  getCount(): number {
    return this.requestCount
  }

  /**
   * APIリクエストをカウントし、必要に応じて待機する
   * @returns 現在のリクエスト数
   */
  async increment(): Promise<number> {
    this.requestCount++

    if (this.requestCount > 1 && this.requestCount % 100 === 0) {
      this.onWait?.()
      await sleep(15_000)
    }

    return this.requestCount
  }

  /**
   * リクエスト数を設定する
   */
  setCount(count: number): void {
    this.requestCount = count
  }
}
