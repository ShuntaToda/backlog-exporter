import {spawnSync} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {describe, expect, test} from 'vitest'

import {needsTypecheck} from './check-on-stop.mjs'
import {clip, lintProblemsOf, lintTargetOf, parseStatus, runTool} from './hook-util.mjs'

const root = path.resolve(import.meta.dirname, '../..')

// hook の入力の名前（tool_input・file_path・stop_hook_active）は Claude Code が決めたもの。camelcase に掛からないよう JSON の文字列で書く
const editInput = (filePath) => `{"tool_input":{"file_path":${JSON.stringify(filePath)}}}`

describe('lintTargetOf', () => {
  test.each([
    ['src/modules/wiki/use-case/export-wikis.ts', {eslint: true, file: 'src/modules/wiki/use-case/export-wikis.ts'}],
    [path.join(root, 'src/index.ts'), {eslint: true, file: 'src/index.ts'}],
    ['e2e/helpers.ts', {eslint: true, file: 'e2e/helpers.ts'}],
    ['scripts/check-commit-message.mjs', {eslint: true, file: 'scripts/check-commit-message.mjs'}],
    ['.claude/hooks/hook-util.mjs', {eslint: true, file: '.claude/hooks/hook-util.mjs'}],
    ['eslint.config.mjs', {eslint: true, file: 'eslint.config.mjs'}],
    ['vitest.config.ts', {eslint: true, file: 'vitest.config.ts'}],
    // 整形だけを確かめるもの
    ['docs/development.md', {eslint: false, file: 'docs/development.md'}],
    ['package.json', {eslint: false, file: 'package.json'}],
  ])('[正常系]%s は確かめる', (file, expected) => {
    expect(lintTargetOf(file, root)).toStrictEqual(expected)
  })

  test.each([
    'dist/index.js',
    'node_modules/x/index.ts',
    'oclif.manifest.json',
    'bin/run.js',
    '/etc/hosts',
    '../outside.ts',
    'LICENSE',
    '',
    undefined,
  ])('[正常系]%s は確かめない', (file) => {
    expect(lintTargetOf(file, root)).toBeNull()
  })
})

describe('lintTargetOf（リンク越し）', () => {
  // Windows ではシンボリックリンクを作るのに権限が要る
  test.skipIf(process.platform === 'win32')(
    '[正常系]リンク越しに開いた根でも、根の中のファイルは確かめ、根の外を指すリンクは確かめない',
    () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-util-'))
      try {
        const linkedRoot = path.join(dir, 'linked-root')
        fs.symlinkSync(root, linkedRoot)

        expect(lintTargetOf(path.join(root, 'src/index.ts'), linkedRoot)).toStrictEqual({
          eslint: true,
          file: 'src/index.ts',
        })
        expect(lintTargetOf(path.join(linkedRoot, 'src/index.ts'), root)).toStrictEqual({
          eslint: true,
          file: 'src/index.ts',
        })

        const realRoot = path.join(dir, 'real-root')
        fs.mkdirSync(path.join(realRoot, 'src'), {recursive: true})
        fs.writeFileSync(path.join(dir, 'outside.ts'), '')
        fs.symlinkSync(path.join(dir, 'outside.ts'), path.join(realRoot, 'src/inside.ts'))
        expect(lintTargetOf('src/inside.ts', realRoot)).toBeNull()
      } finally {
        fs.rmSync(dir, {force: true, recursive: true})
      }
    },
  )
})

describe('parseStatus', () => {
  test('[正常系]変更・新規・名前の変更（新しい名前）を拾い、消したものと元の名前は除く', () => {
    expect(
      parseStatus(
        [' M src/a.ts', '?? src/new file.ts', 'R  src/renamed.ts', 'src/old.ts', ' D src/deleted.ts', ''].join('\0'),
      ),
    ).toStrictEqual(['src/a.ts', 'src/new file.ts', 'src/renamed.ts'])
  })
})

