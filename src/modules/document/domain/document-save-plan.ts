export type DocumentSaveAction =
  | 'delete-stale-parent-index'
  | 'save'
  | 'skip-empty-parent'
  | 'skip-fallback-collision'
  | 'skip-parent-index-collision'
  | 'skip-unchanged'

// 保存/スキップ/親index削除の判断。保存先にファイルが無ければ未更新でも保存（バックフィル）する。
// 本文が空の親はファイルを作らず、空に変更された場合は古い親indexを削除する
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

  // 前回の更新日時チェック。保存先にファイルが無い場合は未更新でもバックフィルとして保存する。
  // ドキュメントの移動・親の改名・子の追加/削除による親子の切り替えは本文の更新日時を変えないため、
  // 日時だけで判断すると新しい保存先にファイルが作られないまま取り残される
  if (input.lastUpdated && input.fileExists && new Date(input.updated) <= new Date(input.lastUpdated)) {
    return 'skip-unchanged'
  }

  if (input.asParentIndex && !input.body?.trim()) {
    return input.fileExists ? 'delete-stale-parent-index' : 'skip-empty-parent'
  }

  return 'save'
}
