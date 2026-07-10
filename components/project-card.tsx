import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Link } from '@/i18n/navigation'

interface Project {
  id: string
  name: string
  path: string
  buildCommand: string
  createdAt: string
  updatedAt: string
}

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Card className="hover:ring-primary/30 relative min-h-24 cursor-pointer justify-center transition-[box-shadow,transform] duration-200 focus-within:shadow-md hover:-translate-y-0.5 hover:shadow-md">
      <Link
        href={`/projects/${project.id}`}
        className="focus-visible:ring-ring absolute inset-0 z-0 rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        aria-label={project.name}
      >
        <span className="sr-only">{project.name}</span>
      </Link>

      <CardHeader className="pointer-events-none relative z-10">
        <CardTitle className="truncate text-base sm:text-lg">
          {project.name}
        </CardTitle>
        <CardDescription className="truncate">{project.path}</CardDescription>
      </CardHeader>
    </Card>
  )
}
