/**
 * Confirm gate shown before a draft is recorded.
 *
 * Adapted from automation/apply_bot/confirm.py in
 * https://github.com/JiemsLBJ/offer-harvester (MIT).
 *
 * Copyright (c) 2026 JiemsLBJ (China-market automation pipeline)
 * Copyright (c) 2026 Mads Lorentzen (upstream ai-job-search)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * This fork does not submit. Boss直聘 and 猎聘 stay read-only: answering yes
 * records a drafted tracker row and never clicks send.
 */

export interface ConfirmContext {
  portal: string
  jobTitle: string
  company: string
  /** Omitted from the rendered text when empty, so a draft alone carries no URL. */
  url?: string
  fields: string[]
  notes: string[]
}

const ACCEPTED = new Set(["y", "yes", "确认", "是", "ok"])

export function confirmAccepted(answer: string): boolean {
  return ACCEPTED.has(answer.trim().toLowerCase())
}

export function renderConfirm(ctx: ConfirmContext): string {
  const lines = [
    "",
    "=".repeat(64),
    "【提交前确认】",
    `  平台: ${ctx.portal}`,
    `  岗位: ${ctx.jobTitle}`,
    `  公司: ${ctx.company}`,
  ]
  if (ctx.url && ctx.url.trim()) lines.push(`  链接: ${ctx.url.trim()}`)
  if (ctx.fields.length) lines.push("  将保留草稿: " + ctx.fields.join(" | "))
  for (const note of ctx.notes) lines.push(`  注意: ${note}`)
  lines.push("=".repeat(64))
  lines.push("输入 y 确认并记下这条草稿；输入其他任何内容取消。不会发送、不会投递。")
  return lines.join("\n")
}
