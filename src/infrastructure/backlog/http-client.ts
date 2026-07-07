import {RateLimiter, sleep} from './rate-limiter.js'

/**
 * HTTPステータスエラー。
 * fetchは4xx/5xxでthrowしないため、`response.ok` でない場合にこのエラーを投げる。
 */
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

/** リトライ対象のHTTPステータス（一時的な失敗とみなせるもの） */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504])
/** リトライ回数（初回リクエストを除く） */
const MAX_RETRIES = 2
/** リトライ間隔の基準（指数バックオフ: 300ms, 600ms, ...） */
const RETRY_BASE_DELAY_MS = 300

/**
 * Backlog API v2 のHTTPクライアント。
 * apiKeyの付与・レート制限（100リクエストごとに15秒待機）・一時的な失敗のリトライを一手に引き受ける。
 */
export class BacklogHttpClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly rateLimiter: RateLimiter

  constructor(options: {apiKey: string; domain: string; onRateLimitWait?: () => void}) {
    this.apiKey = options.apiKey
    this.baseUrl = `https://${options.domain}/api/v2`
    this.rateLimiter = new RateLimiter(options.onRateLimitWait)
  }

  /**
   * GETリクエストを送り、JSONレスポンスを返す
   * @param pathname `/issues` のようなAPIパス
   * @param params クエリパラメータ（apiKeyは自動で付与される）
   */
  async getJson<T>(pathname: string, params: Record<string, string> = {}): Promise<T> {
    await this.rateLimiter.increment()

    const searchParams = new URLSearchParams({apiKey: this.apiKey, ...params})
    const url = `${this.baseUrl}${pathname}?${searchParams.toString()}`
    const response = await this.fetchWithRetry(url)
    return (await response.json()) as T
  }

  /**
   * 一時的な失敗（408/429/5xx・ネットワークエラー）を指数バックオフでリトライしつつfetchする
   */
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

  /**
   * エラーメッセージ等に含めても安全なように、URL中のapiKeyをマスクする
   */
  private maskApiKey(url: string): string {
    return url.replace(/apiKey=[^&]*/, 'apiKey=***')
  }
}
