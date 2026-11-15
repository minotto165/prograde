/** フォーム送信などで混入する CRLF / CR を LF にそろえる。 */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}
