import {homedir} from 'node:os'
import {join} from 'node:path'
import process from 'node:process'
import {afterEach, describe, expect, it} from 'vitest'

import {configDirectory, readApiKeyFromEnv} from './env.js'

describe('configDirectory', () => {
  const LOCALAPPDATA = join('C:', 'Users', 'yamada', 'AppData', 'Local')

  it('BACKLOG_EXPORTER_CONFIG_DIRがあれば最優先で使うこと', () => {
    const env = {BACKLOG_EXPORTER_CONFIG_DIR: join('tmp', 'custom'), LOCALAPPDATA, XDG_CONFIG_HOME: join('tmp', 'xdg')}

    expect(configDirectory(env, 'win32')).to.equal(join('tmp', 'custom'))
  })

  it('XDG_CONFIG_HOMEがあればその下を使うこと', () => {
    expect(configDirectory({XDG_CONFIG_HOME: join('tmp', 'xdg')}, 'linux')).to.equal(
      join('tmp', 'xdg', 'backlog-exporter'),
    )
  })

  it('Windowsでは%LOCALAPPDATA%の下を使うこと', () => {
    expect(configDirectory({LOCALAPPDATA}, 'win32')).to.equal(join(LOCALAPPDATA, 'backlog-exporter'))
  })

  it('Windows以外ではLOCALAPPDATAがあっても使わないこと', () => {
    expect(configDirectory({LOCALAPPDATA}, 'darwin')).to.equal(join(homedir(), '.config', 'backlog-exporter'))
  })

  it('WindowsでもLOCALAPPDATAが無ければホームの.configを使うこと', () => {
    expect(configDirectory({}, 'win32')).to.equal(join(homedir(), '.config', 'backlog-exporter'))
  })

  it('macOS・Linuxの既定はホームの.configであること', () => {
    expect(configDirectory({}, 'linux')).to.equal(join(homedir(), '.config', 'backlog-exporter'))
  })
})

describe('readApiKeyFromEnv', () => {
  const savedEnv = {...process.env}

  afterEach(() => {
    process.env = {...savedEnv}
  })

  it('空のBACKLOG_API_KEYは未設定として扱うこと', () => {
    process.env.BACKLOG_API_KEY = ''

    expect(readApiKeyFromEnv()).to.be.undefined
  })
})
