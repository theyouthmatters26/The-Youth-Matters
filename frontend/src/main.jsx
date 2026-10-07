import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Global styles first so component styles (imported by App) can override them.
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/pages.css'
import App, { loadPage } from './App'
import { AuthProvider } from './lib/auth'

// Fetch the code for the page being opened, then render once. A page built ahead of time is already
// on screen at this point; rendering only when its code has arrived swaps it for the same page.
// As a transition, React does that work in short slices, so the page already showing stays
// responsive to scrolling and taps while the app starts behind it.
loadPage(window.location.pathname).then(() => {
  const root = ReactDOM.createRoot(document.getElementById('root'))
  React.startTransition(() => root.render(
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>,
  ))
})
