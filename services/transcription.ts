import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '../lib/supabase';

const MAX_AUDIO_SIZE = 20 * 1024 * 1024;

export async function transcribeReflectionAudio(uri: string): Promise<string> {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('NÃ£o foi possÃ­vel ler a gravaÃ§Ã£o.');
    const audio = await response.blob();
    if (audio.size > MAX_AUDIO_SIZE) throw new Error('A gravaÃ§Ã£o ficou grande demais. FaÃ§a uma gravaÃ§Ã£o mais curta.');
    formData.append('audio', audio, 'reflexao.webm');
  } else {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) throw new Error('A gravaÃ§Ã£o temporÃ¡ria nÃ£o foi encontrada.');
    if (fileInfo.size > MAX_AUDIO_SIZE) throw new Error('A gravaÃ§Ã£o ficou grande demais. FaÃ§a uma gravaÃ§Ã£o mais curta.');
    formData.append('audio', {
      uri,
      name: 'reflexao.m4a',
      type: 'audio/mp4',
    } as unknown as Blob);
  }

  const { data, error } = await supabase.functions.invoke('transcribe-reflection', {
    body: formData,
  });

  if (error) {
    if (/401|unauthorized/i.test(error.message)) {
      throw new Error('Entre na sua conta pelo Perfil antes de transcrever uma reflexÃ£o.');
    }
    throw new Error('NÃ£o foi possÃ­vel acessar a transcriÃ§Ã£o. Confira a configuraÃ§Ã£o da funÃ§Ã£o Supabase.');
  }

  if (typeof data?.text !== 'string' || !data.text.trim()) {
    throw new Error('A transcriÃ§Ã£o nÃ£o retornou texto. Tente gravar novamente.');
  }

  return data.text.trim();
}

export async function discardTransientRecording(uri: string) {
  if (Platform.OS === 'web') {
    if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
    return;
  }

  await FileSystem.deleteAsync(uri, { idempotent: true });
}
