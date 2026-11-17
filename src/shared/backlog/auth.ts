// Backlog APIへの認証方法。APIキーはクエリパラメーター、OAuthはAuthorizationヘッダーで送る
// https://developer.nulab.com/ja/docs/backlog/auth/
export interface BacklogCredentials {
  headers: Record<string, string>
  query: Record<string, string>
}

export interface BacklogAuth {
  // OAuthはトークンが途中で更新されるため、リクエストのたびに取り直す
  credentials(): Promise<BacklogCredentials>
  // 401を受けたときに1度だけ呼ばれる。解決したら同じリクエストを送り直す
  recoverFromUnauthorized?(): Promise<void>
}

export function apiKeyAuth(apiKey: string): BacklogAuth {
  return {
    async credentials() {
      return {headers: {}, query: {apiKey}}
    },
  }
}
