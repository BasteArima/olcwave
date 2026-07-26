export interface ParsedVlessUri {
  uuid: string
  host: string
  port: number
  remark: string
  encryption: string
  flow: string
  security: string
  type: string
  sni: string
  fingerprint: string
  alpn: string[]
  publicKey: string
  shortId: string
  spiderX: string
  path: string
  transportHost: string
  serviceName: string
  authority: string
  mode: string
  extra: string
}

export interface VlessParseError {
  field: string
  message: string
}

export interface VlessPreview {
  server: string
  port: number
  transport: string
  security: string
  sni: string
  fingerprint: string
  remark: string
  uuid: string
}

const SUPPORTED_SECURITY = ['none', 'tls', 'reality'] as const
const SUPPORTED_TRANSPORT = ['tcp', 'kcp', 'ws', 'http', 'grpc', 'httpupgrade', 'xhttp', 'raw'] as const
const SUPPORTED_FINGERPRINTS = ['chrome', 'firefox', 'safari', 'edge', 'random', 'randomized'] as const
const SUPPORTED_KCP_TYPES = ['none', 'srtp', 'utp', 'wechat-video', 'dtls', 'wireguard'] as const
const SUPPORTED_XHTTP_MODES = ['auto', 'packet-up', 'websocket'] as const

function decodeComponent(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export function parseVlessUri(uri: string): ParsedVlessUri {
  const trimmed = uri.trim()

  if (!trimmed.toLowerCase().startsWith('vless://')) {
    throw new VlessParseErrorImpl('', 'invalid VLESS URI')
  }

  const withoutScheme = trimmed.slice('vless://'.length)

  const hashIdx = withoutScheme.lastIndexOf('#')
  const remark = hashIdx >= 0 ? decodeComponent(withoutScheme.slice(hashIdx + 1)) : ''
  const withoutFragment = hashIdx >= 0 ? withoutScheme.slice(0, hashIdx) : withoutScheme

  const questionIdx = withoutFragment.indexOf('?')
  const authority = questionIdx >= 0 ? withoutFragment.slice(0, questionIdx) : withoutFragment
  const queryString = questionIdx >= 0 ? withoutFragment.slice(questionIdx + 1) : ''

  const atIdx = authority.indexOf('@')
  if (atIdx < 0) {
    throw new VlessParseErrorImpl('', 'invalid VLESS URI')
  }

  const uuid = authority.slice(0, atIdx)
  if (!uuid) {
    throw new VlessParseErrorImpl('uuid', 'missing UUID')
  }

  const hostPort = authority.slice(atIdx + 1)
  const lastColon = hostPort.lastIndexOf(':')
  if (lastColon < 0) {
    throw new VlessParseErrorImpl('port', 'missing port')
  }

  const host = hostPort.slice(0, lastColon)
  if (!host) {
    throw new VlessParseErrorImpl('host', 'missing host')
  }

  const portStr = hostPort.slice(lastColon + 1)
  const port = parseInt(portStr, 10)
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new VlessParseErrorImpl('port', 'invalid port')
  }

  const params = parseQueryString(queryString)

  const encryption = params.encryption || 'none'
  const flow = params.flow || ''
  const security = params.security || 'none'
  const type = params.type || 'tcp'
  const sni = params.sni || params.serverName || ''
  const fingerprint = params.fp || params.fingerprint || ''
  const alpnRaw = params.alpn || ''
  const alpn = alpnRaw ? alpnRaw.split(',').map((s) => s.trim()).filter(Boolean) : []
  const publicKey = params.pbk || params.publicKey || ''
  const shortId = params.sid || params.shortId || ''
  const spiderX = params.spx || params.spiderX || ''
  const path = params.path || ''
  const transportHost = params.host || ''
  const serviceName = params.serviceName || ''
  const authorityParam = params.authority || ''
  const mode = params.mode || ''
  const extra = params.extra || ''

  return {
    uuid,
    host,
    port,
    remark,
    encryption,
    flow,
    security,
    type,
    sni,
    fingerprint,
    alpn,
    publicKey,
    shortId,
    spiderX,
    path,
    transportHost,
    serviceName,
    authority: authorityParam,
    mode,
    extra,
  }
}

function parseQueryString(qs: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!qs) return result

  const pairs = qs.split('&')
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx < 0) {
      const key = decodeComponent(pair)
      if (key) result[key] = ''
    } else {
      const key = decodeComponent(pair.slice(0, eqIdx))
      const value = decodeComponent(pair.slice(eqIdx + 1))
      if (key) result[key] = value
    }
  }
  return result
}

export class VlessParseErrorImpl extends Error {
  field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'VlessParseError'
    this.field = field
  }
}

export function validateVlessUri(parsed: ParsedVlessUri): VlessParseError[] {
  const errors: VlessParseError[] = []

  if (!parsed.uuid) {
    errors.push({ field: 'uuid', message: 'missing UUID' })
  }

  if (!parsed.host) {
    errors.push({ field: 'host', message: 'missing host' })
  }

  if (!parsed.port || parsed.port < 1 || parsed.port > 65535) {
    errors.push({ field: 'port', message: 'invalid port' })
  }

  if (!SUPPORTED_SECURITY.includes(parsed.security as any)) {
    errors.push({ field: 'security', message: `unsupported security: "${parsed.security}"` })
  }

  if (!SUPPORTED_TRANSPORT.includes(parsed.type as any)) {
    errors.push({ field: 'type', message: `unsupported transport: "${parsed.type}"` })
  }

  if (parsed.security === 'reality') {
    if (!parsed.publicKey) {
      errors.push({ field: 'pbk', message: 'missing Reality public key' })
    }
    if (!parsed.shortId) {
      errors.push({ field: 'sid', message: 'missing Reality shortId' })
    }
    if (!parsed.sni) {
      errors.push({ field: 'sni', message: 'missing Reality SNI' })
    }
  }

  if (parsed.fingerprint && !SUPPORTED_FINGERPRINTS.includes(parsed.fingerprint as any)) {
    errors.push({ field: 'fp', message: `unsupported fingerprint: "${parsed.fingerprint}"` })
  }

  if (parsed.type === 'kcp' && parsed.extra && !SUPPORTED_KCP_TYPES.includes(parsed.extra as any)) {
    errors.push({ field: 'extra', message: `unsupported kcp type: "${parsed.extra}"` })
  }

  if (parsed.type === 'xhttp' && parsed.mode && !SUPPORTED_XHTTP_MODES.includes(parsed.mode as any)) {
    errors.push({ field: 'mode', message: `unsupported xhttp mode: "${parsed.mode}"` })
  }

  return errors
}

