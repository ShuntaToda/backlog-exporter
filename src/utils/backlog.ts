import ky from 'ky'

import {t} from './i18n.js'

/**
 * プロジェクトキーからプロジェクトIDを取得する
 * @param domain Backlogドメイン (例: example.backlog.jp)
 * @param projectKey プロジェクトキー
 * @param apiKey BacklogのAPIキー
 * @returns プロジェクトID
 */
export async function getProjectIdFromKey(domain: string, projectKey: string, apiKey: string): Promise<number> {
  try {
    const baseUrl = `https://${domain}/api/v2`
    const projectUrl = `${baseUrl}/projects/${projectKey}?apiKey=${apiKey}`

    const projectData = await ky.get(projectUrl).json<{id: number}>()
    return projectData.id
  } catch (error) {
    throw new Error(
      t('common.messages.failedToGetProjectId', {
        errorMessage: error instanceof Error ? error.message : String(error),
        projectKey,
      }),
    )
  }
}

/**
 * プロジェクトIDまたはキーを検証し、必要に応じてキーからIDを取得する
 * @param domain Backlogドメイン
 * @param projectIdOrKey プロジェクトIDまたはキー
 * @param apiKey BacklogのAPIキー
 * @returns プロジェクトID
 */
export async function validateAndGetProjectId(domain: string, projectIdOrKey: string, apiKey: string): Promise<number> {
  // 数値の場合はそのままプロジェクトIDとして返す
  if (!Number.isNaN(Number(projectIdOrKey))) {
    return Number(projectIdOrKey)
  }

  // 文字列の場合はプロジェクトキーとして扱い、IDを取得する
  return getProjectIdFromKey(domain, projectIdOrKey, apiKey)
}
