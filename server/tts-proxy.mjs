import { createServer } from 'node:http'

const port = Number(process.env.PORT ?? 8787)
const apiKey = process.env.OPENAI_API_KEY
const allowedFixture = {
  id: 'generic-transition-v1',
  text: 'Test participant. Begin the next interval.',
}

function respond(response, status, body, contentType = 'application/json') {
  response.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(body)
}

createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    respond(response, 200, JSON.stringify({ ready: Boolean(apiKey) }))
    return
  }
  if (request.method !== 'POST' || request.url !== '/api/tts') {
    respond(response, 404, JSON.stringify({ error: 'not found' }))
    return
  }
  if (!apiKey) {
    respond(response, 503, JSON.stringify({ error: 'provider not configured' }))
    return
  }

  try {
    let raw = ''
    for await (const chunk of request) {
      raw += chunk
      if (raw.length > 2_000) throw new Error('request too large')
    }
    const body = JSON.parse(raw)
    if (body.fixtureId !== allowedFixture.id || body.text !== allowedFixture.text) {
      respond(response, 400, JSON.stringify({ error: 'only the approved synthetic fixture is allowed' }))
      return
    }

    const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'coral', input: allowedFixture.text, response_format: 'mp3' }),
    })
    if (!upstream.ok || !upstream.body) {
      respond(response, 502, JSON.stringify({ error: 'provider request failed', status: upstream.status }))
      return
    }
    response.writeHead(200, {
      'content-type': upstream.headers.get('content-type') ?? 'audio/mpeg',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    })
    for await (const chunk of upstream.body) response.write(chunk)
    response.end()
  } catch (error) {
    respond(response, 400, JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request' }))
  }
}).listen(port, '127.0.0.1', () => {
  // Metadata only: never print keys or utterance text.
  console.log(`TTS proxy listening on http://127.0.0.1:${port}; fixture=${allowedFixture.id}`)
})
