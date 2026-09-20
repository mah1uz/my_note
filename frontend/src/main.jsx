import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppStateProvider } from './context/AppStateContext'
import { AuthProvider } from './context/AuthContext'
import { NotesProvider } from './context/NotesContext'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <NotesProvider>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </NotesProvider>
    </AuthProvider>
  </React.StrictMode>
)
