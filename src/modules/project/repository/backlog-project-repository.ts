import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {ProjectRepository} from '../domain/project-repository.js'

export function newBacklogProjectRepository(client: BacklogHttpClient): ProjectRepository {
  return {
    async resolveProjectId(projectIdOrKey) {
      // 数値の場合はそのままプロジェクトIDとして返す
      if (!Number.isNaN(Number(projectIdOrKey))) {
        return Number(projectIdOrKey)
      }

      try {
        const projectData = await client.getJson<{id: number}>(`/projects/${projectIdOrKey}`)
        return projectData.id
      } catch (error) {
        throw new Error(
          `プロジェクトキー "${projectIdOrKey}" からプロジェクトIDの取得に失敗しました: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    },
  }
}
