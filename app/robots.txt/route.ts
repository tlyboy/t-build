export async function GET() {
  const body = `User-agent: *
Content-Signal: search=no,ai-input=no,ai-train=no
Disallow: /
`

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
