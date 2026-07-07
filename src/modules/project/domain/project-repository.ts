export interface ProjectRepository {
  resolveProjectId(projectIdOrKey: string): Promise<number>
}
