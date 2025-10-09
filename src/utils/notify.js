import { toast } from 'react-toastify'

const defaultOptions = {
  position: 'top-right',
  autoClose: 3200,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
}

const ensureMessage = (message) => {
  if (message == null) return ''
  if (typeof message === 'string') return message
  if (Array.isArray(message)) return message.filter(Boolean).join(' ')
  try {
    return String(message)
  } catch (_) {
    return ''
  }
}

const withDefaults = (opts = {}) => ({ ...defaultOptions, ...opts })

export const notify = {
  success: (msg, opts = {}) => toast.success(ensureMessage(msg), withDefaults(opts)),
  info: (msg, opts = {}) => toast.info(ensureMessage(msg), withDefaults(opts)),
  warn: (msg, opts = {}) => toast.warn(ensureMessage(msg), withDefaults(opts)),
  error: (msg, opts = {}) => toast.error(ensureMessage(msg), withDefaults(opts)),
  loading: (msg, opts = {}) => toast.loading(ensureMessage(msg), {
    ...defaultOptions,
    autoClose: false,
    closeOnClick: false,
    draggable: false,
    ...opts,
  }),
  promise: (promise, messages, opts = {}) => toast.promise(promise, messages, withDefaults(opts)),
  update: (id, opts = {}) => toast.update(id, opts),
  dismiss: (id) => toast.dismiss(id),
  defaults: defaultOptions,
}
