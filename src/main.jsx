import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/styles/fotoplay-workspace.css'
import '@/styles/actor-workspace.css'
import '@/styles/set-workspace.css'
import '@/styles/compose-workspace.css'
import '@/styles/voice-recorder.css'
import '@/styles/studio-workspace-scroll.css'
import { registerServiceWorker } from '@/lib/registerServiceWorker'

registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
