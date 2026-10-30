import { Component, type ReactNode } from 'react'
import { editor,download,useEditor } from './session'
export default class StudioBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <main className="studio-recovery"><h1>The workspace could not be displayed.</h1><p>Save the current project and original artwork before reloading. Recovery also works when browser storage is unavailable.</p><button className="primary-button" onClick={() => location.reload()}>Reload workspace</button><button onClick={() => download(new Blob([editor.recoveryJSON()], { type: 'application/json' }), 'recovered-stencil.json')}>Save recovery file</button><button onClick={()=>{const raw=editor.recoveryJSON();useEditor.setState({storedRecovery:raw});editor.newProject();this.setState({failed:false})}}>Start empty workspace</button><p>Starting empty keeps the recovery copy available in this window. Download it before closing the application.</p></main>
  }
}
