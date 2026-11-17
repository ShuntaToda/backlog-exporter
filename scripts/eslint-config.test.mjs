// eslint.config.mjs が、決めた場所に決めたルールを掛けているかを確かめる。
// flat config は後の設定が前のルールの options を丸ごと置き換えるので、足した決まりが oclif の分を消す・別の場所の決まりを消す誤りをここで見つける
import {ESLint} from 'eslint'
import path from 'node:path'
import {describe, expect, test} from 'vitest'

const root = path.resolve(import.meta.dirname, '..')
const eslint = new ESLint({cwd: root})

/** 実在しないファイルでも lint する（import/no-cycle は実在のファイルを要るので、置き場にある実在のファイル名を使う） */
const lintText = async (filePath, code) => {
  const [result] = await eslint.lintText(code, {filePath: path.join(root, filePath)})
  return result.messages.map((message) => `${message.ruleId}: ${message.message}`).join('\n')
}

const domainFile = 'src/modules/wiki/domain/wiki-filter.ts'
const useCaseFile = 'src/modules/wiki/use-case/export-wikis.ts'
const repositoryFile = 'src/modules/wiki/repository/backlog-wiki-repository.ts'
const sharedFile = 'src/shared/file-name.ts'

describe('層の import の向き', () => {
  test.each([
    [
      domainFile,
      "import {exportWikis} from '../use-case/export-wikis.js'\nexport const a = exportWikis\n",
      /domain から use-case/,
    ],
    [
      domainFile,
      "import {newBacklogWikiRepository} from '../repository/backlog-wiki-repository.js'\nexport const a = newBacklogWikiRepository\n",
      /domain は入出力/,
    ],
    [
      domainFile,
      "import {writeMarkdownFile} from '../../../shared/storage/markdown-store.js'\nexport const a = writeMarkdownFile\n",
      /domain は入出力/,
    ],
    [
      repositoryFile,
      "import {exportWikis} from '../use-case/export-wikis.js'\nexport const a = exportWikis\n",
      /repository から use-case/,
    ],
    [
      sharedFile,
      "import {exportWikis} from '../modules/wiki/use-case/export-wikis.js'\nexport const a = exportWikis\n",
      /shared は modules を知りません/,
    ],
    [
      useCaseFile,
      "import {createBacklogRepositories} from '../../../composition/backlog-repositories.js'\nexport const a = createBacklogRepositories\n",
      /最外殻/,
    ],
    [
      repositoryFile,
      "import {startMockServer} from '../../../shared/testing/backlog-mock-server.js'\nexport const a = startMockServer\n",
      /テスト用/,
    ],
  ])('[異常系]%s で逆向きの import を落とす', async (file, code, expected) => {
    expect(await lintText(file, code)).toMatch(expected)
  })

  test('[正常系]use-case から domain・repository・shared は import できる', async () => {
    const messages = await lintText(
      useCaseFile,
      "import {writeMarkdownFile} from '../../../shared/storage/markdown-store.js'\nimport {selectWikisToExport} from '../domain/wiki-filter.js'\nimport {newBacklogWikiRepository} from '../repository/backlog-wiki-repository.js'\n\nexport const a = [writeMarkdownFile, selectWikisToExport, newBacklogWikiRepository]\n",
    )
    expect(messages).not.toMatch(/no-restricted-paths/)
  })

  test('[正常系]テストは composition を import できる', async () => {
    expect(
      await lintText(
        'src/modules/wiki/use-case/export-wikis.test.ts',
        "import {createBacklogRepositories} from '../../../composition/backlog-repositories.js'\n\nexport const a = createBacklogRepositories\n",
      ),
    ).not.toMatch(/no-restricted-paths/)
  })
})

describe('置き場の決まり', () => {
  test.each([
    [
      useCaseFile,
      "import {Flags} from '@oclif/core'\n\nexport const a = Flags\n",
      /oclif（@oclif\/\*）を import できるのは/,
    ],
    [
      domainFile,
      "import {Flags} from '@oclif/core'\n\nexport const a = Flags\n",
      /oclif（@oclif\/\*）を import できるのは/,
    ],
    [domainFile, "import fs from 'node:fs'\n\nexport const a = fs\n", /node:path 以外/],
    [domainFile, 'export const a = new Date()\n', /今の時刻/],
    [domainFile, 'export const a = Date.now()\n', /今の時刻/],
    [domainFile, 'export const a = Math.random()\n', /乱数/],
    [useCaseFile, 'export const a = process.env.X\n', /src\/shared\/config だけ/],
    [useCaseFile, "export const a = fetch('https://example.backlog.jp')\n", /BacklogHttpClient/],
    [useCaseFile, "console.log('a')\n", /no-console/],
    [useCaseFile, 'export const a = (1 as unknown as string)\n', /二重のアサーション/],
    [domainFile, 'export const a = (1 as unknown as string)\n', /二重のアサーション/],
    [useCaseFile, 'export const f = (a?: string) => a!\n', /no-non-null-assertion/],
  ])('[異常系]%s: %s', async (file, code, expected) => {
    expect(await lintText(file, code)).toMatch(expected)
  })

  test.each([
    ['src/shared/config/env.ts', 'export const a = process.env.X\n'],
    ['src/shared/backlog/http-client.ts', "export const a = fetch('https://example.backlog.jp')\n"],
    ['src/commands/wiki/index.ts', "import {Flags} from '@oclif/core'\n\nexport const a = Flags\n"],
    [domainFile, "import path from 'node:path'\n\nexport const a = path.join('a', 'b')\n"],
    [useCaseFile, 'export const a = new Date()\n'],
  ])('[正常系]%s では使える', async (file, code) => {
    expect(await lintText(file, code)).not.toMatch(/no-restricted|no-console/)
  })
})

describe('oclif の決まりを消していない', () => {
  test.each([domainFile, useCaseFile, sharedFile])(
    '[正常系]%s でも、oclif が禁じる import・グローバルを落とす',
    async (file) => {
      expect(await lintText(file, "import qs from 'querystring'\n\nexport const a = qs\n")).toMatch(
        /no-restricted-imports/,
      )
      expect(await lintText(file, "export const a = atob('a')\n")).toMatch(/no-restricted-globals/)
    },
  )
})

describe('disable のコメント', () => {
  test.each([
    [
      '構造のルール',
      '// eslint-disable-next-line import/no-restricted-paths\nexport const a = 1\n',
      /no-restricted-disable/,
    ],
    ['ルールを書かない disable', '/* eslint-disable */\nexport const a = 1\n', /no-unlimited-disable/],
  ])('[異常系]%s は外せない', async (_, code, expected) => {
    expect(await lintText(useCaseFile, code)).toMatch(expected)
  })
})
