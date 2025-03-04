import {Command} from '@oclif/core'
import ky from 'ky'
import * as fs from 'node:fs/promises'
import path from 'node:path'

import {sanitizeFileName, sanitizeWikiFileName} from './common.js'

/**
 * Backlogから課題をダウンロードする
 * @param command コマンドインスタンス
 * @param options 課題ダウンロードのオプション
 */
export async function downloadIssues(
  command: Command,
  options: {
    apiKey: string
    count: number
    domain: string
    lastUpdated?: string
    outputDir: string
    projectId: number
    statusId?: string
  },
): Promise<void> {
  const baseUrl = `https://${options.domain}/api/v2`

  command.log('課題の取得を開始します...')

  // APIパラメータの構築
  const params = new URLSearchParams({
    apiKey: options.apiKey,
    count: options.count.toString(),
    'projectId[]': options.projectId.toString(),
  })

  // ステータスIDが指定されている場合は追加
  if (options.statusId) {
    params.append('statusId[]', options.statusId)
  }

  const issues = await ky.get(`${baseUrl}/issues?${params.toString()}`).json<
    Array<{
      assignee: null | {id: number; name: string}
      created: string
      description: string
      id: number
      issueKey: string
      priority: {id: number; name: string}
      status: {id: number; name: string}
      summary: string
      updated: string
    }>
  >()

  command.log(`${issues.length}件の課題が見つかりました。`)

  // 前回の更新日時より新しい課題のみをフィルタリング
  let filteredIssues = issues
  if (options.lastUpdated) {
    const lastUpdatedDate = new Date(options.lastUpdated)
    filteredIssues = issues.filter((issue) => {
      const issueUpdatedDate = new Date(issue.updated)
      return issueUpdatedDate > lastUpdatedDate
    })
    command.log(`前回の更新日時(${options.lastUpdated})以降に更新された${filteredIssues.length}件の課題を処理します。`)
  }

  if (filteredIssues.length === 0) {
    command.log('更新が必要な課題はありません。')
    return
  }

  // 各課題の詳細情報を取得して保存
  command.log('課題を保存しています...')

  // Promise.allを使用して並列処理
  const issuePromises = filteredIssues.map(async (issue) => {
    try {
      // 課題の詳細情報をJSONファイルとして保存
      const issueFileName = `${sanitizeFileName(issue.summary)}.md`
      const issueFilePath = path.join(options.outputDir, issueFileName)

      // BacklogのIssueへのリンクを作成
      const backlogIssueUrl = `https://${options.domain}/view/${issue.issueKey}`

      // コメント一覧を取得
      command.log(`課題 ${issue.issueKey} のコメントを取得しています...`)
      const commentsParams = new URLSearchParams({
        apiKey: options.apiKey,
        count: '100', // 最大100件のコメントを取得
        order: 'asc', // 古い順に取得
      })

      const comments = await ky.get(`${baseUrl}/issues/${issue.issueKey}/comments?${commentsParams.toString()}`).json<
        Array<{
          content: string
          created: string
          createdUser: {
            id: number
            name: string
          }
          id: number
        }>
      >()

      // コメントセクションを作成
      let commentsSection = ''
      if (comments.length > 0) {
        commentsSection = '\n\n## コメント\n'
        let commentIndex = 1
        for (const comment of comments) {
          const commentDate = new Date(comment.created).toLocaleString('ja-JP')
          commentsSection += `\n### コメント ${commentIndex}\n- **投稿者**: ${
            comment.createdUser.name
          }\n- **日時**: ${commentDate}\n\n${comment.content || '(内容なし)'}\n\n---\n`
          commentIndex++
        }

        // 最後の区切り線を削除
        commentsSection = commentsSection.slice(0, -5)
      }

      // Markdownファイルに書き込む
      const assigneeName = issue.assignee ? issue.assignee.name : '未割り当て'
      const markdownContent = `# ${issue.summary}

## 基本情報
- 課題キー: ${issue.issueKey}
- ステータス: ${issue.status.name}
- 優先度: ${issue.priority.name}
- 担当者: ${assigneeName}
- 作成日時: ${new Date(issue.created).toLocaleString('ja-JP')}
- 更新日時: ${new Date(issue.updated).toLocaleString('ja-JP')}
- [Backlog Issue Link](${backlogIssueUrl})

## 詳細
${issue.description || '詳細情報なし'}${commentsSection}`

      await fs.writeFile(issueFilePath, markdownContent)

      command.log(`課題 "${issue.issueKey}: ${issue.summary}" を ${issueFilePath} に保存しました`)
    } catch (error) {
      command.warn(
        `課題 ${issue.issueKey} の保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  })

  await Promise.all(issuePromises)
  command.log('課題のダウンロードが完了しました！')
}

/**
 * BacklogからWikiをダウンロードする
 * @param command コマンドインスタンス
 * @param options Wikiダウンロードのオプション
 */
export async function downloadWikis(
  command: Command,
  options: {
    apiKey: string
    domain: string
    lastUpdated?: string
    outputDir: string
    projectIdOrKey: string
  },
): Promise<void> {
  const baseUrl = `https://${options.domain}/api/v2`

  command.log('Wikiの取得を開始します...')

  // Wiki一覧の取得
  command.log('Wiki一覧を取得しています...')
  const wikis = await ky
    .get(`${baseUrl}/wikis?apiKey=${options.apiKey}&projectIdOrKey=${options.projectIdOrKey}`)
    .json<Array<{id: string; name: string; updated: string}>>()

  command.log(`${wikis.length}件のWikiが見つかりました。`)

  // 前回の更新日時より新しいWikiのみをフィルタリング
  let filteredWikis = wikis
  if (options.lastUpdated) {
    const lastUpdatedDate = new Date(options.lastUpdated)
    filteredWikis = wikis.filter((wiki) => {
      const wikiUpdatedDate = new Date(wiki.updated)
      return wikiUpdatedDate > lastUpdatedDate
    })
    command.log(`前回の更新日時(${options.lastUpdated})以降に更新された${filteredWikis.length}件のWikiを処理します。`)
  }

  if (filteredWikis.length === 0) {
    command.log('更新が必要なWikiはありません。')
    return
  }

  // 各Wikiの詳細情報を取得
  command.log('Wiki詳細を取得しています...')

  // Promise.allを使用して並列処理
  const wikiPromises = filteredWikis.map(async (wiki) => {
    const wikiId = wiki.id
    command.log(`Wiki: ${wiki.name} (ID: ${wikiId}) を取得しています`)

    try {
      const wikiDetail = await ky
        .get(`${baseUrl}/wikis/${wikiId}?projectIdOrKey=${options.projectIdOrKey}&apiKey=${options.apiKey}`)
        .json<Record<string, unknown>>()

      // Wikiの名前をファイルパスとして使用
      const wikiName = wiki.name

      // ファイル名のサニタイズ
      const sanitizedName = sanitizeWikiFileName(wikiName)

      // ファイル名の拡張子を追加
      const wikiFileName = `${sanitizedName}.md`

      // ディレクトリ構造を作成（必要な場合）
      const dirPath = path.dirname(wikiFileName)
      if (dirPath !== '.') {
        await fs.mkdir(path.join(options.outputDir, dirPath), {recursive: true})
      }

      // Markdownファイルを保存
      const wikiFilePath = path.join(options.outputDir, wikiFileName)

      // JSONからcontentフィールドを取得
      const content = (wikiDetail.content as string) || ''

      // BacklogのWikiへのリンクを作成
      const backlogWikiUrl = `https://${options.domain}/alias/wiki/${wikiId}`

      // Markdownファイルに書き込む（タイトルとBacklogリンクを追加）
      const markdownContent = `# ${wiki.name}\n\n[Backlog Wiki Link](${backlogWikiUrl})\n\n${content}`
      await fs.writeFile(wikiFilePath, markdownContent)

      command.log(`Wiki "${wiki.name}" を ${wikiFilePath} に保存しました`)
    } catch (error) {
      command.warn(`Wiki ID ${wikiId} の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  await Promise.all(wikiPromises)
  command.log('Wikiのダウンロードが完了しました！')
}
