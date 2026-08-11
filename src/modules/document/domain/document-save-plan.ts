export type DocumentSaveAction =
  | 'delete-stale-parent-index'
  | 'save'
  | 'skip-empty-parent'
  | 'skip-fallback-collision'
  | 'skip-parent-index-collision'
  | 'skip-unchanged'

// 保存/スキップ/親index削除の判断。本文が空の親はファイルを作らず、空に変更された場合は古い親indexを削除する
export function planDocumentSave(input: {
  alreadyWrittenThisRun: boolean
  asParentIndex: boolean
  body: null | string | undefined
  fileExists: boolean
  lastUpdated?: string
  missingFromTree: boolean
  updated: string
}): DocumentSaveAction {
  if (input.asParentIndex && input.alreadyWrittenThisRun) {
    return 'skip-parent-index-collision'
  }

  // ツリーに現れないドキュメントは出力ルート直下に固定で置かれるため、同名の保存先が既に使われていたら譲る。
  // ツリー上の位置が確かなドキュメントを、位置の分からないドキュメントで黙って上書きしないための保険
  if (input.missingFromTree && input.alreadyWrittenThisRun) {
    return 'skip-fallback-collision'
  }

  // 前回の更新日時チェック。親index・ツリーに現れないドキュメントは、そもそも過去のエクスポートで
  // 取得できていない可能性があるため、ファイルが無い場合は未更新でもバックフィルとして保存する
  const backfill = (input.asParentIndex || input.missingFromTree) && !input.fileExists
  if (input.lastUpdated && !backfill && new Date(input.updated) <= new Date(input.lastUpdated)) {
    return 'skip-unchanged'
  }

  if (input.asParentIndex && !input.body?.trim()) {
    return input.fileExists ? 'delete-stale-parent-index' : 'skip-empty-parent'
  }

  return 'save'
}
