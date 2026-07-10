'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DirectoryPicker } from '@/components/directory-picker'
import {
  Copy,
  Loader2,
  Settings,
  GitBranch,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RotateCcw,
  Webhook,
} from 'lucide-react'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import type { WebhookProvider } from '@/lib/data/webhooks'

interface Project {
  id: string
  name: string
  path: string
  buildCommand: string
  deployCommand?: string
  gitUrl?: string
  gitBranch?: string
  gitPullBeforeBuild?: boolean
  outputPaths?: string[]
  gitCredentialId?: string
}

interface GitCredential {
  id: string
  name: string
  type: 'https' | 'ssh'
}

interface ProjectFormProps {
  project?: Project
  mode: 'create' | 'edit'
  formId?: string
  initialWorkDir: string
  initialCredentials: GitCredential[]
  onLoadingChange?: (loading: boolean) => void
}

function generateSecret() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

function providerLabel(provider: WebhookProvider) {
  return provider === 'github' ? 'GitHub' : 'Codeup'
}

export function ProjectForm({
  project,
  mode,
  formId = 'project-form',
  initialWorkDir,
  initialCredentials,
  onLoadingChange,
}: ProjectFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('projectForm')
  const settingsHref = `/settings?from=${encodeURIComponent(pathname)}`
  const [, setLoadingState] = useState(false)

  const setLoading = (value: boolean) => {
    setLoadingState(value)
    onLoadingChange?.(value)
  }
  const [cloning, setCloning] = useState(false)
  const [error, setError] = useState('')
  const [cloneSuccess, setCloneSuccess] = useState(false)

  const workDir = initialWorkDir
  const credentials = initialCredentials

  const [name, setName] = useState(project?.name || '')
  const [relativePath, setRelativePath] = useState(
    project?.path?.replace(/\\/g, '/') || '',
  )
  const [buildCommand, setBuildCommand] = useState(
    project?.buildCommand || 'ni\nnr build',
  )
  const [gitPullBeforeBuild, setGitPullBeforeBuild] = useState(
    project?.gitPullBeforeBuild || false,
  )
  const [outputPaths, setOutputPaths] = useState(
    project?.outputPaths?.join('\n') || 'dist',
  )
  const [deployCommand, setDeployCommand] = useState(
    project?.deployCommand || '',
  )

  const [showCloneOptions, setShowCloneOptions] = useState(false)
  const [gitUrl, setGitUrl] = useState('')
  const [gitBranch, setGitBranch] = useState('main')
  const [gitCredentialId, setGitCredentialId] = useState(
    project?.gitCredentialId || '',
  )
  const [webhookEnabled, setWebhookEnabled] = useState(false)
  const [webhookId] = useState(() => crypto.randomUUID())
  const [webhookName, setWebhookName] = useState('')
  const [webhookProvider, setWebhookProvider] =
    useState<WebhookProvider>('github')
  const [webhookBranch, setWebhookBranch] = useState('main')
  const [webhookSecret, setWebhookSecret] = useState(() => generateSecret())

  const endpointFor = (id: string) => {
    if (typeof window === 'undefined') return `/api/webhooks/${id}`
    return `${window.location.origin}/api/webhooks/${id}`
  }

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value)
    toast.success(t('copied'))
  }

  const getRepoNameFromUrl = (url: string): string => {
    const parts = url.replace(/\.git$/, '').split('/')
    return parts[parts.length - 1] || ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const parsedOutputPaths = outputPaths
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    try {
      const url =
        mode === 'create' ? '/api/projects' : `/api/projects/${project?.id}`
      const method = mode === 'create' ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          path: relativePath,
          buildCommand,
          deployCommand: deployCommand.trim() || undefined,
          gitPullBeforeBuild,
          outputPaths:
            parsedOutputPaths.length > 0 ? parsedOutputPaths : undefined,
          gitCredentialId: gitCredentialId || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save project')
      }

      const savedProject = (await res.json()) as Project

      if (mode === 'create' && webhookEnabled) {
        const webhookRes = await fetch('/api/webhooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: webhookId,
            name:
              webhookName.trim() ||
              `${savedProject.name || name || 'Project'} ${providerLabel(webhookProvider)} webhook`,
            provider: webhookProvider,
            projectId: savedProject.id,
            branch: webhookBranch.trim(),
            secret: webhookSecret.trim(),
            enabled: true,
          }),
        })

        if (!webhookRes.ok) {
          const data = (await webhookRes.json().catch(() => null)) as {
            error?: string
          } | null
          toast.error(
            `${t('projectSavedWebhookFailed')}${data?.error ? `: ${data.error}` : ''}`,
          )
          router.push(`/projects/${savedProject.id}/edit`)
          router.refresh()
          return
        }

        toast.success(t('webhookSaved'))
        router.push(`/projects/${savedProject.id}/edit`)
        router.refresh()
        return
      }

      router.push('/projects')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleGitClone = async () => {
    if (!gitUrl) {
      setError(t('enterGitUrl'))
      return
    }

    const repoName = getRepoNameFromUrl(gitUrl)
    if (!repoName) {
      setError(t('cannotParseRepoName'))
      return
    }

    setCloning(true)
    setError('')
    setCloneSuccess(false)

    try {
      const res = await fetch('/api/git/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gitUrl,
          targetPath: repoName,
          branch: gitBranch || undefined,
          credentialId: gitCredentialId || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Git clone failed')
      }

      setCloneSuccess(true)
      setRelativePath(repoName)
      setShowCloneOptions(false)
      setGitPullBeforeBuild(true)
      setWebhookName((current) => current || `${repoName} webhook`)
      setWebhookBranch(gitBranch || 'main')

      if (!name) {
        setName(repoName)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCloning(false)
    }
  }

  const handleDirectorySelect = (path: string) => {
    setRelativePath(path)
    if (!name && path) {
      const dirName = path.split('/').pop() || ''
      setName(dirName)
    }
  }

  if (!workDir) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="text-muted-foreground mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-semibold">{t('workDirRequired')}</h3>
          <p className="text-muted-foreground mb-6 max-w-sm text-center text-sm">
            {t('workDirRequiredDesc')}
          </p>
          <Button asChild>
            <Link href={settingsHref}>
              <Settings className="mr-2 h-4 w-4" />
              {t('goToSettings')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <form id={formId} onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="path">{t('projectDir')}</Label>
            <div className="flex gap-2">
              <Input
                id="path"
                value={relativePath}
                onChange={(e) => setRelativePath(e.target.value)}
                placeholder={t('projectDirPlaceholder')}
                required
                className="flex-1 font-mono"
              />
              <DirectoryPicker
                value={relativePath}
                onChange={handleDirectorySelect}
              />
            </div>
          </div>

          {mode === 'create' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-dashed" />
                </div>
                <div className="relative flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowCloneOptions(!showCloneOptions)}
                    className="bg-card text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 text-xs transition-colors"
                  >
                    <GitBranch className="h-3 w-3" />
                    {showCloneOptions ? t('collapseClone') : t('expandClone')}
                    {showCloneOptions ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>

              {showCloneOptions && (
                <div className="bg-muted/30 space-y-4 rounded-lg p-4">
                  <div className="space-y-2">
                    <Label htmlFor="gitUrl">{t('gitUrl')}</Label>
                    <Input
                      id="gitUrl"
                      value={gitUrl}
                      onChange={(e) => setGitUrl(e.target.value)}
                      placeholder="https://github.com/user/repo.git"
                    />
                    {gitUrl && (
                      <p className="text-muted-foreground text-xs">
                        {t('cloneTo')}:{' '}
                        <code className="bg-muted rounded px-1">
                          {getRepoNameFromUrl(gitUrl)}
                        </code>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('gitCredential')}</Label>
                      {credentials.length > 0 ? (
                        <Select
                          value={gitCredentialId || '_none'}
                          onValueChange={(v) =>
                            setGitCredentialId(
                              v === '_none' || v === null ? '' : v,
                            )
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('selectCredential')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">
                              {t('publicRepo')}
                            </SelectItem>
                            {credentials.map((cred) => (
                              <SelectItem key={cred.id} value={cred.id}>
                                {cred.name} ({cred.type.toUpperCase()})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex h-9 items-center justify-between rounded-md border border-dashed p-2">
                          <span className="text-muted-foreground text-xs">
                            {t('publicRepoCanClone')}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            asChild
                          >
                            <Link href={settingsHref}>
                              <Settings className="mr-1 h-3 w-3" />
                              {t('configure')}
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gitBranch">{t('branch')}</Label>
                      <Input
                        id="gitBranch"
                        value={gitBranch}
                        onChange={(e) => setGitBranch(e.target.value)}
                        placeholder="main"
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant={cloneSuccess ? 'outline' : 'default'}
                    onClick={handleGitClone}
                    disabled={cloning || !gitUrl}
                    className="w-full"
                  >
                    {cloning ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('cloning')}
                      </>
                    ) : cloneSuccess ? (
                      `✓ ${t('cloneSuccess')}`
                    ) : (
                      t('cloneRepo')
                    )}
                  </Button>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">{t('projectName')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="buildCommand">{t('buildCommand')}</Label>
            <Textarea
              id="buildCommand"
              value={buildCommand}
              onChange={(e) => setBuildCommand(e.target.value)}
              placeholder={
                'pnpm install\npnpm build\n# 多目录:\ncd packages/app\nbun install\nbun build'
              }
              rows={4}
              required
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              {t('buildCommandHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="outputPaths">{t('outputPaths')}</Label>
            <Textarea
              id="outputPaths"
              value={outputPaths}
              onChange={(e) => setOutputPaths(e.target.value)}
              placeholder={'dist\n**/*.dmg'}
              rows={2}
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              {t('outputPathsHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deployCommand">{t('deployCommand')}</Label>
            <Textarea
              id="deployCommand"
              value={deployCommand}
              onChange={(e) => setDeployCommand(e.target.value)}
              placeholder={
                'rsync -av dist/ deploy@server:/var/www/app/\nssh deploy@server "systemctl reload nginx"'
              }
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              {t('deployCommandHint')}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="gitPull" className="text-sm font-medium">
                {t('gitPullBeforeBuild')}
              </Label>
              <p className="text-muted-foreground text-xs">
                {t('gitPullHint')}
              </p>
            </div>
            <Switch
              id="gitPull"
              checked={gitPullBeforeBuild}
              onCheckedChange={setGitPullBeforeBuild}
            />
          </div>

          {gitPullBeforeBuild && (
            <div className="space-y-2">
              <Label>{t('gitCredential')}</Label>
              {credentials.length > 0 ? (
                <Select
                  value={gitCredentialId || '_none'}
                  onValueChange={(v) =>
                    setGitCredentialId(v === '_none' || v === null ? '' : v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('selectCredential')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t('noCredential')}</SelectItem>
                    {credentials.map((cred) => (
                      <SelectItem key={cred.id} value={cred.id}>
                        {cred.name} ({cred.type.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center justify-between rounded-md border border-dashed p-3">
                  <p className="text-muted-foreground text-sm">
                    {t('noCredentialHint')}
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={settingsHref}>
                      <Settings className="mr-1 h-3 w-3" />
                      {t('goToConfigure')}
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}

          {mode === 'create' && (
            <div className="space-y-4 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="webhookEnabled"
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    <Webhook className="h-4 w-4" />
                    {t('enableWebhook')}
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    {t('enableWebhookHint')}
                  </p>
                </div>
                <Switch
                  id="webhookEnabled"
                  checked={webhookEnabled}
                  onCheckedChange={setWebhookEnabled}
                />
              </div>

              {webhookEnabled && (
                <div className="space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhookName">{t('webhookName')}</Label>
                    <Input
                      id="webhookName"
                      value={webhookName}
                      onChange={(event) => setWebhookName(event.target.value)}
                      placeholder={
                        name
                          ? `${name} ${providerLabel(webhookProvider)} webhook`
                          : t('webhookNamePlaceholder')
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('webhookProvider')}</Label>
                      <Select
                        value={webhookProvider}
                        onValueChange={(value) =>
                          setWebhookProvider(value as WebhookProvider)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="github">GitHub</SelectItem>
                          <SelectItem value="codeup">Codeup</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="webhookBranch">
                        {t('webhookBranch')}
                      </Label>
                      <Input
                        id="webhookBranch"
                        value={webhookBranch}
                        onChange={(event) =>
                          setWebhookBranch(event.target.value)
                        }
                        placeholder={t('webhookBranchPlaceholder')}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webhookSecret">{t('webhookSecret')}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="webhookSecret"
                        value={webhookSecret}
                        onChange={(event) =>
                          setWebhookSecret(event.target.value)
                        }
                        className="font-mono text-xs"
                        required={webhookEnabled}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title={t('regenerateSecret')}
                        onClick={() => setWebhookSecret(generateSecret())}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title={t('copySecret')}
                        onClick={() => copy(webhookSecret)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {webhookProvider === 'github'
                        ? t('githubSecretHint')
                        : t('codeupSecretHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('webhookUrl')}</Label>
                    <div className="bg-muted flex min-w-0 items-center gap-2 rounded-md px-2 py-1">
                      <code className="min-w-0 flex-1 truncate text-xs">
                        {endpointFor(webhookId)}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={t('copyWebhookUrl')}
                        onClick={() => copy(endpointFor(webhookId))}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {t('webhookUrlHint')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
