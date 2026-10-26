import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const TRANSCRIPTION_API_URL = process.env.EXPO_PUBLIC_TRANSCRIPTION_API_URL?.replace(/\/$/, '');

export const isTranscriptionConfigured = Boolean(TRANSCRIPTION_API_URL);

export async function transcribeReflectionAudio(uri: string): Promise<string> {
  if (!TRANSCRIPTION_API_URL) {
    throw new Error('Configure EXPO_PUBLIC_TRANSCRIPTION_API_URL no arquivo .env do app.');
  }

  const formData = new FormData();
  const isWebBlob = Platform.OS === 'web' && (uri.startsWith('blob:') || uri.startsWith('data:'));

  if (isWebBlob) {
    const audioBlob = await (await fetch(uri)).blob();
    formData.append('audio', audioBlob, 'reflexao.webm');
  } else {
    const audioFile = {
      uri,
      name: 'reflexao.m4a',
      type: 'audio/mp4',
    };
    formData.append('audio', audioFile as unknown as Blob);
  }

  let response: Response;
  try {
    response = await fetch(`${TRANSCRIPTION_API_URL}/api/transcriptions`, {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new Error('Não foi possível acessar o backend. Confira o endereço e se o servidor está rodando.');
  }

  const result = await response.json().catch(() => null) as { text?: unknown; error?: unknown } | null;
  if (!response.ok) {
    throw new Error(typeof result?.error === 'string' ? result.error : 'Não foi possível transcrever o áudio.');
  }

  if (typeof result?.text !== 'string' || !result.text.trim()) {
    throw new Error('A transcrição não retornou texto. Tente gravar novamente.');
  }

  return result.text.trim();
}

export async function discardTransientRecording(uri: string) {
  if (Platform.OS === 'web') {
    if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
    return;
  }

  if (uri.startsWith('file://')) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
