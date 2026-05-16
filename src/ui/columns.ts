import type { ColumnKey } from '@/config/schema.ts'

export interface ColumnSpec {
  key: ColumnKey
  label: string
  width: number | 'flex'
}

export const COLUMN_SPECS: Record<ColumnKey, ColumnSpec> = {
  repo: { key: 'repo', label: 'Repo', width: 32 },
  number: { key: 'number', label: '#', width: 6 },
  title: { key: 'title', label: 'Title', width: 'flex' },
  ci: { key: 'ci', label: 'CI', width: 3 },
  review: { key: 'review', label: 'Rev', width: 3 },
  merge: { key: 'merge', label: 'Mrg', width: 3 },
  age: { key: 'age', label: 'Age', width: 5 },
  updated: { key: 'updated', label: 'Updated', width: 9 },
}
