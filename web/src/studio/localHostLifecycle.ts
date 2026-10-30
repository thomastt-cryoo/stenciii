/** Managed local hosting only. Static/development hosts simply return 404.
 * Navigating to a small inert document ends the old document's entire worker
 * tree, including nested WASM threads, if the launcher stops unexpectedly. */
export async function installLocalHostLifecycle() {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return
  const origin = location.origin
  const request = async (path: string, init: RequestInit = {}) => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 1500)
    try { return await fetch(origin + path, {...init, cache: 'no-store', signal: controller.signal}) }
    finally { clearTimeout(timer) }
  }
  let session: string
  try {
    const response = await request('/__studio/session')
    if (!response.ok) return
    const data = await response.json()
    if (data.schema !== 1 || !data.managed || !/^[a-f0-9]{48}$/.test(data.session)) return
    session = data.session
  } catch { return }
  let failures = 0, busy = false, ended = false, leaving = false
  let timer: ReturnType<typeof setInterval> | undefined
  const closeDocument = () => {
    if (ended) return
    ended = true; clearInterval(timer)
    const page = document.implementation.createHTMLDocument('Stencil Studio is closed')
    const style = page.createElement('style')
    style.textContent = 'body{font:16px system-ui,sans-serif;max-width:42rem;margin:12vh auto;padding:2rem;color:#242424;background:#fafafa}p{line-height:1.6}a{color:inherit}'
    page.head.append(style)
    const heading = page.createElement('h1'); heading.textContent = 'Stencil Studio is closed'
    const text = page.createElement('p'); text.textContent = 'Processing has stopped. You can close this tab. To continue, open the Stencil Studio launcher again. Your saved project files are unchanged. If browser storage was available, your most recent draft can be restored.'
    const link = page.createElement('a'); link.href = origin + '/'; link.textContent = 'Return to Studio after reopening the launcher'
    page.body.append(heading, text, link)
    location.replace(URL.createObjectURL(new Blob(['<!doctype html>' + page.documentElement.outerHTML], {type:'text/html'})))
  }
  const poll = async () => {
    if (busy || ended || leaving) return
    busy = true
    try {
      const response = await request('/__studio/session')
      if (!response.ok || (await response.json()).session !== session) throw Error('The local Studio session ended')
      failures = 0
    } catch { if (++failures >= 2) closeDocument() }
    finally { busy = false }
  }
  const lease = new WebSocket(origin.replace(/^http/, 'ws') + '/__studio/lease?session=' + session)
  let connected = false
  lease.onopen = () => { connected = true }
  lease.onclose = () => {
    if (leaving) return
    if (connected) closeDocument()
    // Restricted browser policies may block WebSockets. Processing still works,
    // with a visible launcher and a polling fallback for explicit shutdown.
    else timer = setInterval(() => { void poll() }, 1000)
  }
  addEventListener('pagehide', () => { leaving = true; clearInterval(timer); lease.close() })
  addEventListener('pageshow', event => { if (event.persisted) location.reload() })
}
