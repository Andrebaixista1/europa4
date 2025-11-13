import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useTheme } from '../context/ThemeContext.jsx'

export default function Toasts() {
  const { theme } = useTheme()
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme={theme === 'dark' ? 'dark' : 'light'}
      limit={3}
      containerClassName="neo-toast-container"
      style={{ zIndex: 2147483647 }}
    />
  )
}
