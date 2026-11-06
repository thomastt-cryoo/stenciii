import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const { chromium, expect } = createRequire(resolve('web/package.json'))('@playwright/test')
const [launcher, report] = process.argv.slice(2)
const profile = await mkdtemp(join(tmpdir(), 'stencil-launcher-check-'))
const child = spawn(resolve(launcher), ['--no-open', '--profile-dir', profile], {stdio: 'inherit'})
let instance, browser

try {
  await expect.poll(async () => {
    try { instance = JSON.parse(await readFile(join(profile, 'instance.json'), 'utf8')) }
    catch { return false }
    return instance.launcherPid === child.pid
  }, {timeout: 25000}).toBe(true)

  browser = await chromium.launch({channel: 'chrome', headless: true})
  const context = await browser.newContext()
  await context.addInitScript(() => {
    const Native = WebSocket
    globalThis.studioSockets = []
    globalThis.WebSocket = class extends Native {
      constructor(...args) { super(...args); globalThis.studioSockets.push(this) }
    }
  })
  const ready = page => expect.poll(() => page.evaluate(() =>
    globalThis.studioSockets.some(socket => socket.readyState === 1 && socket.url.includes('/__studio/lease'))
  ), {timeout: 15000}).toBe(true)
  const a = await context.newPage()
  await a.goto(instance.url)
  await ready(a)
  await expect(a.getByRole('button', {name: 'Choose Image', exact: true})).toBeEnabled()

  const visibleWindows = execFileSync('/usr/bin/swift', ['-e', `
    import CoreGraphics
    import Foundation
    guard let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
      fatalError("The window server did not return a window list")
    }
    print(windows.filter { $0[kCGWindowOwnerPID as String] as? Int == ${child.pid} }.count)
  `], {encoding: 'utf8', timeout: 120000}).trim()
  assert.equal(visibleWindows, '0')

  const b = await context.newPage()
  await b.goto(instance.url)
  await ready(b)
  await a.close()
  await delay(9000)
  assert.equal(child.exitCode, null)
  await b.reload()
  await ready(b)
  await b.close()
  await expect.poll(() => child.exitCode, {timeout: 16000}).toBe(0)
  await assert.rejects(fetch(`${instance.url}__studio/session`, {signal: AbortSignal.timeout(1500)}))

  await writeFile(report, JSON.stringify({
    passed: true, macos: execFileSync('/usr/bin/sw_vers', ['-productVersion'], {encoding: 'utf8'}).trim(),
    arch: process.arch, chrome: browser.version(), visible_launcher_windows: Number(visibleWindows),
    second_tab_survived: true, reload_reconnected: true, last_tab_stopped_server: true,
  }, null, 2) + '\n')
} finally {
  if (browser) await browser.close()
  if (child.exitCode === null) child.kill()
}
