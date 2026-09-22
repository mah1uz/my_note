import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppStateProvider } from './context/AppStateContext'
import { AuthProvider } from './context/AuthContext'
import { NotesProvider } from './context/NotesContext'
import { AiKeyProvider } from './context/AiKeyContext'
import { AdminProvider } from './context/AdminContext'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AiKeyProvider>
      <AdminProvider>
      <AuthProvider>
        <NotesProvider>
          <AppStateProvider>
            <App />
          </AppStateProvider>
        </NotesProvider>
      </AuthProvider>
      </AdminProvider>
    </AiKeyProvider>
  </React.StrictMode>
)
