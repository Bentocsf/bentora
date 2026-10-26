import COLORS from '../theme/colors';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { NavigationProp, ParamListBase, useFocusEffect, useNavigation } from '@react-navigation/native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../lib/supabase';
import { discardTransientRecording, transcribeReflectionAudio } from '../services/transcription';

type Book = { id: number; title: string };
type Reflection = { id: number; bookId: number; bookTitle: string; content: string; referenceType: string | null; referenceValue: string | null };

export default function DiaryScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [books, setBooks] = useState<Book[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [bookId, setBookId] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [referenceType, setReferenceType] = useState<'Página' | 'Capítulo'>('Página');
  const [referenceValue, setReferenceValue] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingActiveRef = useRef(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setIsSignedIn(Boolean(data.session)));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session));
    });
    return () => subscription.unsubscribe();
  }, []);
  const loadData = useCallback(async () => {
    const [bookRows, reflectionRows] = await Promise.all([
      db.getAllAsync<Book>('SELECT id, title FROM books ORDER BY title COLLATE NOCASE'),
      db.getAllAsync<Reflection>(`SELECT r.id, r.bookId, b.title AS bookTitle, r.content, r.referenceType, r.referenceValue FROM reflections r JOIN books b ON b.id = r.bookId ORDER BY r.updatedAt DESC, r.id DESC`),
    ]);
    setBooks(bookRows);
    setReflections(reflectionRows);
    setBookId((current) => current && bookRows.some((book) => book.id === current) ? current : bookRows[0]?.id ?? null);
  }, [db]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  useFocusEffect(useCallback(() => () => {
    if (!recordingActiveRef.current) return;
    recordingActiveRef.current = false;
    void (async () => {
      try {
        await recorder.stop();
        if (recorder.uri) await discardTransientRecording(recorder.uri);
      } catch (error) {
        console.error(error);
      } finally {
        await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      }
    })();
  }, [recorder]));

  const startRecording = async () => {
    if (!isSignedIn) {
      Alert.alert('Entre para transcrever', 'Acesse Perfil e entre na sua conta antes de ditar uma reflexão.');
      return;
    }

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Permita o uso do microfone para ditar uma reflexão.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingActiveRef.current = true;
      setRecording(true);
    } catch (error) {
      console.error(error);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      Alert.alert('Erro ao gravar', 'Não foi possível iniciar a gravação. Verifique a permissão do microfone.');
    }
  };

  const finishRecording = async () => {
    recordingActiveRef.current = false;
    setRecording(false);
    setIsTranscribing(true);
    let audioUri: string | null = null;
    try {
      await recorder.stop();
      audioUri = recorder.uri;
      if (!audioUri) throw new Error('A gravação não foi encontrada. Tente novamente.');
      const transcript = await transcribeReflectionAudio(audioUri);
      setContent((current) => current.trim() ? `${current.trim()}\n\n${transcript}` : transcript);
      Alert.alert('Transcrição pronta', 'Revise e edite o texto antes de salvar a reflexão.');
    } catch (error) {
      console.error(error);
      Alert.alert('Não foi possível transcrever', error instanceof Error ? error.message : 'Tente gravar novamente.');
    } finally {
      const temporaryUri = audioUri ?? recorder.uri;
      if (temporaryUri) await discardTransientRecording(temporaryUri).catch((error) => console.error(error));
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      setIsTranscribing(false);
    }
  };

  const discardRecording = async () => {
    recordingActiveRef.current = false;
    setRecording(false);
    try {
      await recorder.stop();
    } catch (error) {
      console.error(error);
    } finally {
      if (recorder.uri) await discardTransientRecording(recorder.uri).catch((error) => console.error(error));
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }
  };

  const clearForm = () => { setContent(''); setReferenceValue(''); setEditingId(null); setReferenceType('Página'); };
  const saveReflection = async () => {
    if (!bookId) { Alert.alert('Adicione um livro', 'Cadastre um livro antes de criar uma reflexão.'); return; }
    if (!content.trim()) { Alert.alert('Reflexão vazia', 'Escreva uma ideia antes de salvar.'); return; }
    const reference = referenceValue.trim() || null;
    try {
      if (editingId) {
        await db.runAsync('UPDATE reflections SET bookId = ?, content = ?, referenceType = ?, referenceValue = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', bookId, content.trim(), reference ? referenceType : null, reference, editingId);
      } else {
        await db.runAsync('INSERT INTO reflections (bookId, content, referenceType, referenceValue) VALUES (?, ?, ?, ?)', bookId, content.trim(), reference ? referenceType : null, reference);
      }
      clearForm(); await loadData();
    } catch (error) { console.error(error); Alert.alert('Erro', 'Não foi possível salvar a reflexão.'); }
  };
  const editReflection = (item: Reflection) => { setEditingId(item.id); setBookId(item.bookId); setContent(item.content); setReferenceType(item.referenceType === 'Capítulo' ? 'Capítulo' : 'Página'); setReferenceValue(item.referenceValue ?? ''); };
  const deleteReflection = (id: number) => Alert.alert('Excluir reflexão?', 'Esta ação não pode ser desfeita.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: async () => { await db.runAsync('DELETE FROM reflections WHERE id = ?', id); if (editingId === id) clearForm(); await loadData(); } },
  ]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Meu Diário</Text>
      <Text style={styles.description}>Guarde ideias e aprendizados ligados às suas leituras.</Text>
      {books.length === 0 ? <Text style={styles.empty}>Cadastre um livro na biblioteca para começar seu diário.</Text> : <>
        <View style={styles.card}>
          <Text style={styles.label}>Livro</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>{books.map((book) => <TouchableOpacity key={book.id} onPress={() => setBookId(book.id)} style={[styles.chip, bookId === book.id && styles.chipActive]}><Text style={[styles.chipText, bookId === book.id && styles.chipTextActive]}>{book.title}</Text></TouchableOpacity>)}</ScrollView>
          <Text style={styles.label}>Reflexão</Text>
          <TextInput value={content} onChangeText={setContent} multiline placeholder="O que você pensou, questionou ou aprendeu?" style={styles.textArea} textAlignVertical="top" />
          <View style={styles.voiceSection}>
            <Text style={styles.voiceNotice}>O áudio é enviado à Supabase para transcrição via OpenAI. A gravação temporária é apagada do aparelho após o processamento; revise o texto antes de salvar.</Text>
            {!isSignedIn ? (
              <TouchableOpacity style={styles.voiceButton} onPress={() => navigation.navigate('Perfil')}>
                <Ionicons name="person-outline" size={19} color={COLORS.cream} />
                <Text style={styles.voiceButtonText}>Entre no Perfil para ditar</Text>
              </TouchableOpacity>
            ) : recording ? (
              <>
                <Text style={styles.recordingStatus}>Gravando · {Math.floor(recorderState.durationMillis / 1000)} s</Text>
                <View style={styles.voiceButtons}>
                  <TouchableOpacity style={[styles.voiceButton, styles.stopButton]} onPress={() => void finishRecording()}>
                    <Ionicons name="stop-circle-outline" size={20} color={COLORS.cream} />
                    <Text style={styles.voiceButtonText}>Parar e transcrever</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.discardButton} onPress={() => void discardRecording()}>
                    <Text style={styles.discardButtonText}>Descartar</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity style={[styles.voiceButton, isTranscribing && styles.voiceButtonDisabled]} onPress={() => void startRecording()} disabled={isTranscribing}>
                <Ionicons name={isTranscribing ? 'hourglass-outline' : 'mic-outline'} size={20} color={COLORS.cream} />
                <Text style={styles.voiceButtonText}>{isTranscribing ? 'Transcrevendo…' : 'Ditar reflexão'}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.label}>Referência (opcional)</Text>
          <View style={styles.row}>{(['Página', 'Capítulo'] as const).map((type) => <TouchableOpacity key={type} onPress={() => setReferenceType(type)} style={[styles.chip, referenceType === type && styles.chipActive]}><Text style={[styles.chipText, referenceType === type && styles.chipTextActive]}>{type}</Text></TouchableOpacity>)}<TextInput value={referenceValue} onChangeText={setReferenceValue} placeholder={referenceType === 'Página' ? 'Nº' : 'Nome ou nº'} style={styles.referenceInput} /></View>
          <TouchableOpacity onPress={() => void saveReflection()} style={styles.saveButton}><Text style={styles.saveText}>{editingId ? 'Salvar alterações' : 'Salvar reflexão'}</Text></TouchableOpacity>
          {editingId && <TouchableOpacity onPress={clearForm} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar edição</Text></TouchableOpacity>}
        </View>
        <Text style={styles.sectionTitle}>Reflexões anteriores</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="Pesquisar reflexões" style={styles.searchInput} />
        {reflections.length === 0 ? <Text style={styles.empty}>Suas reflexões aparecerão aqui.</Text> : reflections.filter((item) => `${item.bookTitle} ${item.content} ${item.referenceValue ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map((item) => <View key={item.id} style={styles.reflectionCard}>
          <Text style={styles.bookName}>{item.bookTitle}{item.referenceValue ? ` · ${item.referenceType} ${item.referenceValue}` : ''}</Text><Text style={styles.reflectionContent}>{item.content}</Text>
          <View style={styles.row}><TouchableOpacity onPress={() => editReflection(item)}><Text style={styles.action}>Editar</Text></TouchableOpacity><TouchableOpacity onPress={() => deleteReflection(item.id)}><Text style={styles.delete}>Excluir</Text></TouchableOpacity></View>
        </View>)}
      </>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream }, content: { padding: 20, paddingTop: 54, paddingBottom: 36 },
  title: { fontSize: 26, fontWeight: 'bold', color: COLORS.text }, description: { fontSize: 15, color: COLORS.textSecondary, marginTop: 6, marginBottom: 20 },
  card: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 14, marginBottom: 22 }, label: { color: COLORS.text, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  chip: { backgroundColor: COLORS.surfaceAlt, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18, marginRight: 8, marginBottom: 4 }, chipActive: { backgroundColor: COLORS.text }, chipText: { color: COLORS.text }, chipTextActive: { color: COLORS.cream },
  textArea: { minHeight: 120, backgroundColor: COLORS.surfaceAlt, padding: 12, borderRadius: 8, fontSize: 16 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, referenceInput: { flex: 1, minWidth: 60, backgroundColor: COLORS.surfaceAlt, padding: 10, borderRadius: 8 },
  voiceSection: { marginTop: 12, padding: 12, backgroundColor: COLORS.surfaceAlt, borderRadius: 10 },
  voiceNotice: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  voiceButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voiceButton: { flexDirection: 'row', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.background, padding: 12, borderRadius: 8 },
  stopButton: { backgroundColor: COLORS.danger },
  voiceButtonDisabled: { opacity: 0.5 },
  voiceButtonText: { color: COLORS.cream, fontWeight: '700' },
  discardButton: { paddingHorizontal: 8, paddingVertical: 10 },
  discardButtonText: { color: COLORS.danger, fontWeight: '600' },
  recordingStatus: { color: COLORS.danger, fontWeight: '700', marginBottom: 8 },
  saveButton: { marginTop: 16, backgroundColor: COLORS.text, padding: 13, borderRadius: 8, alignItems: 'center' }, saveText: { color: COLORS.cream, fontWeight: 'bold' }, cancelButton: { padding: 10, alignItems: 'center' }, cancelText: { color: COLORS.textSecondary },
  sectionTitle: { fontSize: 20, color: COLORS.text, fontWeight: 'bold', marginBottom: 10 }, searchInput: { backgroundColor: COLORS.surface, padding: 12, borderRadius: 8, marginBottom: 12 }, empty: { color: COLORS.textSecondary, marginTop: 12 }, reflectionCard: { padding: 16, backgroundColor: COLORS.surface, borderRadius: 12, marginBottom: 12 }, bookName: { color: COLORS.backgroundLight, fontSize: 13, fontWeight: 'bold', marginBottom: 8 }, reflectionContent: { color: COLORS.text, fontSize: 16, lineHeight: 23, marginBottom: 12 }, action: { color: COLORS.text, fontWeight: '600', marginRight: 20 }, delete: { color: COLORS.danger, fontWeight: '600' },
});
