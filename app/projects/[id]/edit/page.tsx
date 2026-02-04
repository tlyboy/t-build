'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { ProjectForm } from '@/components/project-form'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
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
import { Loader2, Trash2 } from 'lucide-react'

interface Project {
  id: string
  name: string
  path: string
  buildCommand: string
  createdAt: string
  updatedAt: string
  sourceType: 'local' | 'git'
  gitUrl?: string
  gitBranch?: string
  gitPullBeforeBuild?: boolean
  outputPaths?: string[]
  installCommand?: string
  gitCredentialId?: string
}

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [formLoading, setFormLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then(setProject)
      .finally(() => setPageLoading(false))
  }, [id])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/projects')
        router.refresh()
      }
    } finally {
      setDeleting(false)
    }
  }

  if (pageLoading) {
    return (
      <>
        <PageHeader title="编辑项目" backHref={`/projects/${id}`} />
        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  if (!project) {
    return (
      <>
        <PageHeader title="项目不存在" backHref="/projects" />
      </>
    )
  }

  return (
    <>
      <PageHeader title="编辑项目" backHref={`/projects/${id}`}>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              disabled={deleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确定要删除这个项目吗？</AlertDialogTitle>
              <AlertDialogDescription>
                删除后无法恢复，相关的构建记录也会被删除。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button type="submit" form="project-form" disabled={formLoading}>
          {formLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            '保存'
          )}
        </Button>
      </PageHeader>
      <div className="max-w-lg mx-auto">
        <ProjectForm project={project} mode="edit" onLoadingChange={setFormLoading} />
      </div>
    </>
  )
}
