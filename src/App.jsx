import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login2.jsx'
import Dashboard from './pages/Dashboard.jsx'
import SupervisionPanel from './pages/SupervisionPanel.jsx'
import OperationPanel from './pages/OperationPanel.jsx'
import ConsultaIN100 from './pages/ConsultaIN100.jsx'
import Equipes from './pages/Equipes.jsx'
import Usuarios from './pages/Usuarios.jsx'
import AdminControlePlanejamento from './pages/AdminControlePlanejamento.jsx'
import Recargas from './pages/Recargas.jsx'
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
        path="/recargas"
        element={
          <ProtectedRoute roles={["Master"]}>
            <Recargas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/controle-planejamento"
        element={
          <ProtectedRoute roles={["Master", "Administrador"]}>
            <AdminControlePlanejamento />
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute roles={["Master", "Administrador", "Supervisor"]}>
            <Usuarios />
          </ProtectedRoute>
        }
      />
      <Route
        path="/equipes"
        element={
          <ProtectedRoute roles={["Master", "Administrador", "Supervisor"]}>
            <Equipes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/supervisao"
        element={
          <ProtectedRoute roles={["Master", "Administrador", "Supervisor"]}>
            <SupervisionPanel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operacao"
        element={
          <ProtectedRoute roles={["Master", "Administrador", "Supervisor", "Operador"]}>
            <OperationPanel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/consultas/in100"
        element={
          <ProtectedRoute roles={["Master","Administrador","Supervisor","Operador"]}>
            <ConsultaIN100 />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
