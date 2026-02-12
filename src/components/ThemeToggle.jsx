import { useTheme } from '../context/ThemeContext.jsx'
import { FiSun, FiMoon } from 'react-icons/fi'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  const Icon = dark ? FiSun : FiMoon
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-icon-btn"
      aria-label={dark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
      title={dark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
      aria-pressed={dark}
    >
      <Icon className="theme-icon-only" />
    </button>
  )
}
