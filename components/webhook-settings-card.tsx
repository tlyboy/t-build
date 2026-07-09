'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Copy,
  GitBranch,
  GitFork,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Webhook,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { SafeWebhookConfig, WebhookProvider } from '@/lib/data/webhooks'

interface SettingsProject {
  id: string
  name: string
}

interface WebhookSettingsCardProps {
  initialProjects: SettingsProject[]
  initialWebhooks: SafeWebhookConfig[]
}

function generateSecret() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

function providerLabel(provider: WebhookProvider) {
  return provider === 'github' ? 'GitHub' : 'Codeup'
}

export function WebhookSettingsCard({
  initialProjects,
  initialWebhooks,
}: WebhookSettingsCardProps) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const [projects] = useState(initialProjects)
  const [webhooks, setWebhooks] = useState(initialWebhooks)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<WebhookProvider>('github')
  const [projectId, setProjectId] = useState(initialProjects[0]?.id ?? '')
  const [branch, setBranch] = useState('')
  const [secret, setSecret] = useState(() => generateSecret())

  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  )

  const resetForm = () => {
    setName('')
    setProvider('github')
    setProjectId(projects[0]?.id ?? '')
    setBranch('')
    setSecret(generateSecret())
  }

  const endpointFor = (id: string) => {
    if (typeof window === 'undefined') return `/api/webhooks/${id}`
    return `${window.location.origin}/api/webhooks/${id}`
  }

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value)
    toast.success(t('copied'))
  }

  const refreshWebhooks = async () => {
    const response = await fetch('/api/webhooks')
    if (!response.ok) return

    const data = (await response.json()) as {
      webhooks: SafeWebhookConfig[]
    }
    setWebhooks(data.webhooks)
  }

  const handleCreate = async () => {
    if (!projectId || !name.trim() || !secret.trim()) return

    setSaving(true)
    try {
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          provider,
          projectId,
          branch: branch.trim(),
          secret: secret.trim(),
          enabled: true,
        }),
      })

      if (!response.ok) {
        toast.error(t('webhookSaveFailed'))
        return
      }

      const created = (await response.json()) as SafeWebhookConfig
      setWebhooks((current) => [...current, created])
      setDialogOpen(false)
      resetForm()
      toast.success(t('webhookSaved'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (webhook: SafeWebhookConfig, enabled: boolean) => {
    const response = await fetch(`/api/webhooks/${webhook.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })

    if (!response.ok) {
      toast.error(t('webhookSaveFailed'))
      return
    }

    await refreshWebhooks()
  }

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/webhooks/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      toast.error(t('webhookDeleteFailed'))
      return
    }

    setWebhooks((current) => current.filter((webhook) => webhook.id !== id))
    toast.success(t('webhookDeleted'))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Webhook className="h-5 w-5" />
              {t('webhooks')}
            </CardTitle>
            <CardDescription>{t('webhooksDesc')}</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={projects.length === 0}>
                <Plus className="mr-1 h-4 w-4" />
                {t('addWebhook')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('addWebhook')}</DialogTitle>
                <DialogDescription>{t('addWebhookDesc')}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="webhookName">{t('webhookName')}</Label>
                  <Input
                    id="webhookName"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('webhookNamePlaceholder')}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('webhookProvider')}</Label>
                    <Select
                      value={provider}
                      onValueChange={(value) =>
                        setProvider(value as WebhookProvider)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="github">GitHub</SelectItem>
                        <SelectItem value="codeup">Codeup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('webhookProject')}</Label>
                    <Select value={projectId} onValueChange={setProjectId}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhookBranch">{t('webhookBranch')}</Label>
                  <div className="relative">
                    <GitBranch className="text-muted-foreground pointer-events-none absolute top-2 left-2.5 h-4 w-4" />
                    <Input
                      id="webhookBranch"
                      value={branch}
                      onChange={(event) => setBranch(event.target.value)}
                      placeholder={t('webhookBranchPlaceholder')}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhookSecret">{t('webhookSecret')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="webhookSecret"
                      value={secret}
                      onChange={(event) => setSecret(event.target.value)}
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title={t('regenerateSecret')}
                      onClick={() => setSecret(generateSecret())}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title={t('copySecret')}
                      onClick={() => copy(secret)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {provider === 'github'
                      ? t('githubSecretHint')
                      : t('codeupSecretHint')}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    {tCommon('cancel')}
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={saving || !projectId || !name.trim() || !secret}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      tCommon('save')
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            {t('webhookNoProjects')}
          </div>
        ) : webhooks.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            {t('noWebhooks')}
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="rounded-lg border p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {webhook.provider === 'github' ? (
                        <GitFork className="h-4 w-4" />
                      ) : (
                        <Webhook className="h-4 w-4" />
                      )}
                      <span className="font-medium">{webhook.name}</span>
                      <Badge variant={webhook.enabled ? 'default' : 'outline'}>
                        {webhook.enabled ? t('enabled') : t('disabled')}
                      </Badge>
                      <Badge variant="secondary">
                        {providerLabel(webhook.provider)}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {projectNameById.get(webhook.projectId) ??
                        t('unknownProject')}
                      {webhook.branch ? ` · ${webhook.branch}` : ''}
                    </div>
                    <div className="bg-muted flex min-w-0 items-center gap-2 rounded-md px-2 py-1">
                      <code className="min-w-0 flex-1 truncate text-xs">
                        {endpointFor(webhook.id)}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={t('copyWebhookUrl')}
                        onClick={() => copy(endpointFor(webhook.id))}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {webhook.lastTriggeredAt && (
                      <div className="text-muted-foreground text-xs">
                        {t('lastTriggeredAt', {
                          time: new Date(
                            webhook.lastTriggeredAt,
                          ).toLocaleString(),
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 self-end lg:self-auto">
                    <Switch
                      checked={webhook.enabled}
                      onCheckedChange={(checked) =>
                        handleToggle(webhook, checked)
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                      title={tCommon('delete')}
                      onClick={() => handleDelete(webhook.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
