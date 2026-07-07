/**
 * テスト用のoclif Commandスタブ。
 * download系・prune系の関数は Command のうち log/warn/error しか使わないため、これで十分。
 * error はコマンド実行を中断する実物の挙動に合わせて例外を投げる。
 */
export const stubCommand = {
  error(message: string): never {
    throw new Error(message)
  },
  log() {},
  warn() {},
} as never
