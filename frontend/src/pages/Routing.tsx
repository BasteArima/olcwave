import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { routingApi, type GeotagsResponse } from '../api/routing'
import { validateRoutingJson, stripRoutingFields, type RoutingValidationResult } from '../utils/routingValidator'
import { useDebounce } from '../utils/useDebounce'
import { useLanguage } from '../i18n/useLanguage'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Card, CardHeader, Skeleton } from '../components/ui/Misc'
import { ToastContainer } from '../components/containers/Toast'
import { useToasts } from '../components/containers/useToasts'
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  QuestionMarkCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

const EXAMPLES_CACHE_KEY = 'routing-examples-cache'
const EXAMPLES_CACHE_TTL = 10 * 60 * 1000

interface ExamplesCache {
  timestamp: number
  files: { name: string; download_url: string }[]
  contents: Record<string, string>
}

function getExamplesCache(): ExamplesCache | null {
  try {
    const raw = localStorage.getItem(EXAMPLES_CACHE_KEY)
    if (!raw) return null
    const data: ExamplesCache = JSON.parse(raw)
    if (!data.timestamp || !Array.isArray(data.files)) return null
    if (Date.now() - data.timestamp > EXAMPLES_CACHE_TTL) return null
    return data
  } catch {
    return null
  }
}

function setExamplesCache(files: ExamplesCache['files'], contents: ExamplesCache['contents']) {
  localStorage.setItem(EXAMPLES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), files, contents }))
}

function handleTextareaTab(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (v: string) => void,
) {
  if (e.key !== 'Tab' || e.shiftKey) return
  e.preventDefault()
  const ta = e.currentTarget
  const start = ta.selectionStart
  const end = ta.selectionEnd
  onChange(value.slice(0, start) + '  ' + value.slice(end))
  requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2 })
}

function ValidationStatus({ result }: { result: RoutingValidationResult | null }) {
  const { t } = useLanguage()
  if (!result) return null

  const hasWarnings = result.warnings.length > 0
  const statusClass = result.valid
    ? hasWarnings ? 'text-warning' : 'text-success'
    : 'text-danger'

  return (
    <span className={`text-xs font-medium flex items-center gap-1 ${statusClass}`}>
      {result.valid ? (
        hasWarnings ? (
          <ExclamationTriangleIcon className="w-3.5 h-3.5" />
        ) : (
          <CheckCircleIcon className="w-3.5 h-3.5" />
        )
      ) : (
        <XCircleIcon className="w-3.5 h-3.5" />
      )}
      {result.valid ? t('validRoutingConfig') : t('invalidRoutingConfig')}
    </span>
  )
}

