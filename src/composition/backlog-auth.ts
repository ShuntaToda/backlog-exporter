import {randomBytes} from 'node:crypto'

import {requestToken} from '../modules/auth/repository/backlog-token-endpoint.js'
import {openBrowser} from '../modules/auth/repository/browser.js'
import {listenForCallback} from '../modules/auth/repository/callback-listener.js'
import {loadSession, saveSession} from '../modules/auth/repository/oauth-session-store.js'
import {LoginDeps} from '../modules/auth/use-case/login.js'
import {createOAuthAuth} from '../modules/auth/use-case/oauth-auth.js'
import {ResolveBacklogAuthDeps} from '../modules/auth/use-case/resolve-backlog-auth.js'
import {Logger} from '../shared/ports.js'

export function backlogAuthDeps(logger: Logger): ResolveBacklogAuthDeps {
  return {
    createOAuthAuth: (session) => createOAuthAuth({now: Date.now, requestToken, saveSession}, session),
    loadSession,
    logger,
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
