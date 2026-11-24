interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
}

export default function Toast({ message, type, onClose }: ToastProps) {
  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg text-white shadow-lg text-sm ${colors[type]}`}>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100">✕</button>
    </div>
  )
}
