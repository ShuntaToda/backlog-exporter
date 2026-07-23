import {backlogOrigin} from '../backlog-url.js'
import {sleep} from './sleep.js'

// fetchは4xx/5xxでthrowしないため、response.okでない場合にこれを投げる
export class HttpError extends Error {
  constructor(
    readonly status: number,
    statusText: string,
    url: string,
  ) {
    super(`HTTP ${status} ${statusText}: GET ${url}`)
    this.name = 'HttpError'
  }
}

const RETRYABLE_STATUSES = new Set([408, 500, 502, 503, 504])
const MAX_RETRIES = 2
// 429待機は1回ごとにレート制限ウィンドウ(1分)が更新されるため、通常リトライとは別枠で上限を設ける
const MAX_RATE_LIMIT_WAITS = 5
const RETRY_BASE_DELAY_MS = 300
const RATE_LIMIT_MIN_WAIT_MS = 1000
const RATE_LIMIT_FALLBACK_WAIT_MS = 60_000
const RATE_LIMIT_MAX_WAIT_MS = 120_000

// レート制限(429)はウィンドウが1分単位のため、短いbackoffではなく
// X-RateLimit-Reset(UNIX秒)まで待つ。ヘッダーが無い/不正な場合は1分待つ
export function rateLimitWaitMs(resetHeader: null | string, nowMs: number): number {
  const resetSeconds = Number(resetHeader)
  if (!resetHeader || !Number.isFinite(resetSeconds)) return RATE_LIMIT_FALLBACK_WAIT_MS
  // リセット直後の境界ずれで再度429にならないよう1秒の余裕を持たせる
  const waitMs = resetSeconds * 1000 - nowMs + 1000
  return Math.min(Math.max(waitMs, RATE_LIMIT_MIN_WAIT_MS), RATE_LIMIT_MAX_WAIT_MS)
}

// apiKey付与・429時のX-RateLimit-Resetまでの待機・一時エラーのリトライを担うBacklog APIクライアント
export class BacklogHttpClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly onRateLimitExceeded?: (waitSeconds: number) => void

  constructor(options: {apiKey: string; domain: string; onRateLimitExceeded?: (waitSeconds: number) => void}) {
    this.apiKey = options.apiKey
    this.baseUrl = `${backlogOrigin(options.domain)}/api/v2`
    this.onRateLimitExceeded = options.onRateLimitExceeded
  }

  async getBinary(pathname: string, params: Record<string, string> = {}): Promise<ArrayBuffer> {
    const response = await this.fetchWithRetry(this.requestUrl(pathname, params))
    return response.arrayBuffer()
  }

  async getJson<T>(pathname: string, params: Record<string, string> = {}): Promise<T> {
    const response = await this.fetchWithRetry(this.requestUrl(pathname, params))
    return (await response.json()) as T
  }

  // リトライのため、ループ内のawaitは意図したもの
  /* eslint-disable no-await-in-loop */
  private async fetchWithRetry(url: string): Promise<Response> {
    let rateLimitWaits = 0
    for (let attempt = 0; ; ) {
      let response: Response
      try {
        response = await fetch(url)
      } catch (error) {
        // ネットワークエラー
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt)
          attempt++
          continue
        }

        throw error
      }

      if (response.ok) {
        return response
      }

      // 429は待機すれば解消する見込みが高いため、通常のリトライ回数を消費しない
      if (response.status === 429 && rateLimitWaits < MAX_RATE_LIMIT_WAITS) {
        const waitMs = rateLimitWaitMs(response.headers.get('x-ratelimit-reset'), Date.now())
        this.onRateLimitExceeded?.(Math.ceil(waitMs / 1000))
        await sleep(waitMs)
        rateLimitWaits++
        continue
      }

      if (attempt < MAX_RETRIES && RETRYABLE_STATUSES.has(response.status)) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt)
        attempt++
        continue
      }

      throw new HttpError(response.status, response.statusText, this.maskApiKey(url))
    }
  }
  /* eslint-enable no-await-in-loop */

  private maskApiKey(url: string): string {
    return url.replace(/apiKey=[^&]*/, 'apiKey=***')
  }

  private requestUrl(pathname: string, params: Record<string, string>): string {
    const searchParams = new URLSearchParams({apiKey: this.apiKey, ...params})
    return `${this.baseUrl}${pathname}?${searchParams.toString()}`
  }
}
