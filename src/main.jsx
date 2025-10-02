import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './styles/theme.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import AppBoot from './components/AppBoot.jsx'
import { LoadingProvider } from './context/LoadingContext.jsx'
import GlobalLoader from './components/GlobalLoader.jsx'
import RouteChangeLoader from './components/RouteChangeLoader.jsx'
import Toasts from './components/Toasts.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LoadingProvider>
          <GlobalLoader />
          <RouteChangeLoader />
          <Toasts />
          <AuthProvider>
            <AppBoot>
              <App />
            </AppBoot>
          </AuthProvider>
        </LoadingProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
