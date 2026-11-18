import {Logger} from '../../../shared/ports.js'
import {
  buildAuthorizationUrl,
  LoopbackRedirect,
  parseLoopbackRedirectUri,
  readAuthorizationCallback,
} from '../domain/authorization.js'
import {authorizationCodeGrant, OAuthClient, OAuthSession, OAuthToken, sessionToSave} from '../domain/oauth-session.js'
import {CallbackListener} from '../repository/callback-listener.js'

export interface LoginDeps {
  generateState: () => string
  listenForCallback: (redirect: LoopbackRedirect, timeoutMs: number) => Promise<CallbackListener>
  logger: Logger
  now: () => number
  openBrowser: (url: string) => Promise<boolean>
  requestToken: (domain: string, grant: URLSearchParams, nowMs: number) => Promise<OAuthToken>
  saveSession: (session: OAuthSession) => Promise<void>
}

// ブラウザでの許可を待つ上限。離席したまま待ち続けてポートを塞がないようにする
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000

export async function login(
  deps: LoginDeps,
  options: {client: OAuthClient; domain: string; saveClientSecret: boolean},
): Promise<void> {
  const {client, domain, saveClientSecret} = options
  const {logger} = deps

  // サーバを立てる前に形を確かめ、間違ったURIでブラウザを開かない
  const redirect = parseLoopbackRedirectUri(client.redirectUri)
  const state = deps.generateState()
  const listener = await deps.listenForCallback(redirect, CALLBACK_TIMEOUT_MS)

  try {
    const authorizationUrl = buildAuthorizationUrl(domain, client, state)
    logger.log('ブラウザでBacklogの許可画面を開きます。開かない場合は次のURLを開いてください:')
    logger.log(authorizationUrl)
    if (!(await deps.openBrowser(authorizationUrl))) {
      logger.warn('ブラウザを自動で開けませんでした。上のURLを手動で開いてください')
    }

    const code = readAuthorizationCallback(await listener.callbackUrl, state)
    const token = await deps.requestToken(domain, authorizationCodeGrant(client, code), deps.now())
    await deps.saveSession(sessionToSave({client, domain, token}, saveClientSecret))
  } finally {
    await listener.close()
  }

  logger.log(`${domain} へのログインが完了しました`)
  if (!saveClientSecret) {
    logger.log(
      'Client Secret は保存していません。トークンの更新のため、実行時は BACKLOG_OAUTH_CLIENT_SECRET を渡してください',
    )
  }
}
