import {backlogOrigin} from '../backlog-url.js'

// https://developer.nulab.com/ja/docs/backlog/auth/ のトークンエンドポイント（認可コードの交換とトークンの更新で共通）。
// 本文の形は呼び出し側（auth の domain）で確かめる
export async function postTokenRequest(domain: string, grant: URLSearchParams): Promise<unknown> {
  const response = await fetch(`${backlogOrigin(domain)}/api/v2/oauth2/token`, {
    body: grant,
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`トークンの取得に失敗しました: HTTP ${response.status} ${await errorDetail(response)}`)
  }

  return response.json()
}

// Backlogのエラーは {errors: [{message}]} の形。読めなければステータス行だけを出す
async function errorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {errors?: Array<{message?: string}>}
    const messages = body.errors?.map((error) => error.message).filter(Boolean)
    return messages && messages.length > 0 ? messages.join(', ') : response.statusText
  } catch {
    return response.statusText
  }
}
