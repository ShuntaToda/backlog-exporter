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
  DOCUMENT_FALLBACK_PARENT_PATH,
  documentAttachmentMarkdownLink,
  documentAttachmentRelativePath,
  documentFileName,
  documentFolderPath,
  documentUrl,
  PARENT_DOCUMENT_INDEX_FILENAME,
} from '../domain/document-path.js'
import {DocumentRepository} from '../domain/document-repository.js'
import {planDocumentSave} from '../domain/document-save-plan.js'
import {findDocumentsMissingFromTree} from '../domain/document-tree-gap.js'
import {DocumentDetail, DocumentNode, DocumentSummary, DocumentTree} from '../domain/document.js'

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

  // 戻り値はファイルを書き出したかどうか（保存件数の集計に使う）
  const fetchAndSaveDocument = async (
    node: DocumentNode,
    currentPath: string,
    placement: {asParentIndex?: boolean; missingFromTree?: boolean} = {},
  ): Promise<boolean> => {
    const asParentIndex = placement.asParentIndex ?? false
    try {
      if (processedDocuments.includes(node.id)) {
        return false
      }

      if (options.documentIds && options.documentIds.length > 0 && !options.documentIds.includes(node.id)) {
        return false
      }

      processedDocuments.push(node.id)

      writeProgress(`ドキュメント「${node.name}」を処理中...`)

      const documentDetail = await documentRepository.fetchDetail(node.id)

      const fileName = documentFileName(documentDetail.title, asParentIndex)
      const filePath = path.join(options.outputDir, currentPath, fileName)

      const action = planDocumentSave({
        alreadyWrittenThisRun: writtenFiles.has(filePath),
        asParentIndex,
        body: documentDetail.plain,
        fileExists: await fileExists(filePath),
        lastUpdated: options.lastUpdated,
        missingFromTree: placement.missingFromTree ?? false,
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

          return true
        }

        case 'skip-fallback-collision': {
          logger.warn(
            `ツリーに現れないドキュメント「${documentDetail.title}」は、同名のファイルを既に出力しているため保存をスキップしました`,
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

    return false
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
      await fetchAndSaveDocument(node, folderRelPath, {asParentIndex: true})
    } else {
      await fetchAndSaveDocument(node, currentPath)
    }
  }

  for (const rootNode of documentTree.activeTree.children ?? []) {
    await processDocumentNode(rootNode, '')
  }

  const missingFromTree = await findDocumentsOutsideTree(deps, documentTree, options, processedDocuments)
  let savedMissingFromTree = 0
  for (const document of missingFromTree) {
    const saved = await fetchAndSaveDocument(
      {children: [], id: document.id, name: document.title},
      DOCUMENT_FALLBACK_PARENT_PATH,
      {missingFromTree: true},
    )
    if (saved) {
      savedMissingFromTree++
    }
  }
  /* eslint-enable no-await-in-loop */

  // 検出件数ではなく実際に保存した件数を出す（未更新でスキップした分まで毎回報告しないため）
  if (savedMissingFromTree > 0) {
    logger.log(`ツリーに現れないドキュメント${savedMissingFromTree}件を出力ルート直下に保存しました`)
  }

  logger.log(`\n合計 ${processedDocuments.length}件のドキュメントが処理されました。`)
  logger.log('ドキュメントのダウンロードが完了しました！')
}

// ツリーに現れないドキュメントを一覧API（全件が載る）との差分から求める。
// 一覧の取得に失敗しても従来どおりツリー分のエクスポートは成立させるため、警告に留めて空を返す
async function findDocumentsOutsideTree(
  deps: ExportDocumentsDeps,
  documentTree: DocumentTree,
  options: ExportDocumentsOptions,
  processedDocuments: string[],
): Promise<DocumentSummary[]> {
  // ID指定の取得で対象がすべてツリー内に見つかっている場合は、一覧APIを呼ぶ必要がない
  const targetedIds = options.documentIds && options.documentIds.length > 0 ? options.documentIds : undefined
  if (targetedIds?.every((id) => processedDocuments.includes(id))) {
    return []
  }

  try {
    const titlesById = await deps.documentRepository.fetchAllTitles(options.projectId)
    return findDocumentsMissingFromTree(documentTree, titlesById)
  } catch (error) {
    deps.logger.warn(
      `ドキュメント一覧の取得に失敗したため、ツリーに現れないドキュメントの確認をスキップします: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    return []
  }
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
