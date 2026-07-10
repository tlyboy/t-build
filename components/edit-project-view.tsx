'use client'

import { useState } from 'react'
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
import type { Project } from '@/lib/data/projects'
import type { SafeGitCredential } from '@/lib/data/settings'
import type { SafeWebhookConfig } from '@/lib/data/webhooks'
import { WebhookSettingsCard } from '@/components/webhook-settings-card'

export function EditProjectView({
  project,
  backHref,
  initialWorkDir,
  initialCredentials,
  initialWebhooks,
}: {
  project: Project
  backHref: string
  initialWorkDir: string
  initialCredentials: SafeGitCredential[]
  initialWebhooks: SafeWebhookConfig[]
}) {
  const router = useRouter()
  const t = useTranslations('projectForm')
  const tDelete = useTranslations('deleteProject')
  const tCommon = useTranslations('common')
  const [formLoading, setFormLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        router.push('/projects')
        router.refresh()
      } else {
        setDeleting(false)
      }
    } catch {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHeader title={t('editProject')} backHref={backHref}>
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
      <div className="mx-auto max-w-lg space-y-6">
        <ProjectForm
          project={project}
          mode="edit"
          initialWorkDir={initialWorkDir}
          initialCredentials={initialCredentials}
          onLoadingChange={setFormLoading}
        />
        <WebhookSettingsCard
          initialProjects={[{ id: project.id, name: project.name }]}
          initialWebhooks={initialWebhooks}
        />
      </div>
    </>
  )
}
