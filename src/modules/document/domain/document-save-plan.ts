export type DocumentSaveAction =
  | 'delete-stale-parent-index'
  | 'save'
  | 'skip-empty-parent'
  | 'skip-parent-index-collision'
  | 'skip-unchanged'

// 保存/スキップ/親index削除の判断。本文が空の親はファイルを作らず、空に変更された場合は古い親indexを削除する
export function planDocumentSave(input: {
  asParentIndex: boolean
  body: null | string | undefined
  lastUpdated?: string
  parentIndexAlreadyWrittenThisRun: boolean
  parentIndexExists: boolean
  updated: string
}): DocumentSaveAction {
  if (input.asParentIndex && input.parentIndexAlreadyWrittenThisRun) {
    return 'skip-parent-index-collision'
  }

  // 前回の更新日時チェック（親indexがまだ存在しない場合はバックフィルのため未更新でも保存する）
  const backfillParentIndex = input.asParentIndex && !input.parentIndexExists
  if (input.lastUpdated && !backfillParentIndex && new Date(input.updated) <= new Date(input.lastUpdated)) {
    return 'skip-unchanged'
  }

  if (input.asParentIndex && !input.body?.trim()) {
    return input.parentIndexExists ? 'delete-stale-parent-index' : 'skip-empty-parent'
  }

  return 'save'
}
