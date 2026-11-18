import {randomBytes} from 'node:crypto'

import {tokenFromResponse} from '../modules/auth/domain/oauth-session.js'
import {openBrowser} from '../modules/auth/repository/browser.js'
import {listenForCallback} from '../modules/auth/repository/callback-listener.js'
import {loadSession, saveSession} from '../modules/auth/repository/oauth-session-store.js'
import {LoginDeps} from '../modules/auth/use-case/login.js'
import {createOAuthAuth} from '../modules/auth/use-case/oauth-auth.js'
import {ResolveBacklogAuthDeps} from '../modules/auth/use-case/resolve-backlog-auth.js'
import {postTokenRequest} from '../shared/backlog/oauth-token-endpoint.js'
import {readApiKeyFromEnv, readClientSecretFromEnv} from '../shared/config/env.js'
import {Logger} from '../shared/ports.js'

async function requestToken(domain: string, grant: URLSearchParams, nowMs: number) {
  return tokenFromResponse(await postTokenRequest(domain, grant), nowMs)
}

export function backlogAuthDeps(logger: Logger): ResolveBacklogAuthDeps {
  return {
    createOAuthAuth: (session) =>
      createOAuthAuth({logger, now: Date.now, readClientSecretFromEnv, requestToken, saveSession}, session),
    loadSession,
    logger,
    readApiKeyFromEnv,
  }
}

export function loginDeps(logger: Logger): LoginDeps {
  return {
    generateState: () => randomBytes(32).toString('hex'),
    listenForCallback,
    logger,
    now: Date.now,
    openBrowser,
    requestToken,
    saveSession,
  }
}
