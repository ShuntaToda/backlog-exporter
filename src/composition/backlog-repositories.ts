import {DocumentRepository} from '../modules/document/domain/document-repository.js'
import {newBacklogDocumentRepository} from '../modules/document/repository/backlog-document-repository.js'
import {IssueRepository} from '../modules/issue/domain/issue-repository.js'
import {newBacklogIssueRepository} from '../modules/issue/repository/backlog-issue-repository.js'
import {ProjectRepository} from '../modules/project/domain/project-repository.js'
import {newBacklogProjectRepository} from '../modules/project/repository/backlog-project-repository.js'
import {WikiRepository} from '../modules/wiki/domain/wiki-repository.js'
import {newBacklogWikiRepository} from '../modules/wiki/repository/backlog-wiki-repository.js'
import {BacklogHttpClient} from '../shared/backlog/http-client.js'

export interface BacklogConnection {
  apiKey: string
  domain: string
  onRateLimitWait?: () => void
}

export interface BacklogRepositories {
  documentRepository: DocumentRepository
  issueRepository: IssueRepository
  projectRepository: ProjectRepository
  wikiRepository: WikiRepository
}

// 1つのHTTPクライアント（＝レート制限カウンタ）を全repositoryで共有する
export function createBacklogRepositories(connection: BacklogConnection): BacklogRepositories {
  const client = new BacklogHttpClient(connection)
  return {
    documentRepository: newBacklogDocumentRepository(client),
    issueRepository: newBacklogIssueRepository(client),
    projectRepository: newBacklogProjectRepository(client),
    wikiRepository: newBacklogWikiRepository(client),
  }
}
