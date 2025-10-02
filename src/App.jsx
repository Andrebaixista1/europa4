import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import SupervisionPanel from './pages/SupervisionPanel.jsx'
import OperationPanel from './pages/OperationPanel.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["Master", "Admin"]}>
            <AdminPanel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/supervisao"
        element={
          <ProtectedRoute roles={["Master", "Admin", "Supervisor"]}>
            <SupervisionPanel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operacao"
        element={
          <ProtectedRoute roles={["Master", "Admin", "Supervisor", "Operador"]}>
            <OperationPanel />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
