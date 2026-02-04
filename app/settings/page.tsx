'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  FolderOpen,
  Plus,
  Trash2,
  Key,
  User,
  Loader2,
  Check,
  KeyRound,
} from 'lucide-react'

interface GitCredential {
  id: string
  name: string
  type: 'https' | 'ssh'
  username?: string
  hasPassword?: boolean
  hasSshKey?: boolean
}

interface Settings {
  workDir: string
  gitCredentials: GitCredential[]
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({ workDir: '', gitCredentials: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workDir, setWorkDir] = useState('')
  const [message, setMessage] = useState('')

  // 凭证表单状态
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false)
  const [credentialType, setCredentialType] = useState<'https' | 'ssh'>('ssh')
  const [credentialName, setCredentialName] = useState('')
  const [credentialUsername, setCredentialUsername] = useState('')
  const [credentialPassword, setCredentialPassword] = useState('')
  const [credentialSshKey, setCredentialSshKey] = useState('')
  const [savingCredential, setSavingCredential] = useState(false)
  const [deleteCredentialId, setDeleteCredentialId] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
        setWorkDir(data.workDir || '')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSaveWorkDir = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workDir }),
      })
      if (res.ok) {
        setMessage('保存成功')
        setTimeout(() => setMessage(''), 2000)
      }
    } finally {
      setSaving(false)
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

    await fetch(`/api/settings/credentials/${deleteCredentialId}`, { method: 'DELETE' })
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
      <div className="max-w-6xl mx-auto">
        <PageHeader title="设置" description="全局配置" />
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader title="设置" description="全局配置" />

      {/* 工作目录 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderOpen className="h-5 w-5" />
            工作目录
          </CardTitle>
          <CardDescription>
            所有项目的根目录，新建项目时路径将基于此目录
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={workDir}
              onChange={(e) => setWorkDir(e.target.value)}
              placeholder="/Users/xxx/projects"
              className="flex-1 font-mono"
            />
            <Button onClick={handleSaveWorkDir} disabled={saving} className="sm:w-auto">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : message ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  已保存
                </>
              ) : (
                '保存'
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            设置后，新建项目时只需输入相对路径，如 my-app
          </p>
        </CardContent>
      </Card>

      {/* Git 凭证 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="h-5 w-5" />
                Git 凭证
              </CardTitle>
              <CardDescription>
                配置私有仓库的认证信息，用于 Git Pull
              </CardDescription>
            </div>
            <Dialog open={credentialDialogOpen} onOpenChange={setCredentialDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  添加
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>添加 Git 凭证</DialogTitle>
                  <DialogDescription>
                    配置私有仓库的认证方式
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>凭证名称</Label>
                    <Input
                      value={credentialName}
                      onChange={(e) => setCredentialName(e.target.value)}
                      placeholder="如：GitHub Personal"
                    />
                  </div>

                  <Tabs value={credentialType} onValueChange={(v) => setCredentialType(v as 'https' | 'ssh')}>
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

                    <TabsContent value="ssh" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>SSH 私钥</Label>
                        <Textarea
                          value={credentialSshKey}
                          onChange={(e) => setCredentialSshKey(e.target.value)}
                          placeholder="-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----"
                          rows={8}
                          className="font-mono text-xs break-all"
                        />
                        <p className="text-xs text-muted-foreground">
                          粘贴完整的 SSH 私钥内容（包含 BEGIN 和 END 行）
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="https" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>用户名</Label>
                        <Input
                          value={credentialUsername}
                          onChange={(e) => setCredentialUsername(e.target.value)}
                          placeholder="GitHub 用户名"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>密码 / Token</Label>
                        <Input
                          type="password"
                          value={credentialPassword}
                          onChange={(e) => setCredentialPassword(e.target.value)}
                          placeholder="Personal Access Token"
                        />
                        <p className="text-xs text-muted-foreground">
                          建议使用 Personal Access Token 而非密码
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setCredentialDialogOpen(false)}>
                      取消
                    </Button>
                    <Button
                      onClick={handleAddCredential}
                      disabled={savingCredential || !credentialName || (credentialType === 'ssh' && !credentialSshKey)}
                    >
                      {savingCredential ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        '保存'
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {settings.gitCredentials.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              暂无凭证配置
            </div>
          ) : (
            <div className="space-y-2">
              {settings.gitCredentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {cred.type === 'https' ? (
                      <User className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <div className="font-medium text-sm">{cred.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {cred.type === 'https'
                          ? `HTTPS · ${cred.username || '未配置用户名'}${cred.hasPassword ? ' · 已配置密码' : ''}`
                          : `SSH · ${cred.hasSshKey ? '已配置私钥' : '未配置私钥'}`}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
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

      {/* 删除凭证确认对话框 */}
      <AlertDialog open={!!deleteCredentialId} onOpenChange={(open) => !open && setDeleteCredentialId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除这个凭证吗？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复，使用此凭证的项目将无法进行 Git Pull 操作。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteCredential}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
