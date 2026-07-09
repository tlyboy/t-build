'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/page-header'
import { ProjectForm } from '@/components/project-form'
import { Button } from '@/components/ui/button'
import type { SafeGitCredential } from '@/lib/data/settings'

export function NewProjectView({
  initialWorkDir,
  initialCredentials,
}: {
  initialWorkDir: string
  initialCredentials: SafeGitCredential[]
}) {
  const [loading, setLoading] = useState(false)
  const t = useTranslations('projectForm')

  return (
    <>
      <PageHeader title={t('newProject')} backHref="/projects">
        <Button type="submit" form="project-form" disabled={loading}>
          {loading ? (
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
          mode="create"
          initialWorkDir={initialWorkDir}
          initialCredentials={initialCredentials}
          onLoadingChange={setLoading}
        />
      </div>
    </>
  )
}
