'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { Loader2, Settings, AlertCircle, GitBranch, ChevronDown, ChevronUp } from 'lucide-react'

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

export function ProjectForm({ project, mode, formId = 'project-form', onLoadingChange }: ProjectFormProps) {
  const router = useRouter()
  const [, setLoadingState] = useState(false)

  const setLoading = (value: boolean) => {
    setLoadingState(value)
    onLoadingChange?.(value)
  }
  const [cloning, setCloning] = useState(false)
  const [error, setError] = useState('')
  const [cloneSuccess, setCloneSuccess] = useState(false)

  // 全局设置
  const [workDir, setWorkDir] = useState('')
  const [credentials, setCredentials] = useState<GitCredential[]>([])
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  // 表单字段
  const [name, setName] = useState(project?.name || '')
  const [relativePath, setRelativePath] = useState('')
  const [buildCommand, setBuildCommand] = useState(project?.buildCommand || 'pnpm install\npnpm build')
  const [gitPullBeforeBuild, setGitPullBeforeBuild] = useState(project?.gitPullBeforeBuild || false)
  const [outputPaths, setOutputPaths] = useState(project?.outputPaths?.join('\n') || '')

  // 克隆相关
  const [showCloneOptions, setShowCloneOptions] = useState(false)
  const [gitUrl, setGitUrl] = useState('')
  const [gitBranch, setGitBranch] = useState('main')
  const [gitCredentialId, setGitCredentialId] = useState(project?.gitCredentialId || '')

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setWorkDir(data.workDir || '')
          setCredentials(data.gitCredentials || [])

          if (project?.path && data.workDir) {
            if (project.path.startsWith(data.workDir)) {
              const rel = project.path.slice(data.workDir.length)
              setRelativePath(rel.startsWith('/') ? rel.slice(1) : rel)
            } else {
              setRelativePath(project.path)
            }
          } else if (project?.path) {
            setRelativePath(project.path)
          }
        }
        setSettingsLoaded(true)
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
      .map(p => p.trim())
      .filter(p => p.length > 0)

    const fullPath = workDir && relativePath
      ? `${workDir.replace(/\\/g, '/')}/${relativePath}`
      : relativePath

    try {
      const url = mode === 'create' ? '/api/projects' : `/api/projects/${project?.id}`
      const method = mode === 'create' ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          path: fullPath,
          buildCommand,
          gitPullBeforeBuild,
          outputPaths: parsedOutputPaths.length > 0 ? parsedOutputPaths : undefined,
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
      setError('请输入 Git 仓库地址')
      return
    }

    const repoName = getRepoNameFromUrl(gitUrl)
    if (!repoName) {
      setError('无法从 URL 解析仓库名')
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
      setGitPullBeforeBuild(true) // 克隆的项目默认开启 Git Pull

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

  if (settingsLoaded && !workDir) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">请先配置工作目录</h3>
          <p className="text-muted-foreground text-sm text-center mb-6 max-w-sm">
            需要先在设置中配置工作目录，所有项目都将存放在该目录下
          </p>
          <Link href="/settings">
            <Button>
              <Settings className="h-4 w-4 mr-2" />
              前往设置
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <form id={formId} onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {workDir && (
            <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md font-mono">
              工作目录: {workDir}
            </div>
          )}

          {/* 项目目录 */}
          <div className="space-y-2">
            <Label htmlFor="path">项目目录</Label>
            <div className="flex gap-2">
              <Input
                id="path"
                value={relativePath}
                onChange={(e) => setRelativePath(e.target.value)}
                placeholder="选择或输入目录名"
                required
                className="flex-1 font-mono"
              />
              <DirectoryPicker
                value={relativePath}
                onChange={handleDirectorySelect}
              />
            </div>
          </div>

          {/* 克隆新仓库 */}
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
                    className="bg-card px-3 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <GitBranch className="h-3 w-3" />
                    {showCloneOptions ? '收起克隆选项' : '从 Git 克隆'}
                    {showCloneOptions ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>

              {showCloneOptions && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="gitUrl">Git 仓库地址</Label>
                    <Input
                      id="gitUrl"
                      value={gitUrl}
                      onChange={(e) => setGitUrl(e.target.value)}
                      placeholder="https://github.com/user/repo.git"
                    />
                    {gitUrl && (
                      <p className="text-xs text-muted-foreground">
                        将克隆到: <code className="bg-muted px-1 rounded">{workDir.replace(/\\/g, '/')}/{getRepoNameFromUrl(gitUrl)}</code>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Git 凭证（私有仓库）</Label>
                      {credentials.length > 0 ? (
                        <Select
                          value={gitCredentialId || '_none'}
                          onValueChange={(v) => setGitCredentialId(v === '_none' ? '' : v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="选择凭证" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">公开仓库</SelectItem>
                            {credentials.map((cred) => (
                              <SelectItem key={cred.id} value={cred.id}>
                                {cred.name} ({cred.type.toUpperCase()})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center justify-between rounded-md border border-dashed p-2 h-9">
                          <span className="text-xs text-muted-foreground">公开仓库可直接克隆</span>
                          <Link href="/settings">
                            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs">
                              <Settings className="h-3 w-3 mr-1" />
                              配置
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gitBranch">分支</Label>
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
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        克隆中...
                      </>
                    ) : cloneSuccess ? (
                      '✓ 克隆成功'
                    ) : (
                      '克隆仓库'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* 项目名称 */}
          <div className="space-y-2">
            <Label htmlFor="name">项目名称</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              required
            />
          </div>

          {/* 构建命令 */}
          <div className="space-y-2">
            <Label htmlFor="buildCommand">构建命令</Label>
            <Textarea
              id="buildCommand"
              value={buildCommand}
              onChange={(e) => setBuildCommand(e.target.value)}
              placeholder={"pnpm install\npnpm build\n# 多目录:\ncd packages/app\nbun install\nbun build"}
              rows={4}
              required
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              每行一个命令，用 cd 切换目录，# 为注释
            </p>
          </div>

          {/* 构建产物 */}
          <div className="space-y-2">
            <Label htmlFor="outputPaths">构建产物</Label>
            <Textarea
              id="outputPaths"
              value={outputPaths}
              onChange={(e) => setOutputPaths(e.target.value)}
              placeholder={"dist\n**/*.dmg"}
              rows={2}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              可选，每行一个路径，支持 glob 模式
            </p>
          </div>

          {/* Git Pull 选项 */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="gitPull" className="text-sm font-medium">构建前 Git Pull</Label>
              <p className="text-xs text-muted-foreground">
                每次构建前自动拉取最新代码
              </p>
            </div>
            <Switch
              id="gitPull"
              checked={gitPullBeforeBuild}
              onCheckedChange={setGitPullBeforeBuild}
            />
          </div>

          {/* Git 凭证选择（已开启 Git Pull 时显示） */}
          {gitPullBeforeBuild && (
            <div className="space-y-2">
              <Label>Git 凭证（私有仓库）</Label>
              {credentials.length > 0 ? (
                <Select
                  value={gitCredentialId || '_none'}
                  onValueChange={(v) => setGitCredentialId(v === '_none' ? '' : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择凭证" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">不使用（公开仓库）</SelectItem>
                    {credentials.map((cred) => (
                      <SelectItem key={cred.id} value={cred.id}>
                        {cred.name} ({cred.type.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center justify-between rounded-md border border-dashed p-3">
                  <p className="text-sm text-muted-foreground">
                    暂无凭证，公开仓库可直接使用
                  </p>
                  <Link href="/settings">
                    <Button type="button" variant="outline" size="sm">
                      <Settings className="h-3 w-3 mr-1" />
                      去配置
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
