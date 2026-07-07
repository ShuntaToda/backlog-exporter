import {access, mkdir, readdir, readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import {Settings} from '../../domain/settings.js'

/**
 * 設定ファイルのパスを取得する
 * @param directory 設定ファイルを保存するディレクトリ
 * @returns 設定ファイルのパス
 */
export function getSettingsFilePath(directory: string): string {
  return join(directory, 'backlog-settings.json')
}

/**
 * 設定ファイルを読み込む
 * @param directory 設定ファイルが保存されているディレクトリ
 * @returns 設定情報（ファイルが存在しない場合や読み込みエラーの場合は空のオブジェクト）
 */
export async function loadSettings(directory: string): Promise<Settings> {
  const settingsPath = getSettingsFilePath(directory)

  try {
    const data = await readFile(settingsPath, 'utf8')
    return JSON.parse(data) as Settings
  } catch {
    return {}
  }
}

/**
 * 設定ファイルを保存する
 * @param directory 設定ファイルを保存するディレクトリ
 * @param settings 保存する設定情報
 */
export async function saveSettings(directory: string, settings: Settings): Promise<void> {
  const settingsPath = getSettingsFilePath(directory)

  // ディレクトリが存在しない場合は作成
  await mkdir(directory, {recursive: true})

  await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
}

/**
 * 設定ファイルを更新する（apiKeyはファイルには保存せず、戻り値にのみ含める）
 * @param directory 設定ファイルを保存するディレクトリ
 * @param newSettings 更新する設定情報
 */
export async function updateSettings(directory: string, newSettings: Partial<Settings>): Promise<Settings> {
  const currentSettings = await loadSettings(directory)

  // 新しい設定で更新（apiKeyは除外）
  const {apiKey, ...settingsToSave} = newSettings
  const updatedSettings = {...currentSettings, ...settingsToSave}

  await saveSettings(directory, updatedSettings)

  return {...updatedSettings, apiKey}
}

/**
 * ルートディレクトリ配下を再帰的に探索し、設定ファイルを持つディレクトリを列挙する。
 * 親ディレクトリが子ディレクトリより先に並ぶ（update/pruneの処理順を保つため）。
 * @param rootDir 探索の起点ディレクトリ
 * @param onReadError ディレクトリの読み取りに失敗したときに呼ばれるコールバック
 */
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
