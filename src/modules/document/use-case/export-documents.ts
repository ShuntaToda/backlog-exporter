import path from 'node:path'

import {writeProgress} from '../../../shared/console/progress.js'
import {Logger} from '../../../shared/ports.js'
import {
  deleteFile,
  ensureDirectory,
  fileExists,
  fileSize,
  writeBinaryFile,
  writeMarkdownFile,
} from '../../../shared/storage/markdown-store.js'
import {appendLog} from '../../../shared/storage/update-log.js'
import {buildDocumentMarkdown} from '../domain/document-markdown.js'
import {
  documentAttachmentMarkdownLink,
  documentAttachmentRelativePath,
  documentFileName,
  documentFolderPath,
  documentUrl,
  PARENT_DOCUMENT_INDEX_FILENAME,
} from '../domain/document-path.js'
import {DocumentRepository} from '../domain/document-repository.js'
import {planDocumentSave} from '../domain/document-save-plan.js'
import {DocumentDetail, DocumentNode} from '../domain/document.js'

export interface ExportDocumentsDeps {
  documentRepository: DocumentRepository
  logger: Logger
}

export interface ExportDocumentsOptions {
  documentIds?: string[]
  domain: string
  downloadAttachments?: boolean
  keyword?: string
  lastUpdated?: string
  outputDir: string
  projectId: number
  projectIdOrKey: string
}

export async function exportDocuments(deps: ExportDocumentsDeps, options: ExportDocumentsOptions): Promise<void> {
  const {documentRepository, logger} = deps
  logger.log('ドキュメントの取得を開始します...')

  logger.log('ドキュメントツリーを取得しています...')
  const documentTree = await documentRepository.fetchTree(options.projectId)

  logger.log('アクティブなドキュメントツリーを処理します...')

  const processedDocuments: string[] = []
  const writtenFiles = new Set<string>()

  const fetchAndSaveDocument = async (
    node: DocumentNode,
    currentPath: string,
    asParentIndex = false,
  ): Promise<void> => {
    try {
      if (processedDocuments.includes(node.id)) {
        return
      }

      if (options.documentIds && options.documentIds.length > 0 && !options.documentIds.includes(node.id)) {
        return
      }

      processedDocuments.push(node.id)

      writeProgress(`ドキュメント「${node.name}」を処理中...`)

      const documentDetail = await documentRepository.fetchDetail(node.id)

      const fileName = documentFileName(documentDetail.title, asParentIndex)
      const filePath = path.join(options.outputDir, currentPath, fileName)

      const action = planDocumentSave({
        asParentIndex,
        body: documentDetail.plain,
        lastUpdated: options.lastUpdated,
        parentIndexAlreadyWrittenThisRun: writtenFiles.has(filePath),
        parentIndexExists: asParentIndex && (await fileExists(filePath)),
        updated: documentDetail.updated,
      })

      switch (action) {
        case 'delete-stale-parent-index': {
          await deleteFile(filePath)
          await appendLog(
            options.outputDir,
            `ドキュメント「${documentDetail.title}」の本文が空になったため ${PARENT_DOCUMENT_INDEX_FILENAME} を削除しました`,
          )

          break
        }

        case 'save': {
          const backlogDocumentUrl = documentUrl(options.domain, options.projectIdOrKey, node.id)
          const attachmentLinks = options.downloadAttachments
            ? await downloadDocumentAttachments(deps, documentDetail, currentPath, options.outputDir)
            : undefined
          await writeMarkdownFile(filePath, buildDocumentMarkdown(documentDetail, backlogDocumentUrl, attachmentLinks))
          writtenFiles.add(filePath)
          await appendLog(
            options.outputDir,
            `ドキュメント「${documentDetail.title}」を更新しました: ${backlogDocumentUrl}`,
          )

          break
        }

        case 'skip-parent-index-collision': {
          logger.warn(
            `「${node.name}」内に「${PARENT_DOCUMENT_INDEX_FILENAME}」と同名になる子ドキュメントが存在するため、親ドキュメント本文の保存をスキップしました`,
          )

          break
        }
        // No default
      }
    } catch (error) {
      logger.warn(
        `ドキュメント ${node.name} の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /* eslint-disable no-await-in-loop */
  const processDocumentNode = async (node: DocumentNode, currentPath: string): Promise<void> => {
    if (node.children && node.children.length > 0) {
      const folderRelPath = documentFolderPath(currentPath, node.name)
      await ensureDirectory(path.join(options.outputDir, folderRelPath))

      for (const child of node.children) {
        await processDocumentNode(child, folderRelPath)
      }

      // 親自身の本文はフォルダ内の親indexとして子の後に保存する
      await fetchAndSaveDocument(node, folderRelPath, true)
    } else {
      await fetchAndSaveDocument(node, currentPath)
    }
  }

  for (const rootNode of documentTree.activeTree.children ?? []) {
    await processDocumentNode(rootNode, '')
  }
  /* eslint-enable no-await-in-loop */

  logger.log(`\n合計 ${processedDocuments.length}件のドキュメントが処理されました。`)
  logger.log('ドキュメントのダウンロードが完了しました！')
}

// 保存できた添付のみリンク化する。個々の失敗は警告に留め、ドキュメント本体の保存は続行する
async function downloadDocumentAttachments(
  deps: ExportDocumentsDeps,
  documentDetail: DocumentDetail,
  currentPath: string,
  outputDir: string,
): Promise<Map<number, string>> {
  const links = new Map<number, string>()

  for (const attachment of documentDetail.attachments ?? []) {
    const absolutePath = path.join(
      outputDir,
      documentAttachmentRelativePath(currentPath, documentDetail.title, attachment),
    )
    try {
      // 添付IDは不変のため、サイズの一致するファイルが既にあれば再ダウンロードしない
      // eslint-disable-next-line no-await-in-loop
      if ((await fileSize(absolutePath)) !== attachment.size) {
        // eslint-disable-next-line no-await-in-loop
        const data = await deps.documentRepository.downloadAttachment(documentDetail.id, attachment.id)
        // eslint-disable-next-line no-await-in-loop
        await writeBinaryFile(absolutePath, data)
      }

      links.set(attachment.id, documentAttachmentMarkdownLink(documentDetail.title, attachment))
    } catch (error) {
      deps.logger.warn(
        `ドキュメント「${documentDetail.title}」の添付ファイル「${attachment.name}」の取得に失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  return links
}
