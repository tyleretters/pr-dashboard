import { z } from 'zod'

export const ColumnKey = z.enum(['repo', 'number', 'title', 'ci', 'review', 'merge', 'age', 'updated'])
export type ColumnKey = z.infer<typeof ColumnKey>

export const PresetSchema = z.object({
  label: z.string().min(1),
  filters: z.array(z.string().min(1)).min(1),
})
export type Preset = z.infer<typeof PresetSchema>

export const ConfigSchema = z.object({
  indexIntervalMs: z.number().int().min(5000).max(600000).default(20000),
  detailMaxBatchSize: z.number().int().min(1).max(100).default(25),
  defaultPreset: z.string().min(1).default('work'),
  presets: z.record(z.string(), PresetSchema),
  columns: z.array(ColumnKey).min(1).default(['repo', 'number', 'title', 'ci', 'review', 'merge', 'age', 'updated']),
})
export type Config = z.infer<typeof ConfigSchema>

export const DEFAULT_CONFIG: Config = {
  indexIntervalMs: 20000,
  detailMaxBatchSize: 25,
  defaultPreset: 'work',
  presets: {
    work: {
      label: 'Work',
      filters: ['is:open is:pr involves:@me org:discogs archived:false'],
    },
    personal: {
      label: 'Personal',
      filters: ['is:open is:pr author:@me archived:false -org:discogs'],
    },
    'review-queue': {
      label: 'Review',
      filters: ['is:open is:pr review-requested:@me archived:false'],
    },
  },
  columns: ['repo', 'number', 'title', 'ci', 'review', 'merge', 'age', 'updated'],
}
