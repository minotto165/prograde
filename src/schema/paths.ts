/**
 * コースデータの中の相対パスを検証する。
 *
 * 教材はローカルの信頼できるデータだが、course.json を書き換えるだけで
 * /etc や作業ディレクトリの外を読み書きできてしまうのは避ける。
 */

export function isSafeRelativePath(value: string): boolean {
  if (value.length === 0 || value.includes("\0")) return false;
  if (value.startsWith("/") || value.startsWith("\\")) return false;
  if (/^[A-Za-z]:[\\/]/.test(value)) return false;
  const parts = value.split(/[\\/]/);
  return parts.every((part) => part !== "" && part !== "." && part !== "..");
}