export function generateVlessOutbound(parsed: ParsedVlessUri): Record<string, unknown> {
  const fp = parsed.fingerprint || 'chrome'

  const user: Record<string, unknown> = {
    id: parsed.uuid,
    encryption: parsed.encryption,
  }
  if (parsed.flow) {
    user.flow = parsed.flow
  }

  const vnext: Record<string, unknown> = {
    address: parsed.host,
    port: parsed.port,
    users: [user],
  }

  const settings = { vnext: [vnext] }

  const streamSettings: Record<string, unknown> = {
    network: parsed.type,
  }

  if (parsed.security === 'tls') {
    streamSettings.security = 'tls'
    const tlsSettings: Record<string, unknown> = {}
    if (parsed.sni) tlsSettings.serverName = parsed.sni
    if (fp) tlsSettings.fingerprint = fp
    if (parsed.alpn.length > 0) tlsSettings.alpn = parsed.alpn
    streamSettings.tlsSettings = tlsSettings
  } else if (parsed.security === 'reality') {
    streamSettings.security = 'reality'
    const realitySettings: Record<string, unknown> = {}
    if (parsed.sni) realitySettings.serverName = parsed.sni
    if (parsed.publicKey) realitySettings.publicKey = parsed.publicKey
    if (parsed.shortId) realitySettings.shortId = parsed.shortId
    if (fp) realitySettings.fingerprint = fp
    if (parsed.spiderX) realitySettings.spiderX = parsed.spiderX
    streamSettings.realitySettings = realitySettings
  } else {
    streamSettings.security = 'none'
  }

  const transportSettings = buildTransportSettings(parsed)
  if (transportSettings) {
    Object.assign(streamSettings, transportSettings)
  }

  const outbound: Record<string, unknown> = {
    tag: 'proxy',
    protocol: 'vless',
    settings,
    streamSettings,
  }

  return outbound
}

function buildTransportSettings(parsed: ParsedVlessUri): Record<string, unknown> | null {
  switch (parsed.type) {
    case 'tcp': {
      const tcpSettings: Record<string, unknown> = {}
      return { tcpSettings }
    }
    case 'kcp': {
      const kcpSettings: Record<string, unknown> = {}
      if (parsed.extra) {
        kcpSettings.type = parsed.extra
      }
      return { kcpSettings }
    }
    case 'ws': {
      const wsSettings: Record<string, unknown> = {}
      if (parsed.path) wsSettings.path = parsed.path
      if (parsed.transportHost) {
        wsSettings.headers = { Host: parsed.transportHost }
      }
      return { wsSettings }
    }
    case 'http': {
      const httpSettings: Record<string, unknown> = {}
      if (parsed.path) httpSettings.path = parsed.path
      if (parsed.transportHost) {
        httpSettings.host = [parsed.transportHost]
      }
      return { httpSettings }
    }
    case 'grpc': {
      const grpcSettings: Record<string, unknown> = {}
      if (parsed.serviceName) grpcSettings.serviceName = parsed.serviceName
      return { grpcSettings }
    }
    case 'httpupgrade': {
      const httpupgradeSettings: Record<string, unknown> = {}
      if (parsed.path) httpupgradeSettings.path = parsed.path
      if (parsed.transportHost) httpupgradeSettings.host = parsed.transportHost
      return { httpupgradeSettings }
    }
    case 'xhttp': {
      const xhttpSettings: Record<string, unknown> = {}
      if (parsed.path) xhttpSettings.path = parsed.path
      if (parsed.mode) xhttpSettings.mode = parsed.mode
      if (parsed.extra) xhttpSettings.extra = parsed.extra
      return { xhttpSettings }
    }
    case 'raw': {
      const rawSettings: Record<string, unknown> = {}
      return { rawSettings }
    }
    default:
      return null
  }
}

export function applyOutboundToRoutingConfig(
  currentConfigJson: string,
  outboundJson: Record<string, unknown>,
): string {
  let config: Record<string, unknown>

  try {
    config = JSON.parse(currentConfigJson)
  } catch {
    config = {}
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    config = {}
  }

  if (!Array.isArray(config.outbounds)) {
    config.outbounds = []
  }

  const outbounds = config.outbounds as Record<string, unknown>[]
  const idx = outbounds.findIndex(
    (o) => o && typeof o === 'object' && (o as Record<string, unknown>).tag === 'proxy',
  )

  if (idx >= 0) {
    outbounds[idx] = outboundJson
  } else {
    outbounds.unshift(outboundJson)
  }

  return JSON.stringify(config, null, 2)
}

export function buildPreview(parsed: ParsedVlessUri): VlessPreview {
  return {
    server: parsed.host,
    port: parsed.port,
    transport: parsed.type,
    security: parsed.security,
    sni: parsed.sni || '-',
    fingerprint: parsed.fingerprint || '-',
    remark: parsed.remark || '-',
    uuid: parsed.uuid,
  }
}
