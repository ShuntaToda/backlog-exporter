import path from 'node:path'

import {Logger} from '../../../shared/ports.js'
import {ensureDirectory} from '../../../shared/storage/markdown-store.js'
import {DocumentRepository} from '../../document/domain/document-repository.js'
import {exportDocuments} from '../../document/use-case/export-documents.js'
import {IssueRepository} from '../../issue/domain/issue-repository.js'
import {exportIssues} from '../../issue/use-case/export-issues.js'
import {ProjectRepository} from '../../project/domain/project-repository.js'
import {FolderType} from '../../settings/domain/settings.js'
import {updateSettings} from '../../settings/repository/settings-store.js'
import {WikiRepository} from '../../wiki/domain/wiki-repository.js'
import {exportWikis} from '../../wiki/use-case/export-wikis.js'

export interface ExportAllDeps {
  documentRepository: DocumentRepository
  issueRepository: IssueRepository
  logger: Logger
  projectRepository: ProjectRepository
  wikiRepository: WikiRepository
}

export type ExportTarget = 'documents' | 'issues' | 'wiki'

export interface ExportAllOptions {
  apiKey: string
  domain: string
  issueKeyFileName?: boolean
  issueKeyFolder?: boolean
  maxCount: number
  outputRoot: string
  projectIdOrKey: string
  targets: ExportTarget[]
}

export async function exportAll(deps: ExportAllDeps, options: ExportAllOptions): Promise<void> {
  const {documentRepository, issueRepository, logger, projectRepository, wikiRepository} = deps
  const {apiKey, domain, issueKeyFileName, issueKeyFolder, maxCount, outputRoot, projectIdOrKey, targets} = options

  await ensureDirectory(outputRoot)

  const projectId = await projectRepository.resolveProjectId(projectIdOrKey)
  logger.log(`プロジェクトID: ${projectId} を使用します`)

  if (targets.includes('issues')) {
    const issueOutput = path.join(outputRoot, 'issues')
    await ensureDirectory(issueOutput)

    await updateSettings(issueOutput, {
      apiKey,
      domain,
      folderType: FolderType.ISSUE,
      issueKeyFileName,
      issueKeyFolder,
      outputDir: issueOutput,
      projectIdOrKey,
    })

    logger.log('課題の取得を開始します...')
    await exportIssues(
      {issueRepository, logger},
      {
        count: maxCount,
        domain,
        issueKeyFileName,
        issueKeyFolder,
        outputDir: issueOutput,
        projectId,
      },
    )

    await updateSettings(issueOutput, {lastUpdated: new Date().toISOString()})
    logger.log('課題の取得が完了しました')
  }

  if (targets.includes('wiki')) {
    const wikiOutput = path.join(outputRoot, 'wiki')
    await ensureDirectory(wikiOutput)

    await updateSettings(wikiOutput, {
      apiKey,
      domain,
      folderType: FolderType.WIKI,
      outputDir: wikiOutput,
      projectIdOrKey,
    })

    logger.log('Wikiの取得を開始します...')
    await exportWikis(
      {logger, wikiRepository},
      {
        domain,
        outputDir: wikiOutput,
        projectIdOrKey,
      },
    )

    await updateSettings(wikiOutput, {lastUpdated: new Date().toISOString()})
    logger.log('Wikiの取得が完了しました')
  }

  if (targets.includes('documents')) {
    const documentOutput = path.join(outputRoot, 'documents')
    await ensureDirectory(documentOutput)

    await updateSettings(documentOutput, {
      apiKey,
      domain,
      folderType: FolderType.DOCUMENT,
      outputDir: documentOutput,
      projectIdOrKey,
    })

    logger.log('ドキュメントの取得を開始します...')
    await exportDocuments(
      {documentRepository, logger},
      {
        domain,
        outputDir: documentOutput,
        projectId,
        projectIdOrKey,
      },
    )

    await updateSettings(documentOutput, {lastUpdated: new Date().toISOString()})
    logger.log('ドキュメントの取得が完了しました')
  }

  logger.log('すべてのデータの取得が完了しました！')
}
