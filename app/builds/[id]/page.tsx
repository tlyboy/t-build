'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { BuildLog } from '@/components/build-log'
import { PageHeader } from '@/components/page-header'
import { Download, GitCommit, Trash2 } from 'lucide-react'

type BuildStatus = 'pending' | 'running' | 'success' | 'failed'

interface Build {
  id: string
  projectId: string
  status: 'pending' | 'running' | 'success' | 'failed'
  startedAt: string
  finishedAt?: string
  logs: string[]
  exitCode?: number
  gitCommitHash?: string
  gitCommitMessage?: string
}

interface Project {
  id: string
  name: string
  path: string
  buildCommand: string
  outputPaths?: string[]
}

export default function BuildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [build, setBuild] = useState<Build | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const fetchBuildData = useCallback(async () => {
    const res = await fetch(`/api/builds/${id}`)
    if (res.ok) {
      const buildData = await res.json()
      setBuild(buildData)
      if (buildData?.projectId && !project) {
        const projRes = await fetch(`/api/projects/${buildData.projectId}`)
        if (projRes.ok) {
          setProject(await projRes.json())
        }
      }
    }
  }, [id, project])

  useEffect(() => {
    fetchBuildData().finally(() => setLoading(false))
  }, [fetchBuildData])

  // 当构建状态变化时刷新数据（获取 commit 信息、耗时等）
  const handleStatusChange = useCallback((status: BuildStatus) => {
    if (status === 'success' || status === 'failed') {
      // 构建完成，刷新数据以获取最新信息
      fetchBuildData()
    }
  }, [fetchBuildData])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/builds/${id}`, { method: 'DELETE' })
      if (res.ok) {
        if (project) {
          router.push(`/projects/${project.id}`)
        } else {
          router.push('/')
        }
        router.refresh()
      }
    } finally {
      setDeleting(false)
    }
  }

  const backHref = project ? `/projects/${project.id}` : '/'

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader title="构建详情" backHref="/" />
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <Skeleton className="h-3 w-16 mb-1" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!build) {
    return (
      <div className="max-w-6xl mx-auto">
        <PageHeader title="构建记录不存在" backHref="/" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="构建详情"
        description={project?.name}
        backHref={backHref}
      >
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={deleting} className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50">
              <Trash2 className="h-4 w-4 mr-1" />
              删除
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确定要删除这条构建记录吗？</AlertDialogTitle>
              <AlertDialogDescription>
                删除后无法恢复，构建日志也会一并删除。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>删除</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">构建信息</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">开始时间</div>
            <div className="text-sm">{new Date(build.startedAt).toLocaleString('zh-CN')}</div>
          </div>
          {build.finishedAt && (
            <div>
              <div className="text-xs text-muted-foreground">完成时间</div>
              <div className="text-sm">{new Date(build.finishedAt).toLocaleString('zh-CN')}</div>
            </div>
          )}
          {build.finishedAt && (
            <div>
              <div className="text-xs text-muted-foreground">耗时</div>
              <div className="text-sm">
                {Math.round(
                  (new Date(build.finishedAt).getTime() - new Date(build.startedAt).getTime()) / 1000
                )}s
              </div>
            </div>
          )}
          {build.exitCode !== undefined && (
            <div>
              <div className="text-xs text-muted-foreground">退出码</div>
              <div className="text-sm">{build.exitCode}</div>
            </div>
          )}
          {build.gitCommitHash && (
            <div className="col-span-2 sm:col-span-4">
              <div className="text-xs text-muted-foreground">Git Commit</div>
              <div className="flex items-center gap-2 mt-0.5">
                <GitCommit className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <code className="text-sm">{build.gitCommitHash.substring(0, 8)}</code>
                {build.gitCommitMessage && (
                  <span className="text-sm text-muted-foreground truncate">
                    {build.gitCommitMessage}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 下载按钮 */}
      {build.status === 'success' && project?.outputPaths && project.outputPaths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>构建产物</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">包含路径:</div>
                <div className="flex flex-wrap gap-1.5">
                  {project.outputPaths.map((p, i) => (
                    <code key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {p}
                    </code>
                  ))}
                </div>
              </div>
              <Button asChild className="flex-shrink-0">
                <a href={`/api/builds/${build.id}/artifact`} download>
                  <Download className="h-4 w-4 mr-2" />
                  下载产物
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>构建日志</CardTitle>
        </CardHeader>
        <CardContent>
          <BuildLog
            buildId={build.id}
            initialStatus={build.status}
            onStatusChange={handleStatusChange}
          />
        </CardContent>
      </Card>
    </div>
  )
}
