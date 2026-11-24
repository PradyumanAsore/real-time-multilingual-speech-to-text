/** Format seconds as MM:SS */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Format a date string for display */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Truncate text to N chars */
export function truncate(text: string, n = 120): string {
  if (text.length <= n) return text
  return text.slice(0, n) + '…'
}

/** Language display name */
export function languageLabel(code: string | null | undefined): string {
  if (!code || code === 'auto') return 'Auto'
  const names: Record<string, string> = {
    hi: 'Hindi',
    en: 'English',
    'hi-en': 'Hinglish',
  }
  return names[code] ?? code.toUpperCase()
}

/** Copy text to clipboard */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
