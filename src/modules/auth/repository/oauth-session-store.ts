import {chmod, mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join} from 'node:path'
import process from 'node:process'

import {backlogOrigin} from '../../../shared/backlog-url.js'
import {OAuthSession} from '../domain/oauth-session.js'

// 出力先ごとの backlog-settings.json はリポジトリに入れられることがあるため、トークンは利用者の設定ディレクトリに分けて置く
export function configDirectory(): string {
  if (process.env.BACKLOG_EXPORTER_CONFIG_DIR) return process.env.BACKLOG_EXPORTER_CONFIG_DIR
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(base, 'backlog-exporter')
}

// スペースごとに1ファイル。ポート付きのドメイン（テスト・セルフホスト）でもファイル名に使える文字にする
export function sessionFilePath(domain: string): string {
  const {host} = new URL(backlogOrigin(domain))
  return join(configDirectory(), 'oauth', `${host.replaceAll(/[^\w.-]/g, '_')}.json`)
}

export async function loadSession(domain: string): Promise<OAuthSession | undefined> {
  let data: string
  try {
    data = await readFile(sessionFilePath(domain), 'utf8')
  } catch {
    return undefined
  }

  try {
    return JSON.parse(data) as OAuthSession
  } catch {
    throw new Error(
      `OAuthのログイン情報を読み取れません: ${sessionFilePath(domain)}。backlog-exporter login で再度ログインしてください`,
    )
  }
}

export async function saveSession(session: OAuthSession): Promise<void> {
  const filePath = sessionFilePath(session.domain)
  await mkdir(join(configDirectory(), 'oauth'), {mode: 0o700, recursive: true})
  await writeFile(filePath, JSON.stringify(session, null, 2), {encoding: 'utf8', mode: 0o600})
  // modeは新規作成のときしか効かないため、既存のファイルも本人だけが読める権限に揃える
  await chmod(filePath, 0o600)
}

export async function deleteSession(domain: string): Promise<boolean> {
  const filePath = sessionFilePath(domain)
  try {
    await rm(filePath)
    return true
  } catch {
    return false
  }
}
