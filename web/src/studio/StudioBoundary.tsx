import { Component, type ReactNode } from 'react'
import { AUTOSAVE, download } from './session'
export default class StudioBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <main className="studio-recovery"><h1>The workspace could not be displayed.</h1><p>Your saved processing and artwork can still be recovered.</p><button className="primary-button" onClick={() => location.reload()}>Reload workspace</button><button onClick={() => download(new Blob([localStorage.getItem(AUTOSAVE) ?? '{}'], { type: 'application/json' }), 'recovered-stencil.json')}>Save recovery file</button></main>
  }
}
