import { NextResponse } from 'next/server'
import {
  getGitCredentialById,
  updateGitCredential,
  deleteGitCredential,
} from '@/lib/data/settings'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const credential = await getGitCredentialById(id)

  if (!credential) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  }

  // 返回安全的凭证信息（不包含敏感数据）
  return NextResponse.json({
    id: credential.id,
    name: credential.name,
    type: credential.type,
    username: credential.username,
    hasPassword: !!credential.password,
    hasSshKey: !!credential.sshKey,
  })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json()

  const credential = await updateGitCredential(id, {
    name: body.name,
    type: body.type,
    username: body.username,
    password: body.password,
    sshKey: body.sshKey,
  })

  if (!credential) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  }

  // updateGitCredential 已经返回 SafeGitCredential 类型
  return NextResponse.json(credential)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const deleted = await deleteGitCredential(id)

  if (!deleted) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
