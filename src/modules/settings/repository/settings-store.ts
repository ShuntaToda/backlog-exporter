import {access, mkdir, readdir, readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import {Settings} from '../domain/settings.js'

export function getSettingsFilePath(directory: string): string {
  return join(directory, 'backlog-settings.json')
}

export async function loadSettings(directory: string): Promise<Settings> {
  const settingsPath = getSettingsFilePath(directory)

  try {
    const data = await readFile(settingsPath, 'utf8')
    return JSON.parse(data) as Settings
  } catch {
    return {}
  }
}

export async function saveSettings(directory: string, settings: Settings): Promise<void> {
  const settingsPath = getSettingsFilePath(directory)

  // ディレクトリが存在しない場合は作成
  await mkdir(directory, {recursive: true})

  await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
}

export async function updateSettings(directory: string, newSettings: Partial<Settings>): Promise<Settings> {
  const currentSettings = await loadSettings(directory)

  // 新しい設定で更新（apiKeyは除外）
  const {apiKey, ...settingsToSave} = newSettings
  const updatedSettings = {...currentSettings, ...settingsToSave}

  await saveSettings(directory, updatedSettings)

  return {...updatedSettings, apiKey}
}

// 設定ファイルを持つディレクトリを親→子の順に列挙する（update/pruneの処理順を保つ）
export async function findSettingsDirectories(
  rootDir: string,
  onReadError?: (directory: string) => void,
): Promise<string[]> {
  const found: string[] = []

  const walk = async (dir: string): Promise<void> => {
    try {
      await access(getSettingsFilePath(dir))
      found.push(dir)
    } catch {
      // 設定ファイルが存在しないディレクトリはスキップ
    }

    try {
      const entries = await readdir(dir, {withFileTypes: true})
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // eslint-disable-next-line no-await-in-loop
          await walk(join(dir, entry.name))
        }
      }
    } catch {
      onReadError?.(dir)
    }
  }

  await walk(rootDir)
  return found
}
