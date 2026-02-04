'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Folder, ChevronUp, FolderOpen, Search } from 'lucide-react'

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

interface BrowseResponse {
  workDir: string
  currentPath: string
  parentPath: string | null
  entries: FileEntry[]
}

interface DirectoryPickerProps {
  value: string
  onChange: (path: string) => void
  disabled?: boolean
}

export function DirectoryPicker({ value, onChange, disabled }: DirectoryPickerProps) {
  const [open, setOpen] = useState(false)
  const [workDir, setWorkDir] = useState('')
  const [currentPath, setCurrentPath] = useState('')
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const fetchDirectory = async (relativePath: string = '') => {
    setLoading(true)
    setError('')
    try {
      const url = relativePath
        ? `/api/filesystem/browse?path=${encodeURIComponent(relativePath)}`
        : '/api/filesystem/browse'
      const res = await fetch(url)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to browse directory')
      }
      const data: BrowseResponse = await res.json()
      setWorkDir(data.workDir)
      setCurrentPath(data.currentPath)
      setParentPath(data.parentPath)
      setEntries(data.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      // 如果有当前值，尝试导航到那个目录
      fetchDirectory(value || '')
      setSearch('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 过滤目录列表
  const filteredEntries = search
    ? entries.filter(entry =>
        entry.name.toLowerCase().includes(search.toLowerCase())
      )
    : entries

  const handleNavigate = (path: string) => {
    setSearch('')
    fetchDirectory(path)
  }

  const handleGoUp = () => {
    if (parentPath !== null) {
      setSearch('')
      fetchDirectory(parentPath)
    }
  }

  const handleSelect = (path: string) => {
    onChange(path)
    setOpen(false)
  }

  const handleSelectCurrent = () => {
    onChange(currentPath === '/' ? '' : currentPath)
    setOpen(false)
  }

  const displayPath = workDir
    ? (currentPath === '/' ? workDir : `${workDir.replace(/\\/g, '/')}/${currentPath}`)
    : currentPath

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          <FolderOpen className="h-4 w-4 mr-2" />
          选择
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>选择目录</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 当前路径显示 */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleGoUp}
              disabled={parentPath === null}
              className="h-8 w-8"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-sm text-muted-foreground truncate font-mono bg-muted px-2 py-1 rounded">
              {displayPath}
            </div>
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="搜索目录..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          {/* 文件列表 */}
          <ScrollArea className="h-64 border rounded-md">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                加载中...
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {search ? '没有匹配的目录' : '此目录为空'}
              </div>
            ) : (
              <div className="p-2">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.path}
                    className="flex items-center justify-between hover:bg-muted rounded-md group"
                  >
                    <button
                      type="button"
                      className="flex-1 flex items-center gap-2 px-3 py-2 text-left"
                      onClick={() => handleNavigate(entry.path)}
                    >
                      <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <span className="truncate text-sm">{entry.name}</span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 mr-1"
                      onClick={() => handleSelect(entry.path)}
                    >
                      选择
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* 操作按钮 */}
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSelectCurrent}>
              选择当前目录
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
