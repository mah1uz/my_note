import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppStateProvider } from './context/AppStateContext'
import { AuthProvider } from './context/AuthContext'
import { NotesProvider } from './context/NotesContext'
import { AiKeyProvider } from './context/AiKeyContext'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AiKeyProvider>
      <AuthProvider>
        <NotesProvider>
          <AppStateProvider>
            <App />
          </AppStateProvider>
        </NotesProvider>
      </AuthProvider>
    </AiKeyProvider>
  </React.StrictMode>
)
