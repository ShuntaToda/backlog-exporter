import {join} from 'node:path'
import process from 'node:process'
import {afterEach, describe, expect, it} from 'vitest'

import {configDirectory, readApiKeyFromEnv} from './env.js'

describe('env', () => {
  const savedEnv = {...process.env}

  afterEach(() => {
    process.env = {...savedEnv}
  })

  it('BACKLOG_EXPORTER_CONFIG_DIRがあればそれを設定ディレクトリにすること', () => {
    process.env.BACKLOG_EXPORTER_CONFIG_DIR = join('tmp', 'custom')

    expect(configDirectory()).to.equal(join('tmp', 'custom'))
  })

  it('指定が無ければXDG_CONFIG_HOMEの下を使うこと', () => {
    delete process.env.BACKLOG_EXPORTER_CONFIG_DIR
    process.env.XDG_CONFIG_HOME = join('tmp', 'xdg')

    expect(configDirectory()).to.equal(join('tmp', 'xdg', 'backlog-exporter'))
  })

  it('空のBACKLOG_API_KEYは未設定として扱うこと', () => {
    process.env.BACKLOG_API_KEY = ''

    expect(readApiKeyFromEnv()).to.be.undefined
  })
})
