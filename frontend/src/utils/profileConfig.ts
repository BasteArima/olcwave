import { load, dump } from 'js-yaml'

export function stripProfileFields(yaml: string): string {
  const doc = load(yaml) as Record<string, unknown> | null
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return yaml

  delete doc.mode
  delete doc.data

  if (doc.crypto && typeof doc.crypto === 'object' && !Array.isArray(doc.crypto)) {
    const crypto = doc.crypto as Record<string, unknown>
    delete crypto.key
    if (Object.keys(crypto).length === 0) {
      delete doc.crypto
    }
  }

  return dump(doc, { lineWidth: -1, noRefs: true })
}
