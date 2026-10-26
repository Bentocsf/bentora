import COLORS from '../theme/colors';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  useWindowDimensions,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useSQLiteContext } from 'expo-sqlite';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { LibraryStackParamList } from '../navigation/LibraryStack';
import { CatalogBook, searchBookCatalog } from '../services/bookCatalog';

type Props = NativeStackScreenProps<
  LibraryStackParamList,
  'LibraryList'
>;

type Book = {
  id: number;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  status: string;
  coverUri: string | null;
  fileUri: string | null;
  fileType: 'pdf' | 'epub' | null;
  readerPosition: string | null;
};

const statuses = ['Todos', 'Quero ler', 'Lendo', 'Concluído'] as const;

export default function LibraryScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const numColumns = width >= 700 ? 5 : width >= 500 ? 4 : 3;
  const tileWidth = (width - 40 - 12 * (numColumns - 1)) / numColumns;

  const [books, setBooks] = useState<Book[]>([]);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');

  const [coverUri, setCoverUri] = useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addMode, setAddMode] = useState<'manual' | 'catalog'>('manual');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState<CatalogBook[]>([]);
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogBook[]>([]);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const catalogCache = useRef(new Map<string, CatalogBook[]>());

  // Busca os livros salvos no banco de dados
  const loadBooks = useCallback(async () => {
    const result = selectedStatus === 'Todos'
      ? await db.getAllAsync<Book>('SELECT * FROM books ORDER BY id DESC')
      : await db.getAllAsync<Book>(
          'SELECT * FROM books WHERE status = ? ORDER BY id DESC',
          selectedStatus
        );

    setBooks(result);
  }, [db, selectedStatus]);

  useEffect(() => {
    const query = catalogQuery.trim();
    if (!suggestionsVisible || query.length < 3) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const cacheKey = query.toLocaleLowerCase();
      setSuggestionsLoading(true);
      try {
        const cached = catalogCache.current.get(cacheKey);
        const results = cached ?? await searchBookCatalog(query, { limit: 7, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!cached) catalogCache.current.set(cacheKey, results);
        setCatalogSuggestions(results);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          setCatalogSuggestions([]);
          setCatalogError(error instanceof Error && error.message.includes('429')
            ? 'O catálogo limitou as sugestões. Toque em Buscar para tentar novamente.'
            : 'Não foi possível carregar sugestões. Você ainda pode tocar em Buscar.');
        }
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 550);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [catalogQuery, suggestionsVisible]);

  // Seleciona uma imagem da galeria
  const selectCover = async () => {
    Keyboard.dismiss();

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      setCoverUri(result.assets[0].uri);
    }
  };

  const searchCatalog = async () => {
    Keyboard.dismiss();
    if (!catalogQuery.trim()) {
      setCatalogError('Digite o título ou autor do livro.');
      setCatalogResults([]);
      return;
    }
    setCatalogLoading(true);
    setCatalogError('');
    setSuggestionsVisible(false);
    setCatalogSuggestions([]);
    try {
      const results = await searchBookCatalog(catalogQuery);
      setCatalogResults(results);
      if (results.length === 0) setCatalogError('Nenhum livro encontrado.');
    } catch (error) {
      console.error(error);
      setCatalogError(error instanceof Error && error.message.includes('429')
        ? 'O catálogo limitou as pesquisas por enquanto. Aguarde um pouco e tente novamente.'
        : 'Não foi possível pesquisar agora. Verifique sua conexão e tente novamente.');
      setCatalogResults([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  const chooseCatalogSuggestion = (item: CatalogBook) => {
    Keyboard.dismiss();
    setCatalogQuery(item.title);
    setCatalogSuggestions([]);
    setSuggestionsVisible(false);
    setCatalogError('');
    setCatalogResults([item]);
  };

  const addCatalogBook = async (item: CatalogBook) => {
    Keyboard.dismiss();
    const author = item.authors.join(', ') || 'Autor desconhecido';
    if (!item.pageCount) {
      setTitle(item.title);
      setAuthor(author);
      setTotalPages('');
      setCoverUri(item.coverUri);
      setAddMode('manual');
      Alert.alert('Complete o cadastro', 'O catálogo não informou o total de páginas. Preencha esse dado no formulário para adicionar o livro.');
      return;
    }
    try {
      const duplicate = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM books WHERE lower(title) = lower(?) AND lower(author) = lower(?)',
        item.title,
        author
      );
      if (duplicate) {
        Alert.alert('Livro já cadastrado', 'Este título e autor já estão na sua biblioteca.');
        return;
      }
      await db.runAsync(
        `INSERT INTO books (title, author, totalPages, coverUri, status)
         VALUES (?, ?, ?, ?, 'Quero ler')`,
        item.title, author, item.pageCount, item.coverUri
      );
      await loadBooks();
      setAddModalVisible(false);
      Alert.alert('Livro adicionado', 'O livro foi incluído em Quero ler.');
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível adicionar este livro.');
    }
  };

  // Adiciona um livro ao banco de dados
  const addBook = async () => {
    Keyboard.dismiss();

    if (!title.trim() || !author.trim() || !totalPages.trim()) {
      Alert.alert('Atenção', 'Preencha todos os campos.');
      return;
    }

    const pages = Number(totalPages);

    if (!Number.isInteger(pages) || pages <= 0) {
      Alert.alert(
        'Atenção',
        'Informe uma quantidade de páginas válida.'
      );
      return;
    }

    try {
      let savedCoverUri: string | null = null;

      // Salva a imagem selecionada no armazenamento do aplicativo
      if (coverUri?.startsWith('http://') || coverUri?.startsWith('https://')) {
        savedCoverUri = coverUri;
      } else if (coverUri) {
        const directory = FileSystem.documentDirectory;

        if (!directory) {
          Alert.alert(
            'Erro',
            'Não foi possível acessar o armazenamento.'
          );
          return;
        }

        const fileExtension =
          coverUri.split('.').pop()?.split('?')[0] || 'jpg';

        const destination =
          `${directory}cover_${Date.now()}.${fileExtension}`;

        await FileSystem.copyAsync({
          from: coverUri,
          to: destination,
        });

        savedCoverUri = destination;
      }

      // Insere o livro no banco de dados
      await db.runAsync(
        `INSERT INTO books
        (title, author, totalPages, coverUri)
        VALUES (?, ?, ?, ?)`,
        title.trim(),
        author.trim(),
        pages,
        savedCoverUri
      );

      // Limpa os campos do formulário
      setTitle('');
      setAuthor('');
      setTotalPages('');
      setCoverUri(null);
      setAddModalVisible(false);

      // Atualiza a lista de livros
      await loadBooks();

      Alert.alert('Sucesso', 'Livro adicionado à biblioteca!');
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Erro',
        'Não foi possível adicionar o livro.'
      );
    }
  };

  // Exclui um livro
  const deleteBook = async (id: number) => {
    Keyboard.dismiss();
    Alert.alert('Excluir livro?', 'As reflexões associadas a este livro também serão excluídas.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        const book = await db.getFirstAsync<{ fileUri: string | null }>(
          'SELECT fileUri FROM books WHERE id = ?', id
        );
        if (book?.fileUri && FileSystem.documentDirectory
          && book.fileUri.startsWith(FileSystem.documentDirectory)) {
          await FileSystem.deleteAsync(book.fileUri, { idempotent: true });
        }
        await db.runAsync('DELETE FROM readerBookmarks WHERE bookId = ?', id);
        await db.runAsync('DELETE FROM reflections WHERE bookId = ?', id);
        await db.runAsync('DELETE FROM books WHERE id = ?', id);
        await loadBooks();
      } },
    ]);
  };

  // Abre a tela de detalhes do livro
  const openBookDetails = (item: Book) => {
    Keyboard.dismiss();

    navigation.navigate('BookDetails', {
      id: item.id,
      title: item.title,
      author: item.author,
      totalPages: item.totalPages,
      currentPage: item.currentPage ?? 0,
      status: item.status,
      coverUri: item.coverUri,
      fileUri: item.fileUri,
      fileType: item.fileType,
      readerPosition: item.readerPosition,
    });
  };

  // Carrega os livros ao abrir a tela
  useFocusEffect(useCallback(() => { void loadBooks(); }, [loadBooks]));

  // Componente que representa cada livro da lista
  const renderBook = (item: Book) => {
    return (
      <View style={[styles.bookTile, { width: tileWidth }]}>
        <TouchableOpacity
          style={styles.bookOpen}
          activeOpacity={0.9}
          onPress={() => openBookDetails(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${item.author}, ${item.status}. Abrir detalhes.`}
        >
          {item.coverUri ? (
            <Image source={{ uri: item.coverUri }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={styles.coverPlaceholder}><Text style={styles.placeholderText}>Sem capa</Text></View>
          )}
          <View style={styles.bookInfo}>
            <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.bookAuthor} numberOfLines={1}>{item.author}</Text>
            <Text style={styles.bookStatus} numberOfLines={1}>{item.status}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteTileButton}
          onPress={() => void deleteBook(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`Excluir ${item.title}`}
        >
          <Text style={styles.deleteTileText}>×</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topBar}>
          <Text style={styles.screenTitle}>Minha Biblioteca</Text>
          <TouchableOpacity
            style={styles.openAddButton}
            onPress={() => setAddModalVisible(true)}
            accessibilityRole="button"
          >
            <Text style={styles.openAddButtonText}>+ Adicionar</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          key={`books-${numColumns}`}
          data={books}
          numColumns={numColumns}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => renderBook(item)}
          columnWrapperStyle={styles.bookRow}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={(
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
                {statuses.map((status) => (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setSelectedStatus(status)}
                    style={[styles.filterChip, selectedStatus === status && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterText, selectedStatus === status && styles.filterTextActive]}>{status}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.listTitle}>Seus livros</Text>
            </>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Sua biblioteca está vazia.</Text>}
        />
      </View>

      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={Keyboard.dismiss}
            accessibilityLabel="Fechar teclado"
          />
          <View style={styles.modalSheet}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={Keyboard.dismiss}
              accessibilityLabel="Recolher teclado"
            />
            <View style={styles.modalHeading}>
              <Text style={styles.modalTitle}>Adicionar livro</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} accessibilityRole="button">
                <Text style={styles.modalClose}>Fechar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modeTabs}>
              <TouchableOpacity onPress={() => setAddMode('manual')} style={[styles.modeTab, addMode === 'manual' && styles.modeTabActive]}>
                <Text style={[styles.modeTabText, addMode === 'manual' && styles.modeTabTextActive]}>Cadastro manual</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAddMode('catalog')} style={[styles.modeTab, addMode === 'catalog' && styles.modeTabActive]}>
                <Text style={[styles.modeTabText, addMode === 'catalog' && styles.modeTabTextActive]}>Buscar catálogo</Text>
              </TouchableOpacity>
            </View>

            {addMode === 'manual' ? (
              <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalForm} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                <TextInput style={styles.input} placeholder="Título do livro" placeholderTextColor={COLORS.textSecondary} selectionColor={COLORS.background} value={title} onChangeText={setTitle} returnKeyType="next" />
                <TextInput style={styles.input} placeholder="Autor" placeholderTextColor={COLORS.textSecondary} selectionColor={COLORS.background} value={author} onChangeText={setAuthor} returnKeyType="next" />
                <TextInput style={styles.input} placeholder="Quantidade de páginas" placeholderTextColor={COLORS.textSecondary} selectionColor={COLORS.background} value={totalPages} onChangeText={setTotalPages} keyboardType="numeric" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
                <TouchableOpacity style={styles.selectCoverButton} onPress={() => void selectCover()}>
                  <Text style={styles.selectCoverButtonText}>Escolher capa</Text>
                </TouchableOpacity>
                {coverUri ? <Image source={{ uri: coverUri }} style={styles.coverPreview} /> : null}
                <TouchableOpacity style={styles.addButton} onPress={() => void addBook()}>
                  <Text style={styles.addButtonText}>Adicionar à biblioteca</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalForm} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                <Text style={styles.catalogDescription}>Encontre livros pelo título ou autor no catálogo Open Library.</Text>
                <View style={styles.catalogSearchRow}>
                  <TextInput
                    style={[styles.input, styles.catalogInput]}
                    placeholder="Título ou autor"
                    placeholderTextColor={COLORS.textSecondary}
                    selectionColor={COLORS.background}
                    value={catalogQuery}
                    onChangeText={(value) => {
                      setCatalogQuery(value);
                      setCatalogResults([]);
                      setCatalogError('');
                      setCatalogSuggestions([]);
                      setSuggestionsVisible(value.trim().length >= 3);
                    }}
                    onFocus={() => setSuggestionsVisible(catalogQuery.trim().length >= 3)}
                    onSubmitEditing={() => void searchCatalog()}
                    returnKeyType="search"
                    accessibilityLabel="Pesquisar livros no catálogo"
                  />
                  <TouchableOpacity style={styles.catalogSearchButton} onPress={() => void searchCatalog()} disabled={catalogLoading}>
                    <Text style={styles.addButtonText}>{catalogLoading ? '...' : 'Buscar'}</Text>
                  </TouchableOpacity>
                </View>
                {suggestionsVisible && catalogQuery.trim().length >= 3 ? (
                  <View style={styles.suggestionsList}>
                    {suggestionsLoading && catalogSuggestions.length === 0 ? <Text style={styles.catalogMessage}>Buscando sugestões...</Text> : null}
                    {catalogSuggestions.map((item) => (
                      <TouchableOpacity key={item.id} onPress={() => chooseCatalogSuggestion(item)} style={styles.suggestionItem}>
                        <Text style={styles.suggestionTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.suggestionAuthor} numberOfLines={1}>{item.authors.join(', ') || 'Autor não informado'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                {catalogError ? <Text style={styles.catalogMessage}>{catalogError}</Text> : null}
                {catalogResults.map((item) => (
                  <View key={item.id} style={styles.catalogResult}>
                    {item.coverUri ? <Image source={{ uri: item.coverUri }} style={styles.catalogCover} /> : <View style={[styles.catalogCover, styles.catalogCoverPlaceholder]}><Text style={styles.placeholderText}>Sem capa</Text></View>}
                    <View style={styles.catalogInfo}>
                      <Text style={styles.bookTitle}>{item.title}</Text>
                      <Text style={styles.bookAuthor}>{item.authors.join(', ') || 'Autor não informado'}</Text>
                      <Text style={styles.bookPages}>{item.pageCount ? `${item.pageCount} páginas` : 'Total de páginas não informado'}</Text>
                      <TouchableOpacity style={styles.catalogAddButton} onPress={() => void addCatalogBook(item)}>
                        <Text style={styles.detailsButtonText}>Adicionar à biblioteca</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },

  openAddButton: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 20,
  },

  openAddButtonText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '700',
  },

  gridContent: {
    paddingBottom: 28,
  },

  bookRow: {
    gap: 12,
    marginBottom: 18,
  },

  bookTile: {
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 0,
    position: 'relative',
  },

  bookOpen: {
    flex: 1,
  },

  deleteTileButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#173F35CC',
  },

  deleteTileText: {
    color: COLORS.surface,
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '700',
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#00000066',
  },

  modalSheet: {
    position: 'relative',
    flexShrink: 1,
    maxHeight: '92%',
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: COLORS.cream,
  },

  modalHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  modalTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: '700',
  },

  modalClose: {
    color: COLORS.background,
    fontWeight: '600',
    padding: 8,
  },

  modeTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    padding: 4,
    borderRadius: 12,
    marginBottom: 12,
  },

  modeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },

  modeTabActive: {
    backgroundColor: COLORS.background,
  },

  modeTabText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },

  modeTabTextActive: {
    color: COLORS.surface,
  },

  modalForm: {
    paddingTop: 8,
    paddingBottom: 18,
  },

  modalBody: {
    flexShrink: 1,
  },

  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: COLORS.text,
  },

  filters: { flexGrow: 0, marginBottom: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: COLORS.surfaceAlt, marginRight: 8 },
  filterChipActive: { backgroundColor: COLORS.background },
  filterText: { color: COLORS.background, fontWeight: '600' },
  filterTextActive: { color: COLORS.surface },

  form: {
    backgroundColor: COLORS.surface,
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },

  catalogCard: { backgroundColor: COLORS.surface, padding: 15, borderRadius: 12, marginBottom: 16 },
  catalogTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  catalogDescription: { color: COLORS.textSecondary, fontSize: 13, marginTop: 5, marginBottom: 10 },
  catalogSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catalogInput: { flex: 1, marginBottom: 0 },
  catalogSearchButton: { backgroundColor: COLORS.background, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  catalogMessage: { color: COLORS.textSecondary, marginTop: 10 },
  suggestionsList: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.surfaceAlt, borderRadius: 8, marginTop: 6 },
  suggestionItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt },
  suggestionTitle: { color: COLORS.text, fontWeight: '600' },
  suggestionAuthor: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  catalogResult: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.surfaceAlt, paddingTop: 12, marginTop: 12 },
  catalogCover: { width: 64, height: 96, borderRadius: 6, resizeMode: 'cover' },
  catalogCoverPlaceholder: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  catalogInfo: { flex: 1, marginLeft: 12 },
  catalogAddButton: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: COLORS.surfaceAlt, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },

  input: {
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.text,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 16,
  },

  selectCoverButton: {
    backgroundColor: COLORS.surfaceAlt,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },

  selectCoverButtonText: {
    color: COLORS.background,
    fontWeight: 'bold',
    fontSize: 15,
  },

  coverPreview: {
    width: 100,
    height: 150,
    resizeMode: 'cover',
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 12,
  },

  addButton: {
    backgroundColor: COLORS.gold,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },

  addButtonText: {
    color: COLORS.surface,
    fontWeight: 'bold',
    fontSize: 16,
  },

  listTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },

  coverImage: {
    width: '100%',
    aspectRatio: 0.68,
    borderRadius: 9,
    backgroundColor: COLORS.surfaceAlt,
    marginBottom: 7,
  },

  coverPlaceholder: {
    width: '100%',
    aspectRatio: 0.68,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },

  placeholderText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },

  bookInfo: {
    paddingHorizontal: 2,
  },

  bookTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },

  bookAuthor: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },

  bookPages: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },

  bookStatus: {
    fontSize: 10,
    color: COLORS.background,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  progressContainer: {
    marginTop: 10,
    marginBottom: 10,
  },

  progressBackground: {
    height: 8,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: COLORS.background,
    borderRadius: 10,
  },

  progressText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 5,
  },

  currentPageLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },

  currentPageInput: {
    backgroundColor: COLORS.surfaceAlt,
    padding: 10,
    borderRadius: 8,
    fontSize: 15,
    marginBottom: 8,
  },

  updateButton: {
    backgroundColor: COLORS.background,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
  },

  updateButtonText: {
    color: COLORS.surface,
    fontWeight: 'bold',
    fontSize: 13,
  },

  detailsButton: {
    backgroundColor: COLORS.surfaceAlt,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },

  detailsButtonText: {
    color: COLORS.background,
    fontWeight: 'bold',
    fontSize: 13,
  },

  deleteButton: {
    backgroundColor: COLORS.dangerSurface,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
  },

  deleteButtonText: {
    color: COLORS.danger,
    fontWeight: 'bold',
    fontSize: 13,
  },

  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: 20,
    marginBottom: 20,
  },
});
