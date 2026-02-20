'use client'

import { useEffect, useState, use } from 'react'
import { ProjectForm } from '@/components/project-form'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
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
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

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

export default function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const t = useTranslations('projectForm')
  const tDelete = useTranslations('deleteProject')
  const tCommon = useTranslations('common')
  const [project, setProject] = useState<Project | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [formLoading, setFormLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((res) => (res.ok ? res.json() : null))
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
    return <PageHeader title={t('editProject')} backHref={`/projects/${id}`} />
  }

  if (!project) {
    return (
      <>
        <PageHeader title={t('notFound')} backHref="/projects" />
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('editProject')} backHref={`/projects/${id}`}>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              disabled={deleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {tCommon('delete')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tDelete('title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {tDelete('description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                {tCommon('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button type="submit" form="project-form" disabled={formLoading}>
          {formLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('saving')}
            </>
          ) : (
            t('save')
          )}
        </Button>
      </PageHeader>
      <div className="mx-auto max-w-lg">
        <ProjectForm
          project={project}
          mode="edit"
          onLoadingChange={setFormLoading}
        />
      </div>
    </>
  )
}
