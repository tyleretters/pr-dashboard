export const relativeTime = (iso: string, now: number = Date.now()): string => {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return '?'
  const seconds = Math.max(0, Math.floor((now - then) / 1000))
  if (seconds < 60) return `${String(seconds)}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${String(days)}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${String(months)}mo ago`
  return `${String(Math.floor(days / 365))}y ago`
}

export const daysSince = (iso: string, now: number = Date.now()): number => {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return 0
  return Math.floor((now - then) / 86_400_000)
}
