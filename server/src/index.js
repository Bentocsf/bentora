import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';

const app = express();
const port = Number(process.env.PORT || 3001);
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    const supportedExtension = /\.(m4a|mp4|mp3|mpeg|mpga|wav|webm)$/i.test(file.originalname);
    if (supportedExtension) {
      callback(null, true);
      return;
    }

    callback(new Error('Envie uma gravação M4A, MP3, WAV ou WebM.'));
  },
});

app.use(cors({
  origin(origin, callback) {
    // Apps nativos não enviam Origin; no navegador, só libera origens locais configuradas.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
}));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.post('/api/transcriptions', upload.single('audio'), async (request, response) => {
  if (!process.env.OPENAI_API_KEY) {
    response.status(503).json({ error: 'Configure OPENAI_API_KEY no arquivo server/.env.' });
    return;
  }

  if (!request.file) {
    response.status(400).json({ error: 'Nenhum arquivo de áudio foi recebido.' });
    return;
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const audioFile = new File(
      [request.file.buffer],
      request.file.originalname,
      { type: request.file.mimetype || 'audio/mp4' }
    );
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'gpt-transcribe',
    });

    response.json({ text: transcription.text.trim() });
  } catch (error) {
    console.error('Falha na transcrição:', error instanceof Error ? error.message : 'erro desconhecido');
    response.status(502).json({ error: 'Não foi possível transcrever o áudio. Tente novamente.' });
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    response.status(413).json({ error: 'A gravação é grande demais. Faça uma gravação mais curta.' });
    return;
  }

  if (error instanceof Error) {
    response.status(400).json({ error: error.message });
    return;
  }

  response.status(500).json({ error: 'Ocorreu um erro inesperado no servidor.' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`API local do Bentora disponível na porta ${port}.`);
});
