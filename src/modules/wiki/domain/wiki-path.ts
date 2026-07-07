import path from 'node:path'

import {backlogOrigin} from '../../../shared/backlog-url.js'
import {sanitizeWikiFileName} from '../../../shared/file-name.js'
import {ExpectedPaths} from '../../prune/domain/expected-paths.js'

export function wikiRelativePath(wikiName: string): string {
  return `${sanitizeWikiFileName(wikiName)}.md`
}

export function wikiUrl(domain: string, wikiId: string): string {
  return `${backlogOrigin(domain)}/alias/wiki/${wikiId}`
}

// 比較相手のpath.relativeはOS標準の区切り文字を返すため、path.normalizeで揃える（Windows対策）
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
