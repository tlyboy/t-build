'use client'

import { useState } from 'react'
import { ProjectForm } from '@/components/project-form'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export default function NewProjectPage() {
  const [loading, setLoading] = useState(false)

  return (
    <>
      <PageHeader title="新建项目" backHref="/projects">
        <Button type="submit" form="project-form" disabled={loading}>
          {loading ? (
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
        <ProjectForm mode="create" onLoadingChange={setLoading} />
      </div>
    </>
  )
}
