'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Key, User, Loader2, KeyRound } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface GitCredential {
  id: string
  name: string
  type: 'https' | 'ssh'
  username?: string
  hasPassword?: boolean
  hasSshKey?: boolean
}

export default function SettingsPage() {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const tDelete = useTranslations('deleteCredential')
  const [credentials, setCredentials] = useState<GitCredential[]>([])
  const [loading, setLoading] = useState(true)

  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false)
  const [credentialType, setCredentialType] = useState<'https' | 'ssh'>('ssh')
  const [credentialName, setCredentialName] = useState('')
  const [credentialUsername, setCredentialUsername] = useState('')
  const [credentialPassword, setCredentialPassword] = useState('')
  const [credentialSshKey, setCredentialSshKey] = useState('')
  const [savingCredential, setSavingCredential] = useState(false)
  const [deleteCredentialId, setDeleteCredentialId] = useState<string | null>(
    null,
  )

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setCredentials(data.gitCredentials || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddCredential = async () => {
    setSavingCredential(true)
    try {
      const res = await fetch('/api/settings/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: credentialName,
          type: credentialType,
          username: credentialType === 'https' ? credentialUsername : undefined,
          password: credentialType === 'https' ? credentialPassword : undefined,
          sshKey: credentialType === 'ssh' ? credentialSshKey : undefined,
        }),
      })
      if (res.ok) {
        setCredentialDialogOpen(false)
        resetCredentialForm()
        fetchSettings()
      }
    } finally {
      setSavingCredential(false)
    }
  }

  const handleDeleteCredential = async () => {
    if (!deleteCredentialId) return

    await fetch(`/api/settings/credentials/${deleteCredentialId}`, {
      method: 'DELETE',
    })
    setDeleteCredentialId(null)
    fetchSettings()
  }

  const resetCredentialForm = () => {
    setCredentialName('')
    setCredentialType('ssh')
    setCredentialUsername('')
    setCredentialPassword('')
    setCredentialSshKey('')
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t('title')} description={t('description')} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="h-5 w-5" />
                {t('gitCredentials')}
              </CardTitle>
              <CardDescription>{t('gitCredentialsDesc')}</CardDescription>
            </div>
            <Dialog
              open={credentialDialogOpen}
              onOpenChange={setCredentialDialogOpen}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  {t('add')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t('addCredential')}</DialogTitle>
                  <DialogDescription>
                    {t('addCredentialDesc')}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>{t('credentialName')}</Label>
                    <Input
                      value={credentialName}
                      onChange={(e) => setCredentialName(e.target.value)}
                      placeholder={t('credentialNamePlaceholder')}
                    />
                  </div>

                  <Tabs
                    value={credentialType}
                    onValueChange={(v) =>
                      setCredentialType(v as 'https' | 'ssh')
                    }
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="ssh" className="gap-2">
                        <KeyRound className="h-4 w-4" />
                        SSH
                      </TabsTrigger>
                      <TabsTrigger value="https" className="gap-2">
                        <User className="h-4 w-4" />
                        HTTPS
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="ssh" className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label>{t('sshPrivateKey')}</Label>
                        <Textarea
                          value={credentialSshKey}
                          onChange={(e) => setCredentialSshKey(e.target.value)}
                          placeholder="-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----"
                          rows={8}
                          className="font-mono text-xs break-all"
                        />
                        <p className="text-muted-foreground text-xs">
                          {t('sshKeyHint')}
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="https" className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label>{t('username')}</Label>
                        <Input
                          value={credentialUsername}
                          onChange={(e) =>
                            setCredentialUsername(e.target.value)
                          }
                          placeholder={t('usernamePlaceholder')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('password')}</Label>
                        <Input
                          type="password"
                          value={credentialPassword}
                          onChange={(e) =>
                            setCredentialPassword(e.target.value)
                          }
                          placeholder={t('passwordPlaceholder')}
                        />
                        <p className="text-muted-foreground text-xs">
                          {t('passwordHint')}
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCredentialDialogOpen(false)}
                    >
                      {tCommon('cancel')}
                    </Button>
                    <Button
                      onClick={handleAddCredential}
                      disabled={
                        savingCredential ||
                        !credentialName ||
                        (credentialType === 'ssh' && !credentialSshKey)
                      }
                    >
                      {savingCredential ? (
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
          {credentials.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center text-sm">
              {t('noCredentials')}
            </div>
          ) : (
            <div className="space-y-2">
              {credentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    {cred.type === 'https' ? (
                      <User className="text-muted-foreground h-4 w-4" />
                    ) : (
                      <KeyRound className="text-muted-foreground h-4 w-4" />
                    )}
                    <div>
                      <div className="text-sm font-medium">{cred.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {cred.type === 'https'
                          ? `HTTPS · ${cred.username || t('httpsNotConfiguredUsername')}${cred.hasPassword ? ` · ${t('httpsPasswordConfigured')}` : ''}`
                          : `SSH · ${cred.hasSshKey ? t('sshKeyConfigured') : t('sshKeyNotConfigured')}`}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                    onClick={() => setDeleteCredentialId(cred.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteCredentialId}
        onOpenChange={(open) => !open && setDeleteCredentialId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tDelete('title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tDelete('description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteCredential}
            >
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
