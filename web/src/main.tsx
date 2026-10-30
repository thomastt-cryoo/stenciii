import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './studio/studio.css'
import StudioApp from './studio/StudioApp'
import StudioBoundary from './studio/StudioBoundary'
import {installLocalHostLifecycle} from './studio/localHostLifecycle'

void installLocalHostLifecycle()

createRoot(document.getElementById('root')!).render(<StrictMode><StudioBoundary><StudioApp /></StudioBoundary></StrictMode>)
