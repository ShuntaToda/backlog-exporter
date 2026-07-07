import path from 'node:path'

import {DocumentNode} from '../domain/document.js'
import {PARENT_DOCUMENT_INDEX_FILENAME, sanitizeFileName} from '../domain/file-naming.js'
import {buildDocumentMarkdown} from '../domain/markdown/document-markdown.js'
import {fetchDocumentDetail, fetchDocumentTree} from '../infrastructure/backlog/document-api.js'
import {BacklogHttpClient} from '../infrastructure/backlog/http-client.js'
import {writeProgress} from '../infrastructure/console/progress.js'
import {deleteFile, ensureDirectory, fileExists, writeMarkdownFile} from '../infrastructure/storage/markdown-store.js'
import {appendLog} from '../infrastructure/storage/update-log.js'
import {Logger} from './ports.js'

export interface ExportDocumentsOptions {
  /** 指定時は該当ドキュメントのみを取得する */
  documentIds?: string[]
  domain: string
  keyword?: string
  lastUpdated?: string
  outputDir: string
  projectId: number
  projectIdOrKey: string
}

/**
 * Backlogからドキュメントを取得し、ツリー構造を保持してMarkdownファイルとして保存する。
 * 子を持つ親ドキュメント自身の本文は、フォルダ内の PARENT_DOCUMENT_INDEX_FILENAME として保存する。
 */
export async function exportDocuments(
  client: BacklogHttpClient,
  logger: Logger,
  options: ExportDocumentsOptions,
): Promise<void> {
  logger.log('ドキュメントの取得を開始します...')

  logger.log('ドキュメントツリーを取得しています...')
  const documentTree = await fetchDocumentTree(client, options.projectId)

  logger.log('アクティブなドキュメントツリーを処理します...')

  // ツリー構造をトラバースして、各ドキュメントの詳細を取得・保存
  const processedDocuments: string[] = []

  // この実行中に書き込んだファイルパス（親indexと「00_index」というタイトルの子ドキュメントの衝突検出用）
  const writtenFiles = new Set<string>()

  /**
   * ドキュメントの詳細を取得してMarkdownファイルとして保存する
   * @param node ドキュメントノード
   * @param currentPath 保存先の相対パス
   * @param asParentIndex 子を持つ親ドキュメント自身の本文として PARENT_DOCUMENT_INDEX_FILENAME で保存する。
   *                      本文が空の場合はファイルを作成せず、過去の実行で作成した親indexが残っていれば削除する
   */
  const fetchAndSaveDocument = async (node: DocumentNode, currentPath: string, asParentIndex = false): Promise<void> => {
    try {
      // 既に処理済みのドキュメントはスキップ
      if (processedDocuments.includes(node.id)) {
        return
      }

      // ドキュメントID指定時は該当ドキュメントのみを取得する（フォルダ階層はツリーをたどって維持する）
      if (options.documentIds && options.documentIds.length > 0 && !options.documentIds.includes(node.id)) {
        return
      }

      processedDocuments.push(node.id)

      writeProgress(`ドキュメント「${node.name}」を処理中...`)

      const documentDetail = await fetchDocumentDetail(client, node.id)

      // ファイルパスを構築（親indexは固定名、それ以外は title 基準）
      const documentFileName = asParentIndex
        ? PARENT_DOCUMENT_INDEX_FILENAME
        : `${sanitizeFileName(documentDetail.title)}.md`
      const documentFilePath = path.join(options.outputDir, currentPath, documentFileName)

      // 「00_index」というタイトルの子ドキュメントが同名ファイルを先に書き込んでいる場合は、上書きせずスキップする
      if (asParentIndex && writtenFiles.has(documentFilePath)) {
        logger.warn(
          `「${node.name}」内に「${PARENT_DOCUMENT_INDEX_FILENAME}」と同名になる子ドキュメントが存在するため、親ドキュメント本文の保存をスキップしました`,
        )
        return
      }

      const parentIndexExists = asParentIndex && (await fileExists(documentFilePath))

      // 前回の更新日時チェック
      // （親indexがまだ存在しない場合は、未更新でも作成する＝この機能の追加前にエクスポートした親のバックフィル）
      if (options.lastUpdated && !(asParentIndex && !parentIndexExists)) {
        const lastUpdatedDate = new Date(options.lastUpdated)
        const documentUpdatedDate = new Date(documentDetail.updated)
        if (documentUpdatedDate <= lastUpdatedDate) {
          return // 更新が必要ない場合はスキップ
        }
      }

      // 本文が空のドキュメント（フォルダ用途の親）はファイルを作成しない。
      // 過去の実行で作成した親indexが残っている場合は、本文が空に変更されたということなので削除する
      if (asParentIndex && !documentDetail.plain?.trim()) {
        if (parentIndexExists) {
          await deleteFile(documentFilePath)
          await appendLog(
            options.outputDir,
            `ドキュメント「${documentDetail.title}」の本文が空になったため ${PARENT_DOCUMENT_INDEX_FILENAME} を削除しました`,
          )
        }

        return
      }

      // Backlogのドキュメントへのリンクを作成
      const backlogDocumentUrl = `https://${options.domain}/document/${options.projectIdOrKey}/${node.id}`

      const markdownContent = buildDocumentMarkdown(documentDetail, backlogDocumentUrl)

      await writeMarkdownFile(documentFilePath, markdownContent)
      writtenFiles.add(documentFilePath)

      await appendLog(options.outputDir, `ドキュメント「${documentDetail.title}」を更新しました: ${backlogDocumentUrl}`)
    } catch (error) {
      logger.warn(
        `ドキュメント ${node.name} の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * ドキュメントノードを再帰的に処理する
   */
  const processDocumentNode = async (node: DocumentNode, currentPath: string): Promise<void> => {
    if (node.children && node.children.length > 0) {
      // 子を持つ場合はフォルダを作成して子ノードを処理
      const folderRelPath = path.join(currentPath, sanitizeFileName(node.name))
      await ensureDirectory(path.join(options.outputDir, folderRelPath))

      for (const child of node.children) {
        // eslint-disable-next-line no-await-in-loop
        await processDocumentNode(child, folderRelPath)
      }

      // Backlogのドキュメントは子を持ちながら自身の本文も持てるため、親自身の内容も取得する。
      // 親本文はフォルダ「内」に PARENT_DOCUMENT_INDEX_FILENAME として保存し、フォルダとファイルが
      // エディタのエクスプローラ上で離れて表示される問題を防ぐ（数字プレフィックスで常に先頭に表示される）。
      await fetchAndSaveDocument(node, folderRelPath, true)
    } else {
      // 子を持たない場合はドキュメントとして保存
      await fetchAndSaveDocument(node, currentPath)
    }
  }

  // アクティブツリーのルートから処理開始
  if (documentTree.activeTree.children && documentTree.activeTree.children.length > 0) {
    for (const rootNode of documentTree.activeTree.children) {
      // eslint-disable-next-line no-await-in-loop
      await processDocumentNode(rootNode, '')
    }
  }

  logger.log(`\n合計 ${processedDocuments.length}件のドキュメントが処理されました。`)
  logger.log('ドキュメントのダウンロードが完了しました！')
}
