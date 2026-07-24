export interface RoutingValidationError {
  path: string
  message: string
}

export interface RoutingValidationResult {
  valid: boolean
  errors: RoutingValidationError[]
}

export function validateRoutingJson(json: string): RoutingValidationResult {
  const errors: RoutingValidationError[] = []

  if (!json.trim()) {
    return { valid: false, errors: [{ path: '', message: 'Config is empty' }] }
  }

  let doc: unknown
  try {
    doc = JSON.parse(json)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid JSON'
    errors.push({ path: '', message: `Invalid JSON — ${msg}` })
    return { valid: false, errors }
  }

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    errors.push({ path: '', message: 'JSON root must be an object' })
    return { valid: false, errors }
  }

  const root = doc as Record<string, unknown>

  const routing = root.routing as Record<string, unknown> | undefined
  const rules = routing?.rules
  if (!Array.isArray(rules) || rules.length === 0) {
    errors.push({ path: 'routing.rules', message: 'must contain at least one rule' })
  }

  const inbounds = root.inbounds
  if (!Array.isArray(inbounds)) {
    errors.push({ path: 'inbounds', message: 'must be an array' })
  } else if (inbounds.length !== 1) {
    errors.push({ path: 'inbounds', message: 'only one inbound is supported' })
  } else {
    const inbound = inbounds[0] as Record<string, unknown> | undefined
    if (inbound?.protocol !== 'socks') {
      errors.push({ path: 'inbounds[0].protocol', message: 'must be socks' })
    }
  }

  return { valid: errors.length === 0, errors }
}
