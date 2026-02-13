import { NextResponse } from 'next/server'
import { getSettings, addGitCredential } from '@/lib/data/settings'

export async function GET() {
  const settings = await getSettings()
  // 不返回敏感信息
  return NextResponse.json(
    settings.gitCredentials.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      username: c.username,
      hasPassword: !!c.password,
      hasSshKey: !!c.sshKey,
    })),
  )
}

export async function POST(request: Request) {
  const body = await request.json()

  if (!body.name || !body.type) {
    return NextResponse.json(
      { error: 'Missing required fields: name, type' },
      { status: 400 },
    )
  }

  const credential = await addGitCredential({
    name: body.name,
    type: body.type,
    username: body.username,
    password: body.password,
    sshKey: body.sshKey,
  })

  // addGitCredential 已经返回 SafeGitCredential 类型
  return NextResponse.json(credential, { status: 201 })
}
