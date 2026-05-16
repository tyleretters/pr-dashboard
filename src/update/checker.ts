import updateNotifier from 'update-notifier'

export interface UpdateInfo {
  current: string
  latest: string
  type: string
  name: string
}

interface PackageMeta {
  name: string
  version: string
}

// Returns cached update info from a prior background check, or null.
// The notifier itself schedules an unref'd background child process to
// refresh the cache on disk — we never block on it.
export const checkForUpdate = (pkg: PackageMeta): UpdateInfo | null => {
  if (process.env.NO_UPDATE_NOTIFIER) return null
  const notifier = updateNotifier({ pkg, updateCheckInterval: 1000 * 60 * 60 * 24 })
  return notifier.update ?? null
}
