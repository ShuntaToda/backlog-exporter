import path from 'node:path'

import {DocumentNode} from './document.js'

/**
 * 子を持つ親ドキュメント自身の本文を保存するファイル名。
 * 数字プレフィックスによりエクスプローラ上でフォルダ内の先頭に表示される。
 * ダウンロード側とprune側でレイアウトの定義を共有する。
 */
export const PARENT_DOCUMENT_INDEX_FILENAME = '00_index.md'

/**
 * ファイル名に使用できない文字を置換する
 * @param name 元のファイル名
 * @returns サニタイズされたファイル名
 */
export function sanitizeFileName(name: string): string {
  return name
    .replaceAll(/[\\/:*?"<>|]/g, '_') // Windowsで使用できない文字を置換
    .replaceAll(/\s+/g, '_') // スペースをアンダースコアに置換
    .replaceAll('.', '_') // ドットを置換
    .slice(0, 200) // 長すぎるファイル名を防ぐために200文字に制限
}

/**
 * Wikiファイル名のサニタイズ（スラッシュはディレクトリ区切りとして使用するため残す）
 * @param name 元のWiki名
 * @returns サニタイズされたWikiファイル名
 */
export function sanitizeWikiFileName(name: string): string {
  const invalidChars = ['\\', ':', '*', '?', '"', '<', '>', '|']
  let sanitizedName = name
  for (const char of invalidChars) {
    sanitizedName = sanitizedName.replaceAll(char, '_')
  }

  return sanitizedName
}

/**
 * 課題のMarkdownファイル名を決定する
 */
export function issueFileName(issue: {issueKey: string; summary: string}, useIssueKey: boolean): string {
  return useIssueKey ? `${issue.issueKey}.md` : `${sanitizeFileName(issue.summary)}.md`
}

/**
 * 課題の保存先相対ディレクトリを決定する（作成年ごと。issueKeyFolder指定時はさらに課題キーのフォルダ）
 */
export function issueRelativeDir(issue: {created: string; issueKey: string}, useIssueKeyFolder: boolean): string {
  const createdYear = new Date(issue.created).getFullYear().toString()
  return useIssueKeyFolder ? path.join(createdYear, issue.issueKey) : createdYear
}

/**
 * Wikiの保存先相対パスを決定する（"親/子" のようなWiki名は "/" がディレクトリ区切りとして扱われる）
 */
export function wikiRelativePath(wikiName: string): string {
  return `${sanitizeWikiFileName(wikiName)}.md`
}

/**
 * prune用の期待パス集合。
 * Backlog上に「あるべき」ファイル・ディレクトリの相対パス集合（NFCに正規化済み）。
 */
export interface ExpectedPaths {
  expectedDirs: Set<string>
  expectedFiles: Set<string>
}

/**
 * ドキュメントツリーの中間結果: フォルダ由来の期待パスと、タイトル解決が必要なリーフノード
 */
export interface DocumentTreePaths extends ExpectedPaths {
  leafNodes: Array<{currentPath: string; id: string; name: string}>
}

/**
 * ドキュメントツリーからprune用の期待パス集合を構築する。
 *
 * フォルダは保存時と同じく name をサニタイズしたものをディレクトリ名にする。
 * 子を持つ親ドキュメント自身の本文はフォルダ内の PARENT_DOCUMENT_INDEX_FILENAME に
 * 保存されるため、削除対象から保護する。
 * リーフ（ドキュメント）のファイル名は保存時に title から作られるため、
 * ここでは収集のみ行い、タイトル解決後に resolveDocumentLeafPaths で確定する。
 */
export function collectDocumentTreePaths(rootNodes: DocumentNode[]): DocumentTreePaths {
  const expectedFiles = new Set<string>()
  const expectedDirs = new Set<string>()
  const leafNodes: Array<{currentPath: string; id: string; name: string}> = []

  const walk = (node: DocumentNode, currentPath: string): void => {
    if (node.children && node.children.length > 0) {
      const dirPath = path.join(currentPath, sanitizeFileName(node.name)).normalize('NFC')
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

/**
 * タイトル解決済みのリーフノードを期待パス集合へ反映する。
 *
 * 子を持たない空フォルダはツリー上でリーフと区別できず、ドキュメント一覧にも現れない。
 * その場合はBacklog上に存在するフォルダとして扱い、対応する空ディレクトリを誤削除しないようにする。
 * 万一ドキュメントでありながら一覧に現れない場合にも備え、ツリーの name 由来のファイルも保護しておく。
 */
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

/**
 * Wiki一覧からprune用の期待パス集合を構築する。
 *
 * Wikiのファイル名は保存時に一覧APIの name をサニタイズしたものを使う（"/" はディレクトリ区切りとして残る）。
 * 比較相手の path.relative はOS標準の区切り文字を返すため、path.normalize で揃える（Windows対策）。
 */
export function buildWikiExpectedPaths(wikiNames: string[]): ExpectedPaths {
  const expectedFiles = new Set<string>()
  const expectedDirs = new Set<string>()

  for (const name of wikiNames) {
    const relativePath = path.normalize(wikiRelativePath(name)).normalize('NFC')
    expectedFiles.add(relativePath)

    // "親/子.md" のような名前では親ディレクトリも「あるべきディレクトリ」として登録する
    let dir = path.dirname(relativePath)
    while (dir && dir !== '.') {
      expectedDirs.add(dir.normalize('NFC'))
      dir = path.dirname(dir)
    }
  }

  return {expectedDirs, expectedFiles}
}
