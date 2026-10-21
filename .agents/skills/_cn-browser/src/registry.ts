import type { PortalAdapter } from "./types.js"

const adapters = new Map<string, PortalAdapter>()

export function registerPortal(adapter: PortalAdapter): void {
  adapters.set(adapter.id, adapter)
}

export function portalById(id: string): PortalAdapter | undefined {
  return adapters.get(id)
}

export function listPortals(): PortalAdapter[] {
  return [...adapters.values()]
}

function bareHost(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.$/, "")
  return host.startsWith("www.") ? host.slice(4) : host
}

/** Exact host or a subdomain of a registered host. `evil-zhipin.com` does not match. */
export function portalForHost(hostname: string): PortalAdapter | undefined {
  const host = bareHost(hostname)
  if (!host) return undefined
  for (const adapter of adapters.values()) {
    for (const owned of adapter.hosts) {
      const apex = bareHost(owned)
      if (host === apex || host.endsWith(`.${apex}`)) return adapter
    }
  }
  return undefined
}

/** Test hook. Production adapters register once on import. */
export function clearPortals(): void {
  adapters.clear()
}
