import {chmod, mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import {backlogOrigin} from '../../../shared/backlog-url.js'
import {configDirectory} from '../../../shared/config/env.js'
import {OAuthSession, parseOAuthSession} from '../domain/oauth-session.js'

function oauthDirectory(): string {
  return join(configDirectory(), 'oauth')
}

// スペースごとに1ファイル。ポート付きのドメイン（テスト・セルフホスト）でもファイル名に使える文字にする
export function sessionFilePath(domain: string): string {
  const {host} = new URL(backlogOrigin(domain))
  return join(oauthDirectory(), `${host.replaceAll(/[^\w.-]/g, '_')}.json`)
}

// 無いことだけを「未ログイン」として扱い、権限エラーなどは原因が分かるようにそのまま投げる
function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

export async function loadSession(domain: string): Promise<OAuthSession | undefined> {
  let data: string
  try {
    data = await readFile(sessionFilePath(domain), 'utf8')
  } catch (error) {
    if (isNotFound(error)) return undefined
    throw error
  }

  let session: OAuthSession | undefined
  try {
    session = parseOAuthSession(JSON.parse(data))
  } catch {
    session = undefined
  }

  if (!session) {
    throw new Error(
      `OAuthのログイン情報を読み取れません: ${sessionFilePath(domain)}。backlog-exporter login で再度ログインしてください`,
    )
  }

  return session
}

export async function saveSession(session: OAuthSession): Promise<void> {
  const filePath = sessionFilePath(session.domain)
  await mkdir(oauthDirectory(), {mode: 0o700, recursive: true})
  // modeは新規作成のときしか効かないため、既にあるディレクトリとファイルも本人だけが読める権限に揃える
  await chmod(oauthDirectory(), 0o700)
  await writeFile(filePath, JSON.stringify(session, null, 2), {encoding: 'utf8', mode: 0o600})
  await chmod(filePath, 0o600)
}

export async function deleteSession(domain: string): Promise<boolean> {
  try {
    await rm(sessionFilePath(domain))
    return true
  } catch (error) {
    if (isNotFound(error)) return false
    throw error
  }
}
