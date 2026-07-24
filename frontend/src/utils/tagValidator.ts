import { profilesApi } from '../api/profiles'
import type { TagValidationResult } from '../types'

export async function checkTagUniqueness(tag: string, excludeTag?: string): Promise<TagValidationResult> {
  if (!tag.trim()) {
    return { valid: true }
  }

  try {
    const profiles = await profilesApi.getAll().then((r) => r.data)
    const exists = profiles.some((p) => p.tag === tag && p.tag !== excludeTag)
    if (exists) {
      return { valid: false, message: 'Tag already exists' }
    }
    return { valid: true }
  } catch {
    return { valid: true }
  }
}