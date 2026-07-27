import path from 'node:path'

import {attachmentFileName, encodeLinkDestination} from '../../../shared/attachment.js'
import {backlogOrigin} from '../../../shared/backlog-url.js'
import {sanitizeFileName} from '../../../shared/file-name.js'
import {ExpectedPaths} from '../../prune/domain/expected-paths.js'
import {DocumentNode} from './document.js'

// 子を持つ親ドキュメント自身の本文の保存先。ダウンロード側とprune側でレイアウト定義を共有する
export const PARENT_DOCUMENT_INDEX_FILENAME = '00_index.md'

export function documentFolderPath(currentPath: string, folderName: string): string {
  return path.join(currentPath, sanitizeFileName(folderName))
}

export function documentFileName(title: string, asParentIndex: boolean): string {
  return asParentIndex ? PARENT_DOCUMENT_INDEX_FILENAME : `${sanitizeFileName(title)}.md`
}

export function documentUrl(domain: string, projectIdOrKey: string, documentId: string): string {
  return `${backlogOrigin(domain)}/document/${projectIdOrKey}/${documentId}`
}

// 添付の保存先はMarkdownと同じディレクトリの attachments/{ドキュメント名}/ 配下。
// タイトル改名時は再ダウンロードになるが、Markdown本体（{タイトル}.md）と同じ挙動で閲覧性を優先する
export function documentAttachmentRelativePath(
  currentPath: string,
  documentTitle: string,
  attachment: {id: number; name: string},
): string {
  return path.join(currentPath, 'attachments', sanitizeFileName(documentTitle), attachmentFileName(attachment))
}

export function documentAttachmentMarkdownLink(documentTitle: string, attachment: {id: number; name: string}): string {
  return encodeLinkDestination(
    ['.', 'attachments', sanitizeFileName(documentTitle), attachmentFileName(attachment)].join('/'),
  )
}

export interface DocumentTreePaths extends ExpectedPaths {
  leafNodes: Array<{currentPath: string; id: string; name: string}>
}

export function collectDocumentTreePaths(rootNodes: DocumentNode[]): DocumentTreePaths {
  const expectedFiles = new Set<string>()
  const expectedDirs = new Set<string>()
  const leafNodes: Array<{currentPath: string; id: string; name: string}> = []

  const walk = (node: DocumentNode, currentPath: string): void => {
    if (node.children && node.children.length > 0) {
      const dirPath = documentFolderPath(currentPath, node.name).normalize('NFC')
      expectedDirs.add(dirPath)
      expectedFiles.add(path.join(dirPath, PARENT_DOCUMENT_INDEX_FILENAME).normalize('NFC'))

      for (const child of node.children) {
        walk(child, dirPath)
      }
    } else {
      leafNodes.push({currentPath, id: node.id, name: node.name})
    }
  }

  for (const rootNode of rootNodes) {
    walk(rootNode, '')
  }

  return {expectedDirs, expectedFiles, leafNodes}
}

// 一覧に現れないリーフは空フォルダの可能性があるため、ディレクトリとname由来ファイルの両方を保護する（誤削除より安全側）
export function resolveDocumentLeafPaths(paths: DocumentTreePaths, titlesById: Map<string, string>): void {
  for (const leaf of paths.leafNodes) {
    const title = titlesById.get(leaf.id)

    if (title === undefined) {
      paths.expectedDirs.add(path.join(leaf.currentPath, sanitizeFileName(leaf.name)).normalize('NFC'))
      paths.expectedFiles.add(path.join(leaf.currentPath, `${sanitizeFileName(leaf.name)}.md`).normalize('NFC'))
      continue
    }

    paths.expectedFiles.add(path.join(leaf.currentPath, `${sanitizeFileName(title)}.md`).normalize('NFC'))
  }
}