describe('needsTypecheck', () => {
  test.each([
    [['src/modules/wiki/domain/wiki.ts'], true],
    [['e2e/helpers.ts'], true],
    [['tsconfig.build.json'], true],
    [['README.md', 'scripts/check-commit-message.mjs'], false],
    [[], false],
  ])('[正常系]%j → %s', (files, expected) => {
    expect(needsTypecheck(files)).toBe(expected)
  })
})

describe('clip', () => {
  test('[正常系]長い出力は上限で切り、残りの行数を添える', () => {
    const output = clip(Array.from({length: 50}, (_, i) => `line ${i}`).join('\n'))

    expect(output.split('\n')).toHaveLength(41)
    expect(output).toContain('残り 10 行')
  })

  test('[境界値]上限ちょうどの行数は切らない', () => {
    const output = Array.from({length: 40}, (_, i) => `line ${i}`).join('\n')

    expect(clip(output)).toBe(output)
  })
})

/** hook を Claude Code と同じく、標準入力に JSON を渡して動かす */
const run = (script, input) =>
  spawnSync('node', [path.join(import.meta.dirname, script)], {
    encoding: 'utf8',
    input,
  })

describe('hook のスクリプト', () => {
  test('[正常系]入力が JSON でなくても、作業を止めない（終了コード 0）', () => {
    expect(run('lint-edited-file.mjs', 'not json').status).toBe(0)
  })

  test('[正常系]確かめないファイルは、何も出さずに終える', () => {
    const result = run('lint-edited-file.mjs', editInput('/etc/hosts'))

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
  })

  test('[異常系]決まりに合わないファイルは、終了コード 2 で直し方を返す', () => {
    const file = 'scripts/zz-hook-probe.mjs'
    fs.writeFileSync(path.join(root, file), 'export const a = {b:1};\n')
    try {
      const result = run('lint-edited-file.mjs', editInput(path.join(root, file)))

      expect(result.status).toBe(2)
      expect(result.stderr).toContain(`npx prettier --write -- '${file}'`)
    } finally {
      fs.rmSync(path.join(root, file))
    }
  })

  test('[正常系]同じ停止で 2 度目（stop_hook_active）は、確かめずに終える', () => {
    expect(run('check-on-stop.mjs', '{"stop_hook_active":true}').status).toBe(0)
  })
})

describe('runTool', () => {
  test('[正常系]道具を動かし、終了コードと出力を返す', () => {
    const result = runTool(root, 'prettier', ['--version'], 30_000)

    expect(result?.ok).toBe(true)
    expect(result?.output).toMatch(/^\d+\.\d+\.\d+$/)
  })

  test.each([
    ['知らない道具', 'unknown', 30_000],
    ['持ち時間が残っていない', 'prettier', 0],
  ])('[異常系]%s は、確かめられなかったとして null', (_, tool, timeoutMs) => {
    expect(runTool(root, tool, ['--version'], timeoutMs)).toBeNull()
  })

  test('[異常系]道具が入っていない根では null', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-util-'))
    try {
      expect(runTool(dir, 'eslint', ['--version'], 30_000)).toBeNull()
    } finally {
      fs.rmSync(dir, {force: true, recursive: true})
    }
  })
})

describe('lintProblemsOf', () => {
  test('[異常系]eslint の違反に、英語のメッセージの直し方を添える', () => {
    const file = 'src/modules/wiki/use-case/zz-hook-probe.ts'
    fs.writeFileSync(path.join(root, file), "console.log('a')\n")
    try {
      const problems = lintProblemsOf(root, [{eslint: true, file}], () => 60_000)

      expect(problems.join('\n')).toContain('Logger（src/shared/ports.ts）を引数で受けて')
    } finally {
      fs.rmSync(path.join(root, file))
    }
  })

  test('[正常系]決まりに合うファイルは、何も返さない', () => {
    expect(lintProblemsOf(root, [{eslint: true, file: 'src/shared/file-name.ts'}], () => 60_000)).toStrictEqual([])
  })
})
