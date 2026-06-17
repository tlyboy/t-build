'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Eye, EyeOff, Loader2, FileUp } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface EnvRow {
  key: string
  value: string
  masked?: boolean // true if value was loaded from server (masked)
}

export function EnvEditor({ projectId }: { projectId: string }) {
  const t = useTranslations('projectDetail')
  const [rows, setRows] = useState<EnvRow[]>([])
  const [initialCount, setInitialCount] = useState(0) // track if we had vars on load
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set())
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')

  useEffect(() => {
    fetch(`/api/projects/${projectId}/env`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const loaded = data.map((d: { key: string; value: string }) => ({
            key: d.key,
            value: d.value,
            masked: true,
          }))
          setRows(loaded)
          setInitialCount(loaded.length)
        }
      })
      .finally(() => setLoading(false))
  }, [projectId])

  const addRow = () => {
    setRows([...rows, { key: '', value: '' }])
  }

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index))
    setVisibleIndices((prev) => {
      const next = new Set<number>()
      for (const idx of prev) {
        if (idx < index) next.add(idx)
        else if (idx > index) next.add(idx - 1)
      }
      return next
    })
  }

  const updateRow = (index: number, field: 'key' | 'value', value: string) => {
    setRows(
      rows.map((row, i) => {
        if (i !== index) return row
        if (field === 'value') return { ...row, value, masked: false }
        // Renaming key on a masked row: clear value since backend can't match by old key
        if (row.masked) return { ...row, key: value, value: '', masked: false }
        return { ...row, key: value }
      }),
    )
  }

  const handleValueFocus = (index: number) => {
    const row = rows[index]
    if (row.masked) {
      setRows(
        rows.map((r, i) =>
          i === index ? { ...r, value: '', masked: false } : r,
        ),
      )
    }
  }

  const toggleVisibility = (index: number) => {
    setVisibleIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleImport = () => {
    const parsed: EnvRow[] = []
    for (const line of importText.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex <= 0) continue
      const key = trimmed.slice(0, eqIndex).trim()
      let value = trimmed.slice(eqIndex + 1).trim()
      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      parsed.push({ key, value })
    }
    if (parsed.length === 0) return

    setRows((prev) => {
      const merged = [...prev]
      for (const item of parsed) {
        const existing = merged.findIndex((r) => r.key === item.key)
        if (existing >= 0) {
          merged[existing] = { ...item, masked: false }
        } else {
          merged.push(item)
        }
      }
      return merged
    })
    setImportText('')
    setShowImport(false)
    toast.success(t('envImported', { count: parsed.length }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const vars = rows
        .filter((r) => r.key.trim())
        .map((r) => ({ key: r.key.trim(), value: r.value }))

      const res = await fetch(`/api/projects/${projectId}/env`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars }),
      })

      if (res.ok) {
        toast.success(t('envSaved'))
        const fresh = await fetch(`/api/projects/${projectId}/env`).then((r) =>
          r.json(),
        )
        if (Array.isArray(fresh)) {
          setRows(
            fresh.map((d: { key: string; value: string }) => ({
              key: d.key,
              value: d.value,
              masked: true,
            })),
          )
          setInitialCount(fresh.length)
          setVisibleIndices(new Set())
        }
      } else {
        toast.error(t('envSaveFailed'))
      }
    } catch {
      toast.error(t('envSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">{t('loading')}</div>
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="text-muted-foreground text-sm">{t('noEnvVars')}</div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder={t('envKeyPlaceholder')}
                value={row.key}
                onChange={(e) => updateRow(index, 'key', e.target.value)}
                className="flex-1 font-mono"
              />
              <div className="relative flex-1">
                <Input
                  type={visibleIndices.has(index) ? 'text' : 'password'}
                  placeholder={t('envValuePlaceholder')}
                  value={row.value}
                  onFocus={() => handleValueFocus(index)}
                  onChange={(e) => updateRow(index, 'value', e.target.value)}
                  className="pr-9 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0 h-9 w-9"
                  onClick={() => toggleVisibility(index)}
                >
                  {visibleIndices.has(index) ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {showImport && (
        <div className="space-y-2">
          <Textarea
            placeholder={t('envImportPlaceholder')}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className="h-32 font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleImport}
              disabled={!importText.trim()}
            >
              {t('envImportConfirm')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowImport(false)
                setImportText('')
              }}
            >
              {t('envImportCancel')}
            </Button>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="mr-1 h-4 w-4" />
          {t('addEnvVar')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowImport(!showImport)}
        >
          <FileUp className="mr-1 h-4 w-4" />
          {t('envImport')}
        </Button>
        {(rows.length > 0 || initialCount > 0) && (
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {saving ? t('savingEnvVars') : t('saveEnvVars')}
          </Button>
        )}
      </div>
    </div>
  )
}
