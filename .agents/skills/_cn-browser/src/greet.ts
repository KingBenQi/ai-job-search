import { PortalError } from "./types.js"

export interface GreetingInput {
  name?: string
  company: string
  role: string
  highlight?: string
}

/**
 * A short 打招呼 draft the user pastes themselves. Boss直聘's composer is
 * small, so the draft stays under 120 characters.
 */
export function draftGreeting(input: GreetingInput): string {
  const company = input.company.trim()
  const role = input.role.trim()
  if (!company || !role) {
    throw new PortalError("greet needs both --company and --role", "MISSING_GREETING_FIELDS")
  }
  const hello = input.name?.trim() ? `${input.name.trim()}你好，` : "您好，"
  const highlight = input.highlight?.trim()
  const skill = highlight ? `我在${highlight}方面有对口经验，` : ""
  return `${hello}看到${company}在招「${role}」。${skill}想进一步沟通，方便时请看我的简历。谢谢。`
}

export function assertNoSend(flags: { send?: boolean; batch?: boolean }): void {
  if (flags.send || flags.batch) {
    throw new PortalError(
      "Refusing to send 打招呼 or 投递. The draft is printed for you to paste. This tool never clicks send and never messages more than the one job you named.",
      "SEND_REFUSED",
    )
  }
}
