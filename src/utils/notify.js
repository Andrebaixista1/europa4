import { toast } from 'react-toastify'

export const notify = {
  success: (msg, opts={}) => toast.success(msg, opts),
  info:    (msg, opts={}) => toast.info(msg, opts),
  warn:    (msg, opts={}) => toast.warn(msg, opts),
  error:   (msg, opts={}) => toast.error(msg, opts),
}

