import path from 'node:path'

import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {Logger} from '../../../shared/ports.js'
import {ensureDirectory} from '../../../shared/storage/markdown-store.js'
import {exportDocuments} from '../../document/use-case/export-documents.js'
import {exportIssues} from '../../issue/use-case/export-issues.js'
import {validateAndGetProjectId} from '../../project/repository/project-api.js'
import {FolderType} from '../../settings/domain/settings.js'
import {updateSettings} from '../../settings/repository/settings-store.js'
import {exportWikis} from '../../wiki/use-case/export-wikis.js'

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

export async function exportAll(client: BacklogHttpClient, logger: Logger, options: ExportAllOptions): Promise<void> {
  const {apiKey, domain, issueKeyFileName, issueKeyFolder, maxCount, outputRoot, projectIdOrKey, targets} = options

  await ensureDirectory(outputRoot)

  const projectId = await validateAndGetProjectId(client, projectIdOrKey)
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
    await exportIssues(client, logger, {
      count: maxCount,
      domain,
      issueKeyFileName,
      issueKeyFolder,
      outputDir: issueOutput,
      projectId,
    })

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
    await exportWikis(client, logger, {
      domain,
      outputDir: wikiOutput,
      projectIdOrKey,
    })

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
    await exportDocuments(client, logger, {
      domain,
      outputDir: documentOutput,
      projectId,
      projectIdOrKey,
    })

    await updateSettings(documentOutput, {lastUpdated: new Date().toISOString()})
    logger.log('ドキュメントの取得が完了しました')
  }

  logger.log('すべてのデータの取得が完了しました！')
}
