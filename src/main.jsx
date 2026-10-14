import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './clo-interface.css'
// Load the neutral CLO chrome and bright drafting board last so legacy
// dark-theme rules cannot override the new 2D surface during production builds.
import './clo-neutral-theme.css'
import './components/PatternDraftingEnhancements.css'
// Finish with the CLO-style neutral workspaces so older dark drafting styles
// cannot override the new light canvas after Vite's CSS dependency ordering.
import './clo-neutral-theme.css'
import './components/PatternDraftingEnhancements.css'

// The packaged macOS workspace uses a denser desktop-application layout,
// without changing the existing browser workspace or its saved project.
if (new URLSearchParams(window.location.search).get('desktop') === '1') {
  document.documentElement.classList.add('desktop-workspace')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
