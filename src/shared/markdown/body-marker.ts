export const BODY_START_MARKER = '<!-- backlog-exporter:body:start -->'
export const BODY_END_MARKER = '<!-- backlog-exporter:body:end -->'

export function wrapBody(body: string): string {
  return `${BODY_START_MARKER}\n${body}\n${BODY_END_MARKER}`
}
