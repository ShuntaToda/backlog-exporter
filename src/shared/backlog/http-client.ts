import {RateLimiter, sleep} from './rate-limiter.js'

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

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504])
const MAX_RETRIES = 2
const RETRY_BASE_DELAY_MS = 300

// apiKey付与・レート制限(100req/15s)・一時エラーのリトライを担うBacklog APIクライアント
export class BacklogHttpClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly rateLimiter: RateLimiter

  constructor(options: {apiKey: string; domain: string; onRateLimitWait?: () => void}) {
    this.apiKey = options.apiKey
    this.baseUrl = `https://${options.domain}/api/v2`
    this.rateLimiter = new RateLimiter(options.onRateLimitWait)
  }

  async getJson<T>(pathname: string, params: Record<string, string> = {}): Promise<T> {
    await this.rateLimiter.increment()

    const searchParams = new URLSearchParams({apiKey: this.apiKey, ...params})
    const url = `${this.baseUrl}${pathname}?${searchParams.toString()}`
    const response = await this.fetchWithRetry(url)
    return (await response.json()) as T
  }

  // リトライのため、ループ内のawaitは意図したもの
  /* eslint-disable no-await-in-loop */
  private async fetchWithRetry(url: string): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      let response: Response
      try {
        response = await fetch(url)
      } catch (error) {
        // ネットワークエラー
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt)
          continue
        }

        throw error
      }

      if (response.ok) {
        return response
      }

      if (attempt < MAX_RETRIES && RETRYABLE_STATUSES.has(response.status)) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt)
        continue
      }

      throw new HttpError(response.status, response.statusText, this.maskApiKey(url))
    }
  }
  /* eslint-enable no-await-in-loop */

  private maskApiKey(url: string): string {
    return url.replace(/apiKey=[^&]*/, 'apiKey=***')
  }
}
