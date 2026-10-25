import COLORS from '../theme/colors';

import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';

type Book = { id: number; title: string };
type Reflection = { id: number; bookId: number; bookTitle: string; content: string; referenceType: string | null; referenceValue: string | null };

export default function DiaryScreen() {
  const db = useSQLiteContext();
  const [books, setBooks] = useState<Book[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [bookId, setBookId] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [referenceType, setReferenceType] = useState<'Página' | 'Capítulo'>('Página');
  const [referenceValue, setReferenceValue] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
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
  saveButton: { marginTop: 16, backgroundColor: COLORS.text, padding: 13, borderRadius: 8, alignItems: 'center' }, saveText: { color: COLORS.cream, fontWeight: 'bold' }, cancelButton: { padding: 10, alignItems: 'center' }, cancelText: { color: COLORS.textSecondary },
  sectionTitle: { fontSize: 20, color: COLORS.text, fontWeight: 'bold', marginBottom: 10 }, searchInput: { backgroundColor: COLORS.surface, padding: 12, borderRadius: 8, marginBottom: 12 }, empty: { color: COLORS.textSecondary, marginTop: 12 }, reflectionCard: { padding: 16, backgroundColor: COLORS.surface, borderRadius: 12, marginBottom: 12 }, bookName: { color: COLORS.backgroundLight, fontSize: 13, fontWeight: 'bold', marginBottom: 8 }, reflectionContent: { color: COLORS.text, fontSize: 16, lineHeight: 23, marginBottom: 12 }, action: { color: COLORS.text, fontWeight: '600', marginRight: 20 }, delete: { color: COLORS.danger, fontWeight: '600' },
});
