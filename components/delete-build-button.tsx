'use client'

import { useState } from 'react'
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
import { Trash2 } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface DeleteBuildButtonProps {
  buildId: string
  redirectHref: string
}

export function DeleteBuildButton({
  buildId,
  redirectHref,
}: DeleteBuildButtonProps) {
  const t = useTranslations('buildDetail')
  const tDelete = useTranslations('deleteBuild')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/builds/${buildId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push(redirectHref)
        router.refresh()
      } else {
        setDeleting(false)
      }
    } catch {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          disabled={deleting}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50"
        >
          <Trash2 className="mr-1 h-4 w-4" />
          {t('delete')}
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
  )
}
