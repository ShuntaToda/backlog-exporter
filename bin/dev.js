#!/usr/bin/env -S node --import tsx --disable-warning=ExperimentalWarning

import {execute} from '@oclif/core'

// execute({development: true}) はエラー時のスタックトレース表示も有効化してしまうため、
// srcのTS解決に必要な NODE_ENV のみを設定する
process.env.NODE_ENV = 'development'

await execute({dir: import.meta.url})
