import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profilesApi } from '../api/profiles'
import type { Profile, YamlValidationResult } from '../types'
import { validateYaml } from '../utils/yamlValidator'
import { stripProfileFields } from '../utils/profileConfig'
import { checkTagUniqueness } from '../utils/tagValidator'
import { useDebounce } from '../utils/useDebounce'
import { useLanguage } from '../i18n/useLanguage'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Card, ErrorState, EmptyState, Skeleton } from '../components/ui/Misc'
import {
  MagnifyingGlassIcon,
  TrashIcon,
  PlusIcon,
  ArrowPathIcon,
  UserCircleIcon,
  ExclamationCircleIcon,
  QuestionMarkCircleIcon,
  DocumentTextIcon,
  RectangleStackIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

export default function Profiles() {
  const { t } = useLanguage()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editProfile, setEditProfile] = useState<Profile | null>(null)
  const [deleteProfile, setDeleteProfile] = useState<Profile | null>(null)
  const queryClient = useQueryClient()

  const { data: profiles, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['profiles-all'],
    queryFn: () => profilesApi.getAll().then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (tag: string) => profilesApi.delete(tag),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles-all'] })
      setDeleteProfile(null)
    },
  })

  const filtered = useMemo(() => {
    if (!profiles) return []
    const q = search.toLowerCase()
    return profiles.filter(
      (p) => p.name.toLowerCase().includes(q) || p.tag.toLowerCase().includes(q)
    )
  }, [profiles, search])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filterProfiles')}
            className="w-full h-9 bg-bg-tertiary border border-border rounded-md pl-9 pr-3 text-sm text-text-primary
              placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all"
          />
        </div>
        <span className="text-xs text-text-muted tabular-nums">{t('nProfiles', { n: filtered.length })}</span>
        <Button variant="secondary" onClick={() => refetch()}>
          <ArrowPathIcon className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="w-4 h-4" />
          {t('newProfile')}
        </Button>
      </div>

      {isError ? (
        <Card>
          <ErrorState
            message={(error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || t('failedToLoadProfiles')}
            onRetry={() => refetch()}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left bg-bg-tertiary/40">
                  <Th>{t('name')}</Th>
                  <Th>{t('tag')}</Th>
                  <Th>{t('configPreview')}</Th>
                  <Th className="text-right">{t('actions')}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-5 py-3"><Skeleton className="h-5 w-20 rounded" /></td>
                      <td className="px-5 py-3"><Skeleton className="h-4 w-full max-w-xs" /></td>
                      <td className="px-5 py-3"><Skeleton className="h-4 w-12 ml-auto" /></td>
                    </tr>
                  ))}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState
                        message={profiles?.length === 0 ? t('noProfilesList') : t('noMatchingProfiles')}
                        hint={profiles?.length === 0 ? t('createFirstProfile') : t('tryAdjustingSearch')}
                        icon={<UserCircleIcon className="w-6 h-6" />}
                        action={
                          profiles?.length === 0 ? (
                            <Button size="sm" onClick={() => setCreateOpen(true)}>
                              <PlusIcon className="w-4 h-4" />
                              {t('newProfile')}
                            </Button>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  filtered.map((profile) => (
                      <tr
                        key={profile.tag}
                        onClick={() => setEditProfile(profile)}
                        className="hover:bg-bg-hover transition-colors group cursor-pointer"
                      >
                      <td className="px-5 py-3">
                        <span className="text-sm text-text-primary font-medium">{profile.name}</span>
                      </td>
                      <td className="px-5 py-3">
                        <code className="text-xs font-mono text-accent bg-accent/10 px-2 py-0.5 rounded">{profile.tag}</code>
                      </td>
                      <td className="px-5 py-3 max-w-xs">
                        <span className="text-xs text-text-muted font-mono truncate block">{profile.profile.slice(0, 80)}…</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteProfile(profile)
                            }}
                            className="p-1.5 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                            title={t('delete')}
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateProfileModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditProfileModal profile={editProfile} onClose={() => setEditProfile(null)} />
      <ConfirmDialog
        open={!!deleteProfile}
        onClose={() => setDeleteProfile(null)}
        onConfirm={() => deleteProfile && deleteMutation.mutate(deleteProfile.tag)}
        title={t('deleteProfile')}
        message={t('deleteProfileConfirm', { tag: deleteProfile?.tag || '' })}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider ${className}`}>
      {children}
    </th>
  )
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

const EXAMPLES_CACHE_KEY = 'profile-examples-cache'
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

function FormError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5 text-sm text-danger">
      <ExclamationCircleIcon className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function ProfileHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage()
  return (
    <Modal open={open} onClose={onClose} title={t('howToCreateProfile')}>
      <div className="space-y-4 text-sm text-text-primary">
        <section>
          <p className="font-semibold text-text-primary mb-1">{t('whatIsProfile')}</p>
          <p className="text-text-secondary">
            {t('profileDescription')}
          </p>
        </section>
        <section>
          <p className="font-semibold text-text-primary mb-1">{t('howToCreateProfileDesc')}</p>
          <ol className="list-decimal list-inside space-y-1 text-text-secondary">
            <li>
              {t('createProfileStep1', { example: 'Germany - VP8' })}
            </li>
            <li>
              {t('createProfileStep2', { symbol: '-', example: 'de_vp8' })}
            </li>
            <li>
              {t('createProfileStep3', { button: t('createProfileButton') })}
            </li>
          </ol>
        </section>
        <section>
          <p className="font-semibold text-text-primary mb-1">{t('importantSettings')}</p>
          <ul className="space-y-1 text-text-secondary">
            <li>
              <code className="text-xs font-mono text-accent bg-accent/10 px-1 rounded">tag</code> — {t('tagWarning', { warning: t('doNotUse'), symbol: '-' })}
            </li>
            <li>
              <code className="text-xs font-mono text-accent bg-accent/10 px-1 rounded">room.id</code> — {t('roomIdHint')}
            </li>
            <li>
              <code className="text-xs font-mono text-accent bg-accent/10 px-1 rounded">net.transport</code> — {t('transportHint', { options: 'datachannel, vp8channel, seichannel, videochannel' })}
            </li>
          </ul>
        </section>
        <section className="bg-bg-tertiary rounded-lg px-3 py-2.5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t('minimumExample')}</p>
          <pre
            className="text-xs font-mono text-text-secondary leading-relaxed whitespace-pre"
          >{`auth:
      provider: jitsi
    room:
      id: "https://jitsi.example.org"
    net:
      transport: datachannel
      dns: "8.8.8.8:53"`}</pre>
        </section>

        <p className="text-xs text-text-muted">
          {t('editingProfileNote')}
        </p>
      </div>
    </Modal>
  )
}

function CreateProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [config, setConfig] = useState('')
  const [error, setError] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [examplesOpen, setExamplesOpen] = useState(false)
  const [yamlResult, setYamlResult] = useState<YamlValidationResult | null>(null)
  const [tagResult, setTagResult] = useState<{ valid: boolean; message?: string } | null>(null)
  const queryClient = useQueryClient()

  const debouncedTag = useDebounce(tag, 400)

  useEffect(() => {
    if (config.trim()) {
      setYamlResult(validateYaml(config))
    } else {
      setYamlResult(null)
    }
  }, [config])

  useEffect(() => {
    if (!debouncedTag.trim()) {
      setTagResult(null)
      return
    }
    checkTagUniqueness(debouncedTag).then(setTagResult)
  }, [debouncedTag])

  const mutation = useMutation({
    mutationFn: () => profilesApi.create({ name, tag, profile: config }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles-all'] })
      reset()
      onClose()
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err?.response?.data?.detail || t('failedToCreateProfile'))
    },
  })

  const reset = () => {
    setName('')
    setTag('')
    setConfig('')
    setError('')
    setYamlResult(null)
    setTagResult(null)
  }

  return (
    <>
      <Modal
        open={open}
        onClose={() => { reset(); onClose() }}
        title={t('createProfile')}
        description={t('addNewProfile')}
        wide
        headerAction={
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
      >
        <div className="space-y-4">
          {error && <FormError message={error} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('displayName')} />
            <Input label={t('tag')} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="unique_tag" error={tagResult?.valid === false ? tagResult.message : undefined} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">{t('yamlConfig')}</label>
              {yamlResult && (
                <span className={`text-xs font-medium flex items-center gap-1 ${
                  yamlResult.valid ? 'text-success' : 'text-warning'
                }`}>
                  {yamlResult.valid ? (
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                  ) : (
                    <XCircleIcon className="w-3.5 h-3.5" />
                  )}
                  {yamlResult.valid ? t('validConfig') : t('nIssues', { n: yamlResult.errors.length })}
                </span>
              )}
            </div>
            <textarea
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              onKeyDown={(e) => handleTextareaTab(e, config, setConfig)}
              placeholder={t('pasteYamlHere')}
              rows={16}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-2.5 text-sm text-text-primary leading-relaxed
                placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30
                font-mono resize-y transition-all"
              spellCheck={false}
            />
          </div>

          {yamlResult && !yamlResult.valid && yamlResult.errors.length > 0 && (
            <div className="bg-danger/5 border border-danger/15 rounded-lg px-3 py-2.5 space-y-1">
              <p className="text-xs font-semibold text-danger">{t('configValidationErrors')}:</p>
              <ul className="space-y-1">
                {yamlResult.errors.map((err, i) => (
                  <li key={i} className="text-xs text-danger flex gap-2">
                    <span className="shrink-0">-</span>
                    <span>{err.path ? <><strong>{err.path}:</strong> {err.message}</> : err.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {yamlResult && yamlResult.warnings.length > 0 && (
            <div className="bg-warning/5 border border-warning/15 rounded-lg px-3 py-2.5 space-y-1">
              <p className="text-xs font-semibold text-warning">{t('warnings')}:</p>
              <ul className="space-y-1">
                {yamlResult.warnings.map((warn, i) => (
                  <li key={i} className="text-xs text-warning flex gap-2">
                    <span className="shrink-0">-</span>
                    <span><strong>{warn.path}:</strong> {warn.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-between gap-2 pt-1">
            <Button variant="secondary" onClick={() => setExamplesOpen(true)}>
              <RectangleStackIcon className="w-4 h-4" />
              {t('profileExamples')}
            </Button>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { reset(); onClose() }}>
                {t('cancel')}
              </Button>
              <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
                {t('createProfileButton')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
      <ProfileHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ProfileExamplesModal
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
        onSelect={(yaml) => { setConfig(yaml); setExamplesOpen(false) }}
      />
    </>
  )
}

function EditProfileModal({ profile, onClose }: { profile: Profile | null; onClose: () => void }) {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [config, setConfig] = useState('')
  const [error, setError] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [examplesOpen, setExamplesOpen] = useState(false)
  const [yamlResult, setYamlResult] = useState<YamlValidationResult | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setConfig(stripProfileFields(profile.profile))
      setYamlResult(null)
      setError('')
    }
  }, [profile])

  useEffect(() => {
    if (config.trim()) {
      setYamlResult(validateYaml(config))
    } else {
      setYamlResult(null)
    }
  }, [config])

  const mutation = useMutation({
    mutationFn: () => profilesApi.update(profile!.tag, name, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles-all'] })
      setError('')
      onClose()
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err?.response?.data?.detail || t('failedToUpdateProfile'))
    },
  })

  if (!profile) return null

  return (
    <>
      <Modal
        open={!!profile}
        onClose={onClose}
        title={t('editProfile', { name: profile.name })}
        description={t('editProfileDesc', { tag: profile.tag })}
        wide
        headerAction={
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
      >
        <div className="space-y-4">
          {error && <FormError message={error} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('name')} value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">{t('tagReadOnly')}</label>
              <div className="h-9 flex items-center bg-bg-primary border border-border rounded-md px-3 text-sm font-mono text-text-muted">
                {profile.tag}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">{t('yamlConfig')}</label>
              {yamlResult ? (
                <span className={`text-xs font-medium flex items-center gap-1 ${
                  yamlResult.valid ? 'text-success' : 'text-warning'
                }`}>
                  {yamlResult.valid ? (
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                  ) : (
                    <XCircleIcon className="w-3.5 h-3.5" />
                  )}
                  {yamlResult.valid ? t('validConfig') : t('nIssues', { n: yamlResult.errors.length })}
                </span>
              ) : (
                <span className="text-xs text-text-muted tabular-nums">{t('nChars', { n: config.length })}</span>
              )}
            </div>
            <textarea
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              onKeyDown={(e) => handleTextareaTab(e, config, setConfig)}
              rows={18}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-2.5 text-sm text-text-primary leading-relaxed
                focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30
                font-mono resize-y transition-all"
              spellCheck={false}
            />
          </div>

          {yamlResult && !yamlResult.valid && yamlResult.errors.length > 0 && (
            <div className="bg-danger/5 border border-danger/15 rounded-lg px-3 py-2.5 space-y-1">
              <p className="text-xs font-semibold text-danger">{t('configValidationErrors')}:</p>
              <ul className="space-y-1">
                {yamlResult.errors.map((err, i) => (
                  <li key={i} className="text-xs text-danger flex gap-2">
                    <span className="shrink-0">-</span>
                    <span>{err.path ? <><strong>{err.path}:</strong> {err.message}</> : err.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {yamlResult && yamlResult.warnings.length > 0 && (
            <div className="bg-warning/5 border border-warning/15 rounded-lg px-3 py-2.5 space-y-1">
              <p className="text-xs font-semibold text-warning">{t('warnings')}:</p>
              <ul className="space-y-1">
                {yamlResult.warnings.map((warn, i) => (
                  <li key={i} className="text-xs text-warning flex gap-2">
                    <span className="shrink-0">-</span>
                    <span><strong>{warn.path}:</strong> {warn.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-between gap-2 pt-1">
            <Button variant="secondary" onClick={() => setExamplesOpen(true)}>
              <RectangleStackIcon className="w-4 h-4" />
              {t('profileExamples')}
            </Button>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { onClose() }}>{t('cancel')}</Button>
              <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>{t('saveChangesButton')}</Button>
            </div>
          </div>
        </div>
      </Modal>
      <ProfileExamplesModal
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
        onSelect={(yaml) => { setConfig(yaml); setExamplesOpen(false) }}
      />
      <ProfileHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}

function ProfileExamplesModal({ open, onClose, onSelect }: {
  open: boolean
  onClose: () => void
  onSelect: (yaml: string) => void
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

    fetch('https://api.github.com/repos/invdevv/olcWave/contents/docs/config_examples?ref=main')
      .then((res) => {
        if (!res.ok) throw new Error(`GitHub API error (${res.status})`)
        return res.json()
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('Invalid response from GitHub')
        const yamlFiles = data
          .filter((f: any) => f.type === 'file' && f.download_url && /\.(yaml|yml)$/i.test(f.name))
          .map((f: any) => ({ name: f.name, download_url: f.download_url }))
        setFiles(yamlFiles)
        setExamplesCache(yamlFiles, {})
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
      const yaml = await res.text()

      const cache = getExamplesCache()
      if (cache) {
        cache.contents[file.download_url] = yaml
        setExamplesCache(cache.files, cache.contents)
      }

      onSelect(yaml)
    } catch (err) {
      setError((err as Error).message || t('failedToLoadFile', { filename: file.name }))
    } finally {
      setLoadFile(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('profileExamplesTitle')}>
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
