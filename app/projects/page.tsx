'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ProjectCard } from '@/components/project-card'
import { PageHeader } from '@/components/page-header'
import { Plus, FolderGit2 } from 'lucide-react'

interface Project {
  id: string
  name: string
  path: string
  buildCommand: string
  createdAt: string
  updatedAt: string
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [buildingId, setBuildingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [])

  const handleBuild = async (projectId: string) => {
    setBuildingId(projectId)
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (res.ok) {
        const build = await res.json()
        router.push(`/builds/${build.id}`)
      }
    } finally {
      setBuildingId(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <PageHeader title="项目列表" description="管理你的构建项目" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-48 mt-2" />
              </CardHeader>
              <CardContent className="pt-0">
                <Skeleton className="h-16 w-full mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="项目列表"
        description={projects.length > 0 ? `共 ${projects.length} 个项目` : '管理你的构建项目'}
      >
        {projects.length > 0 && (
          <Link href="/projects/new">
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              新建项目
            </Button>
          </Link>
        )}
      </PageHeader>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-24 border border-dashed rounded-lg">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <FolderGit2 className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">还没有项目</h3>
          <p className="text-muted-foreground text-sm text-center mb-6 max-w-sm px-4">
            创建你的第一个项目，开始自动化构建之旅
          </p>
          <Link href="/projects/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建项目
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onBuild={handleBuild}
              building={buildingId === project.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
