'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DirectoryPicker } from '@/components/directory-picker'
import {
  Loader2,
  Settings,
  GitBranch,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Link, useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface Project {
  id: string
  name: string
  path: string
  buildCommand: string
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
  onLoadingChange?: (loading: boolean) => void
}

export function ProjectForm({
  project,
  mode,
  formId = 'project-form',
  onLoadingChange,
}: ProjectFormProps) {
  const router = useRouter()
  const t = useTranslations('projectForm')
  const [, setLoadingState] = useState(false)

  const setLoading = (value: boolean) => {
    setLoadingState(value)
    onLoadingChange?.(value)
  }
  const [cloning, setCloning] = useState(false)
  const [error, setError] = useState('')
  const [cloneSuccess, setCloneSuccess] = useState(false)

  const [workDir, setWorkDir] = useState('')
  const [credentials, setCredentials] = useState<GitCredential[]>([])

  const [name, setName] = useState(project?.name || '')
  const [relativePath, setRelativePath] = useState('')
  const [buildCommand, setBuildCommand] = useState(
    project?.buildCommand || 'ni\nnr build',
  )
  const [gitPullBeforeBuild, setGitPullBeforeBuild] = useState(
    project?.gitPullBeforeBuild || false,
  )
  const [outputPaths, setOutputPaths] = useState(
    project?.outputPaths?.join('\n') || 'dist',
  )

  const [showCloneOptions, setShowCloneOptions] = useState(false)
  const [gitUrl, setGitUrl] = useState('')
  const [gitBranch, setGitBranch] = useState('main')
  const [gitCredentialId, setGitCredentialId] = useState(
    project?.gitCredentialId || '',
  )

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setWorkDir(data.workDir || '')
          setCredentials(data.gitCredentials || [])

          if (project?.path && data.workDir) {
            const normalizedPath = project.path.replace(/\\/g, '/')
            const normalizedWorkDir = data.workDir.replace(/\\/g, '/')
            if (normalizedPath.startsWith(normalizedWorkDir)) {
              const rel = normalizedPath.slice(normalizedWorkDir.length)
              setRelativePath(rel.startsWith('/') ? rel.slice(1) : rel)
            } else {
              setRelativePath(normalizedPath)
            }
          } else if (project?.path) {
            setRelativePath(project.path.replace(/\\/g, '/'))
          }
        }
      })
  }, [project?.path])

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

    const isAbsolute = /^([a-zA-Z]:)?\//.test(relativePath)
    const fullPath =
      workDir && relativePath && !isAbsolute
        ? `${workDir.replace(/\\/g, '/')}/${relativePath}`
        : relativePath

    try {
      const url =
        mode === 'create' ? '/api/projects' : `/api/projects/${project?.id}`
      const method = mode === 'create' ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          path: fullPath,
          buildCommand,
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
                          {workDir.replace(/\\/g, '/')}/
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
                            setGitCredentialId(v === '_none' ? '' : v)
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
                          <Link href="/settings">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                            >
                              <Settings className="mr-1 h-3 w-3" />
                              {t('configure')}
                            </Button>
                          </Link>
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
                    setGitCredentialId(v === '_none' ? '' : v)
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
                  <Link href="/settings">
                    <Button type="button" variant="outline" size="sm">
                      <Settings className="mr-1 h-3 w-3" />
                      {t('goToConfigure')}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
