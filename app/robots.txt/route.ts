export async function GET() {
  const body = `# Content Signals
#
# search:   building a search index and providing search results.
# ai-input: inputting content into AI models (e.g., RAG, grounding).
# ai-train: training or fine-tuning AI models.

User-agent: *
Content-Signal: search=no,ai-input=no,ai-train=no
Disallow: /
`

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
