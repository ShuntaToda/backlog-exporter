import {expect} from 'chai'
import {afterEach, beforeEach, describe, it} from 'mocha'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import {join} from 'node:path'

import {
  FolderType,
  getSettingsFilePath,
  loadSettings,
  saveSettings,
  Settings,
  updateSettings,
} from '../../src/utils/settings.js'

describe('settings.ts - 設定ファイル管理', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'backlog-settings-test-'))
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, {force: true, recursive: true})
    } catch {
      // エラーは無視
    }
  })

  describe('getSettingsFilePath', () => {
    it('正しい設定ファイルパスを返すこと', () => {
      const directory = '/test/directory'
      const expected = join(directory, 'backlog-settings.json')

      const result = getSettingsFilePath(directory)

      expect(result).to.equal(expected)
    })

    it('相対パスでも動作すること', () => {
      const directory = './test-dir'
      const expected = join(directory, 'backlog-settings.json')

      const result = getSettingsFilePath(directory)

      expect(result).to.equal(expected)
    })
  })

  describe('loadSettings', () => {
    it('設定ファイルが存在しない場合、空のオブジェクトを返すこと', async () => {
      const result = await loadSettings(tempDir)

      expect(result).to.deep.equal({})
    })

    it('設定ファイルが存在する場合、その内容を返すこと', async () => {
      const settings: Settings = {
        apiKey: 'test-api-key',
        domain: 'test.backlog.jp',
        folderType: FolderType.ISSUE,
        projectIdOrKey: 'TEST_PROJECT',
      }

      const settingsPath = getSettingsFilePath(tempDir)
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))

      const result = await loadSettings(tempDir)

      expect(result).to.deep.equal(settings)
    })

    it('壊れたJSONファイルの場合、空のオブジェクトを返すこと', async () => {
      const settingsPath = getSettingsFilePath(tempDir)
      await fs.writeFile(settingsPath, '{ invalid json }')

      const result = await loadSettings(tempDir)

      expect(result).to.deep.equal({})
    })
  })

  describe('saveSettings', () => {
    it('設定ファイルを正常に保存すること', async () => {
      const settings: Settings = {
        domain: 'example.backlog.jp',
        folderType: FolderType.WIKI,
        outputDir: './output',
        projectIdOrKey: 'SAMPLE_PROJECT',
      }

      await saveSettings(tempDir, settings)

      const settingsPath = getSettingsFilePath(tempDir)
      const savedData = await fs.readFile(settingsPath, 'utf8')
      const parsedData = JSON.parse(savedData)

      expect(parsedData).to.deep.equal(settings)
    })

    it('存在しないディレクトリを作成してから保存すること', async () => {
      const nestedDir = join(tempDir, 'nested', 'directory')
      const settings: Settings = {
        domain: 'test.backlog.jp',
      }

      await saveSettings(nestedDir, settings)

      const settingsPath = getSettingsFilePath(nestedDir)
      const exists = await fs
        .access(settingsPath)
        .then(() => true)
        .catch(() => false)

      expect(exists).to.be.true
    })

    it('空の設定オブジェクトも保存できること', async () => {
      const settings: Settings = {}

      await saveSettings(tempDir, settings)

      const settingsPath = getSettingsFilePath(tempDir)
      const savedData = await fs.readFile(settingsPath, 'utf8')
      const parsedData = JSON.parse(savedData)

      expect(parsedData).to.deep.equal({})
    })
  })

  describe('updateSettings', () => {
    it('既存設定がない場合、新しい設定で保存すること', async () => {
      const newSettings: Settings = {
        domain: 'new.backlog.jp',
        folderType: FolderType.DOCUMENT,
      }

      const result = await updateSettings(tempDir, newSettings)

      expect(result.domain).to.equal(newSettings.domain)
      expect(result.folderType).to.equal(newSettings.folderType)

      const saved = await loadSettings(tempDir)
      expect(saved).to.deep.equal(newSettings)
    })

    it('既存設定に新しい設定をマージすること', async () => {
      const initialSettings: Settings = {
        domain: 'initial.backlog.jp',
        projectIdOrKey: 'INITIAL_PROJECT',
      }
      await saveSettings(tempDir, initialSettings)

      const newSettings: Settings = {
        folderType: FolderType.ISSUE,
        outputDir: './new-output',
      }

      const result = await updateSettings(tempDir, newSettings)

      expect(result.domain).to.equal('initial.backlog.jp')
      expect(result.folderType).to.equal(FolderType.ISSUE)
      expect(result.outputDir).to.equal('./new-output')
      expect(result.projectIdOrKey).to.equal('INITIAL_PROJECT')

      const saved = await loadSettings(tempDir)
      const expected = {
        domain: 'initial.backlog.jp',
        folderType: FolderType.ISSUE,
        outputDir: './new-output',
        projectIdOrKey: 'INITIAL_PROJECT',
      }
      expect(saved).to.deep.equal(expected)
    })

    it('既存設定を上書きすること', async () => {
      const initialSettings: Settings = {
        domain: 'old.backlog.jp',
        folderType: FolderType.WIKI,
      }
      await saveSettings(tempDir, initialSettings)

      const newSettings: Settings = {
        domain: 'new.backlog.jp',
        folderType: FolderType.ISSUE,
      }

      const result = await updateSettings(tempDir, newSettings)

      expect(result.domain).to.equal('new.backlog.jp')
      expect(result.folderType).to.equal(FolderType.ISSUE)

      const saved = await loadSettings(tempDir)
      expect(saved.domain).to.equal('new.backlog.jp')
      expect(saved.folderType).to.equal(FolderType.ISSUE)
    })

    it('apiKeyは保存されないが戻り値には含まれること', async () => {
      const initialSettings: Settings = {
        domain: 'test.backlog.jp',
      }
      await saveSettings(tempDir, initialSettings)

      const newSettings: Settings = {
        apiKey: 'secret-key',
        projectIdOrKey: 'TEST',
      }

      const result = await updateSettings(tempDir, newSettings)

      expect(result.apiKey).to.equal('secret-key')

      const saved = await loadSettings(tempDir)
      expect(saved.apiKey).to.be.undefined
      expect(saved.projectIdOrKey).to.equal('TEST')
    })
  })

  describe('FolderType enum', () => {
    it('正しい値を持つこと', () => {
      expect(FolderType.DOCUMENT).to.equal('document')
      expect(FolderType.ISSUE).to.equal('issue')
      expect(FolderType.WIKI).to.equal('wiki')
    })

    it('すべてのフォルダタイプが文字列値を持つこと', () => {
      const values = Object.values(FolderType)

      for (const value of values) {
        expect(typeof value).to.equal('string')
      }

      expect(values).to.have.members(['document', 'issue', 'wiki'])
    })
  })
})
