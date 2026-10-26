const MAX_AUDIO_SIZE = 20 * 1024 * 1024;
const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type EdgeRuntime = {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const edgeRuntime = (globalThis as typeof globalThis & { Deno: EdgeRuntime }).Deno;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

edgeRuntime.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'MÃ©todo nÃ£o permitido.' }, 405);

  const openAiApiKey = edgeRuntime.env.get('OPENAI_API_KEY');
  if (!openAiApiKey) return jsonResponse({ error: 'A transcriÃ§Ã£o ainda nÃ£o estÃ¡ configurada.' }, 503);

  let audio: FormDataEntryValue | null;
  try {
    const form = await request.formData();
    audio = (form as unknown as { get(name: string): FormDataEntryValue | null }).get('audio');
  } catch {
    return jsonResponse({ error: 'Envie uma gravaÃ§Ã£o de Ã¡udio vÃ¡lida.' }, 400);
  }

  if (!(audio instanceof File)) return jsonResponse({ error: 'Nenhum arquivo de Ã¡udio foi recebido.' }, 400);
  if (audio.size === 0) return jsonResponse({ error: 'A gravaÃ§Ã£o estÃ¡ vazia.' }, 400);
  if (audio.size > MAX_AUDIO_SIZE) return jsonResponse({ error: 'A gravaÃ§Ã£o ficou grande demais. FaÃ§a uma gravaÃ§Ã£o mais curta.' }, 413);

  const supportedAudio = /\.(m4a|mp4|mp3|mpeg|mpga|wav|webm)$/i.test(audio.name);
  if (!supportedAudio) return jsonResponse({ error: 'Formato de Ã¡udio nÃ£o suportado.' }, 415);

  const openAiForm = new FormData();
  openAiForm.set('file', audio, audio.name);
  openAiForm.set('model', 'gpt-transcribe');
  openAiForm.set('language', 'pt');

  try {
    const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiApiKey}` },
      body: openAiForm,
    });

    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502;
      return jsonResponse({ error: 'O serviÃ§o de transcriÃ§Ã£o nÃ£o conseguiu processar o Ã¡udio. Tente novamente.' }, status);
    }

    const result = await response.json() as { text?: unknown };
    if (typeof result.text !== 'string' || !result.text.trim()) {
      return jsonResponse({ error: 'A transcriÃ§Ã£o nÃ£o retornou texto.' }, 502);
    }

    return jsonResponse({ text: result.text.trim() });
  } catch {
    return jsonResponse({ error: 'NÃ£o foi possÃ­vel acessar o serviÃ§o de transcriÃ§Ã£o.' }, 502);
  }
});
