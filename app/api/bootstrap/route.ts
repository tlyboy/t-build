import { NextResponse } from 'next/server'
import {
  BootstrapError,
  bootstrapAdministrator,
  getBootstrapStatus,
} from '@/lib/auth/bootstrap'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(getBootstrapStatus())
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    username?: string
    password?: string
    organizationName?: string
  } | null

  try {
    const result = await bootstrapAdministrator(body ?? {})

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    if (error instanceof BootstrapError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      )
    }

    return NextResponse.json(
      { error: 'Failed to bootstrap administrator.' },
      { status: 500 },
    )
  }
}
