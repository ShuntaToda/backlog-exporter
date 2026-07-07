import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'

export async function getProjectIdFromKey(client: BacklogHttpClient, projectKey: string): Promise<number> {
  try {
    const projectData = await client.getJson<{id: number}>(`/projects/${projectKey}`)
    return projectData.id
  } catch (error) {
    throw new Error(
      `プロジェクトキー "${projectKey}" からプロジェクトIDの取得に失敗しました: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

export async function validateAndGetProjectId(client: BacklogHttpClient, projectIdOrKey: string): Promise<number> {
  // 数値の場合はそのままプロジェクトIDとして返す
  if (!Number.isNaN(Number(projectIdOrKey))) {
    return Number(projectIdOrKey)
  }

  // 文字列の場合はプロジェクトキーとして扱い、IDを取得する
  return getProjectIdFromKey(client, projectIdOrKey)
}