function ValidationErrors({ result }: { result: RoutingValidationResult | null }) {
  const { t } = useLanguage()
  if (!result) return null

  return (
    <div className="space-y-2">
      {result.errors.length > 0 && (
        <div className="bg-danger/5 border border-danger/15 rounded-lg px-3 py-2.5 space-y-1">
          <p className="text-xs font-semibold text-danger">{t('validationErrors')}:</p>
          <ul className="space-y-1">
            {result.errors.map((err, i) => (
              <li key={i} className="text-xs text-danger flex gap-2">
                <span className="shrink-0">-</span>
                <span>{err.path ? <><strong>{err.path}:</strong> {err.message}</> : err.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="bg-warning/5 border border-warning/15 rounded-lg px-3 py-2.5 space-y-1">
          <p className="text-xs font-semibold text-warning">{t('warnings')}:</p>
          <ul className="space-y-1">
            {result.warnings.map((warn, i) => (
              <li key={i} className="text-xs text-warning flex gap-2">
                <span className="shrink-0">-</span>
                <span>{warn.path ? <><strong>{warn.path}</strong> {warn.message}</> : warn.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function Routing() {
  const { t } = useLanguage()
  const { toasts, dismiss, success, error: toastError } = useToasts()
  const queryClient = useQueryClient()

  const [confirmDisable, setConfirmDisable] = useState(false)
  const [configuring, setConfiguring] = useState(false)

  const { data: enabled, isLoading: enabledLoading } = useQuery({
    queryKey: ['routing-enabled'],
    queryFn: () => routingApi.isEnabled().then((r) => r.data),
  })

  const { data: serverConfig, isLoading: configLoading } = useQuery({
    queryKey: ['routing-config'],
    queryFn: () => routingApi.getConfig().then((r) => r.data),
    enabled: enabled === true,
  })

  const { data: geotags } = useQuery({
    queryKey: ['routing-geotags'],
    queryFn: () => routingApi.getGeotags().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const [editorConfig, setEditorConfig] = useState('')
  const [validation, setValidation] = useState<RoutingValidationResult | null>(null)

  useEffect(() => {
    if (serverConfig !== undefined) {
      setEditorConfig(stripRoutingFields(serverConfig))
      setConfiguring(false)
    }
  }, [serverConfig])

  useEffect(() => {
    if (editorConfig.trim()) {
      setValidation(validateRoutingJson(editorConfig, geotags))
    } else {
      setValidation(null)
    }
  }, [editorConfig, geotags])

  const createMutation = useMutation({
    mutationFn: (xrayJson: string) => routingApi.create(xrayJson),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing-enabled'] })
      queryClient.invalidateQueries({ queryKey: ['routing-config'] })
      success(t('routingEnabled'))
      setConfirmDisable(false)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toastError(err?.response?.data?.detail || t('failedToEnableRouting'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: (xrayJson: string) => routingApi.update(xrayJson),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing-config'] })
      success(t('routingConfigSaved'))
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toastError(err?.response?.data?.detail || t('failedToSaveRoutingConfig'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => routingApi.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing-enabled'] })
      queryClient.invalidateQueries({ queryKey: ['routing-config'] })
      success(t('routingDisabled'))
      setConfirmDisable(false)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toastError(err?.response?.data?.detail || t('failedToDisableRouting'))
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending
  const isFirstTime = configuring && !serverConfig
  const isDirty = editorConfig !== (serverConfig ?? '')
  const canSave = validation?.valid === true && isDirty && !isSaving

  const handleSave = () => {
    if (!canSave) return
    const currentValidation = validateRoutingJson(editorConfig, geotags)
    if (!currentValidation.valid) {
      setValidation(currentValidation)
      return
    }
    if (isFirstTime) {
      createMutation.mutate(editorConfig)
    } else {
      updateMutation.mutate(editorConfig)
    }
  }

  const handleEnable = () => {
    setConfiguring(true)
    setEditorConfig('')
    setValidation(null)
  }

  const handleDisable = () => {
    setConfirmDisable(true)
  }

  const handleConfirmDisable = () => {
    deleteMutation.mutate()
  }

  const isLoading = enabledLoading || (enabled && configLoading)

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-5">
        <Card>
          <div className="px-5 py-4 space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-9 w-full" />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-5">
      {enabled ? (
        <EditorSection
          config={editorConfig}
          onChange={setEditorConfig}
          validation={validation}
          geotags={geotags}
          canSave={canSave}
          isSaving={isSaving}
          onSave={handleSave}
          onDisable={handleDisable}
        />
      ) : (
        <EnableSection onEnable={handleEnable} isConfiguring={configuring} />
      )}

      {configuring && (
        <ConfiguringSection
          config={editorConfig}
          onChange={setEditorConfig}
          validation={validation}
          geotags={geotags}
          canSave={canSave}
          isSaving={isSaving}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={confirmDisable}
        onClose={() => setConfirmDisable(false)}
        onConfirm={handleConfirmDisable}
        title={t('disableRoutingTitle')}
        message={t('disableRoutingMessage')}
        confirmLabel={t('disable')}
        loading={deleteMutation.isPending}
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

function EnableSection({ onEnable, isConfiguring }: { onEnable: () => void; isConfiguring: boolean }) {
  const { t } = useLanguage()
  return (
    <Card>
      <CardHeader title={t('routing')} />
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-text-primary">{t('enableRouting')}</p>
            <p className="text-xs text-text-muted mt-0.5">{t('experimentalWarning')}</p>
          </div>
          <button
            onClick={onEnable}
            disabled={isConfiguring}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
              transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
              disabled:opacity-50 disabled:cursor-default
              ${isConfiguring ? 'bg-accent' : 'bg-bg-tertiary'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0
                transition-transform duration-200 ease-in-out
                ${isConfiguring ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>
    </Card>
  )
}

function GeotagsSearchModal({ open, onClose, geotags }: {
  open: boolean
  onClose: () => void
  geotags?: GeotagsResponse
}) {
  const { t } = useLanguage()
  const [tab, setTab] = useState<'geoip' | 'geosite'>('geoip')
  const [search, setSearch] = useState('')
  const [copiedTag, setCopiedTag] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 150)

  const tags = useMemo(() => {
    if (!geotags) return []
    const list = tab === 'geoip' ? geotags.geoip : geotags.geosite
    if (!debouncedSearch.trim()) return list
    const q = debouncedSearch.toLowerCase()
    return list.filter((tag) => tag.includes(q))
  }, [geotags, tab, debouncedSearch])

  useEffect(() => {
    if (open) {
      setSearch('')
      setCopiedTag(null)
    }
  }, [open])

  const handleCopy = async (code: string) => {
    const value = `${tab}:${code}`
    try {
      await navigator.clipboard.writeText(value)
      setCopiedTag(code)
      setTimeout(() => setCopiedTag(null), 1200)
    } catch {
      /* clipboard not available */
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('searchGeoSite')}>
      <div className="space-y-3">
        <div className="flex rounded-lg bg-bg-tertiary p-0.5">
          {(['geoip', 'geosite'] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer
                ${tab === tabKey ? 'bg-bg-secondary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              {tabKey === 'geoip' ? t('geoip') : t('geosite')}
            </button>
          ))}
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchTagsPlaceholder', { tab: tab === 'geoip' ? t('geoip') : t('geosite') })}
            className="w-full h-9 bg-bg-tertiary border border-border rounded-md pl-8 pr-3 text-sm text-text-primary
              placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>

        {!geotags && (
          <p className="text-xs text-text-muted text-center py-6">{t('loadingAvailableTags')}</p>
        )}

        {geotags && tags.length === 0 && (
          <p className="text-xs text-text-muted text-center py-6">
            {debouncedSearch ? t('noTagsMatchSearch') : t('noTagsAvailable')}
          </p>
        )}

        {geotags && tags.length > 0 && (
          <div className="max-h-72 overflow-y-auto -mx-1 space-y-0.5">
            {tags.map((code) => (
              <button
                key={code}
                onClick={() => handleCopy(code)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-mono
                  hover:bg-bg-hover transition-colors cursor-pointer flex items-center justify-between gap-3"
              >
                <span className="text-text-primary">{tab}:{code}</span>
                {copiedTag === code ? (
                  <span className="text-xs text-success font-sans">{t('copiedExclamation')}</span>
                ) : (
                  <span className="text-xs text-text-muted font-sans">{t('clickToCopy')}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

function ConfiguringSection({
  config, onChange, validation, geotags, canSave, isSaving, onSave,
}: {
  config: string
  onChange: (v: string) => void
  validation: RoutingValidationResult | null
  geotags?: GeotagsResponse
  canSave: boolean
  isSaving: boolean
  onSave: () => void
}) {
  const { t } = useLanguage()
  const [helpOpen, setHelpOpen] = useState(false)
  const [examplesOpen, setExamplesOpen] = useState(false)
  const [geotagsOpen, setGeotagsOpen] = useState(false)

  return (
    <>
      <Card>
        <CardHeader
          title={t('xrayRoutingConfig')}
          action={
            <button
              onClick={() => setHelpOpen(true)}
              title={t('help')}
              className="
                flex h-9 w-9 items-center justify-center
                rounded-md
                border border-[rgba(130,201,30,0.3)]
                bg-[linear-gradient(135deg,rgba(130,201,30,0.15)_0%,rgba(116,184,22,0.1)_100%)]
                text-lime-400
                transition-colors duration-150
                hover:bg-[rgba(169,227,75,0.1)]
                active:scale-95
                focus:outline-none
                cursor-pointer
              "
            >
              <QuestionMarkCircleIcon className="h-5 w-5" />
            </button>
          }
        />
        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">{t('jsonConfig')}</label>
              <ValidationStatus result={validation} />
            </div>
            <textarea
              value={config}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => handleTextareaTab(e, config, onChange)}
              placeholder={t('pasteRoutingHere')}
              rows={20}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-2.5 text-sm text-text-primary leading-relaxed
                placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30
                font-mono resize-y transition-all"
              spellCheck={false}
            />
          </div>

          <ValidationErrors result={validation} />

          <div className="flex justify-between gap-2 pt-1">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setExamplesOpen(true)}>
                <DocumentTextIcon className="w-4 h-4" />
                {t('examples')}
              </Button>
              <Button variant="secondary" onClick={() => setGeotagsOpen(true)}>
                <MagnifyingGlassIcon className="w-4 h-4" />
                {t('searchTags')}
              </Button>
            </div>

            <Button loading={isSaving} disabled={!canSave} onClick={onSave}>
              {t('saveAndEnable')}
            </Button>
          </div>
        </div>
      </Card>

      <RoutingHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <RoutingExamplesModal
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
        onSelect={(json) => { onChange(json); setExamplesOpen(false) }}
      />
      <GeotagsSearchModal
        open={geotagsOpen}
        onClose={() => setGeotagsOpen(false)}
        geotags={geotags}
      />
    </>
  )
}

function EditorSection({
  config, onChange, validation, geotags, canSave, isSaving, onSave, onDisable,
}: {
  config: string
  onChange: (v: string) => void
  validation: RoutingValidationResult | null
  geotags?: GeotagsResponse
  canSave: boolean
  isSaving: boolean
  onSave: () => void
  onDisable: () => void
}) {
  const { t } = useLanguage()
  const [helpOpen, setHelpOpen] = useState(false)
  const [examplesOpen, setExamplesOpen] = useState(false)
  const [geotagsOpen, setGeotagsOpen] = useState(false)

  return (
    <>
      <Card>
        <CardHeader
          title={t('routing')}
          action={
            <div className="flex items-center gap-3">
              <button
              onClick={() => setHelpOpen(true)}
              title={t('help')}
              className="
                flex h-9 w-9 items-center justify-center
                rounded-md
                border border-[rgba(130,201,30,0.3)]
                bg-[linear-gradient(135deg,rgba(130,201,30,0.15)_0%,rgba(116,184,22,0.1)_100%)]
                text-lime-400
                transition-colors duration-150
                hover:bg-[rgba(169,227,75,0.1)]
                active:scale-95
                focus:outline-none
                cursor-pointer
              "
            >
              <QuestionMarkCircleIcon className="h-5 w-5" />
            </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">{t('disableRouting')}</span>
                <button
                  onClick={onDisable}
                  className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                    bg-accent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0
                    translate-x-5 transition-transform duration-200 ease-in-out" />
                </button>
              </div>
            </div>
          }
        />
        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">{t('jsonConfig')}</label>
              <ValidationStatus result={validation} />
            </div>
            <textarea
              value={config}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => handleTextareaTab(e, config, onChange)}
              placeholder={t('pasteRoutingHere')}
              rows={20}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-2.5 text-sm text-text-primary leading-relaxed
                placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30
                font-mono resize-y transition-all"
              spellCheck={false}
            />
          </div>

          <ValidationErrors result={validation} />

          <div className="flex justify-between gap-2 pt-1">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setExamplesOpen(true)}>
                <DocumentTextIcon className="w-4 h-4" />
                {t('examples')}
              </Button>
              <Button variant="secondary" onClick={() => setGeotagsOpen(true)}>
                <MagnifyingGlassIcon className="w-4 h-4" />
                {t('searchTags')}
              </Button>
            </div>

            <Button loading={isSaving} disabled={!canSave} onClick={onSave}>
              {t('save')}
            </Button>
          </div>
        </div>
      </Card>

      <RoutingHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <RoutingExamplesModal
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
        onSelect={(json) => { onChange(json); setExamplesOpen(false) }}
      />
      <GeotagsSearchModal
        open={geotagsOpen}
        onClose={() => setGeotagsOpen(false)}
        geotags={geotags}
      />
    </>
  )
}

function RoutingHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage()
  return (
    <Modal open={open} onClose={onClose} title={t('routingHelpTitle')}>
      <div className="space-y-4 text-sm text-text-primary">
        <section>
          <p className="font-semibold text-text-primary mb-1">{t('whatIsRouting')}</p>
          <p className="text-text-secondary">{t('routingDescription')}</p>
        </section>
        <section>
          <p className="font-semibold text-text-primary mb-1">{t('requiredStructure')}</p>
          <ul className="space-y-1 text-text-secondary">
            <li><code className="text-xs font-mono text-accent bg-accent/10 px-1 rounded">routing.rules</code> — {t('routingStructureRules')}</li>
            <li><code className="text-xs font-mono text-accent bg-accent/10 px-1 rounded">outbounds</code> — {t('routingStructureOutbounds')}</li>
          </ul>
        </section>
        <section>
          <p className="text-text-secondary">{t('routingNote', { dns: 'dns', inbounds: 'inbounds' })}</p>
        </section>
        <section className="bg-bg-tertiary rounded-lg px-3 py-2.5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t('minimalExample')}</p>
          <pre className="text-xs font-mono text-text-secondary leading-relaxed whitespace-pre">{`{
  "routing": {
    "rules": [
      {
        "ip": ["geoip:private"],
        "outboundTag": "block"
      }
    ]
  },
  "outbounds": [
    { "tag": "direct", "protocol": "freedom" },
    { "tag": "block", "protocol": "blackhole" }
  ]
}`}</pre>
        </section>
      </div>
    </Modal>
  )
}

function RoutingExamplesModal({ open, onClose, onSelect }: {
  open: boolean
  onClose: () => void
  onSelect: (json: string) => void
}) {
  const { t } = useLanguage()
  const [files, setFiles] = useState<{ name: string; download_url: string }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadFile, setLoadFile] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    const cached = getExamplesCache()
    if (cached) {
      setFiles(cached.files)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    setFiles(null)

    fetch('https://api.github.com/repos/invdevv/olcWave/contents/docs/routing_examples?ref=main')
      .then((res) => {
        if (!res.ok) throw new Error(`GitHub API error (${res.status})`)
        return res.json()
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('Invalid response from GitHub')
        const jsonFiles = data
          .filter((f: any) => f.type === 'file' && f.download_url && /\.json$/i.test(f.name))
          .map((f: any) => ({ name: f.name, download_url: f.download_url }))
        setFiles(jsonFiles)
        setExamplesCache(jsonFiles, {})
        setLoading(false)
      })
      .catch((err) => {
        setError((err as Error).message || t('failedToLoadExamples'))
        setLoading(false)
      })
  }, [open])

  const handleFileClick = async (file: { name: string; download_url: string }) => {
    const cached = getExamplesCache()
    if (cached && cached.contents[file.download_url]) {
      onSelect(cached.contents[file.download_url])
      return
    }

    setLoadFile(file.name)
    setError(null)
    try {
      const res = await fetch(file.download_url)
      if (!res.ok) throw new Error(t('failedToLoadFile', { filename: file.name }))
      const json = await res.text()

      const cache = getExamplesCache()
      if (cache) {
        cache.contents[file.download_url] = json
        setExamplesCache(cache.files, cache.contents)
      }

      onSelect(json)
    } catch (err) {
      setError((err as Error).message || t('failedToLoadFile', { filename: file.name }))
    } finally {
      setLoadFile(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('routingExamplesTitle')}>
      <div className="space-y-2 min-h-[200px]">
        {loading && (
          <div className="flex flex-col items-center py-12">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-text-muted">{t('loadingExamples')}</p>
          </div>
        )}

        {!loading && error && files === null && (
          <div className="flex flex-col items-center py-12 px-4 text-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-danger/10 text-danger mb-3">
              <ExclamationTriangleIcon className="w-5 h-5" />
            </div>
            <p className="text-sm text-text-primary font-medium">{t('failedToLoadExamples')}</p>
            <p className="text-xs text-text-muted mt-1">{error}</p>
          </div>
        )}

        {!loading && files !== null && files.length === 0 && (
          <div className="flex flex-col items-center py-12">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-bg-tertiary text-text-muted mb-3">
              <DocumentTextIcon className="w-5 h-5" />
            </div>
            <p className="text-sm text-text-secondary">{t('noExampleFilesFound')}</p>
          </div>
        )}

        {!loading && files !== null && files.length > 0 && (
          <div>
            {error && (
              <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-xs text-danger mb-3">
                <ExclamationTriangleIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="max-h-80 overflow-y-auto -mx-1 space-y-0.5">
              {files.map((file) => (
                <button
                  key={file.download_url}
                  onClick={() => handleFileClick(file)}
                  disabled={loadFile === file.name}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-text-primary
                    hover:bg-bg-hover transition-colors cursor-pointer disabled:opacity-50
                    disabled:cursor-default flex items-center gap-3"
                >
                  {loadFile === file.name ? (
                    <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : (
                    <DocumentTextIcon className="w-4 h-4 text-text-muted shrink-0" />
                  )}
                  <span className="font-mono text-xs">{file.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
