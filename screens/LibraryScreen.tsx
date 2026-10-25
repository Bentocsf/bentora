import COLORS from '../theme/colors';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
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

  const [books, setBooks] = useState<Book[]>([]);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');

  const [coverUri, setCoverUri] = useState<string | null>(null);

  const [currentPages, setCurrentPages] = useState<Record<number, string>>({});
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
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

  // Atualiza o progresso de leitura de um livro
  const updateProgress = async (item: Book) => {
    Keyboard.dismiss();

    if (item.totalPages <= 0) {
      Alert.alert('Total de páginas ausente', 'Abra os detalhes do livro e informe o total de páginas antes de atualizar o progresso.');
      return;
    }

    const pageText =
      currentPages[item.id] ?? String(item.currentPage ?? 0);

    if (pageText.trim() === '') {
      Alert.alert(
        'Atenção',
        'Informe a página atual do livro.'
      );
      return;
    }

    const page = Number(pageText);

    if (
      !Number.isInteger(page) ||
      page < 0 ||
      page > item.totalPages
    ) {
      Alert.alert(
        'Atenção',
        `Informe uma página entre 0 e ${item.totalPages}.`
      );
      return;
    }

    // Define o status de acordo com o progresso
    let status = 'Quero ler';

    if (page === item.totalPages) {
      status = 'Concluído';
    } else if (page > 0) {
      status = 'Lendo';
    }

    try {
      // Salva a página atual e o status no banco de dados
      const startedAt = page > 0 ? new Date().toISOString() : null;
      const completedAt = page === item.totalPages ? new Date().toISOString() : null;
      await db.runAsync(
        `UPDATE books SET currentPage = ?, status = ?,
         startedAt = CASE WHEN ? IS NOT NULL AND startedAt IS NULL THEN ? ELSE startedAt END,
         completedAt = ? WHERE id = ?`,
        page, status, startedAt, startedAt, completedAt, item.id
      );

      await loadBooks();

      Alert.alert(
        'Progresso atualizado',
        `Você está na página ${page} de ${item.totalPages}.\nStatus: ${status}`
      );
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Erro',
        'Não foi possível atualizar o progresso.'
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
    const currentPage = item.currentPage ?? 0;

    const percentage =
      item.totalPages > 0
        ? Math.min(
            100,
            Math.round((currentPage / item.totalPages) * 100)
          )
        : 0;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.bookCard}
        activeOpacity={0.9}
        onPress={() => openBookDetails(item)}
      >
        {item.coverUri ? (
          <Image
            source={{ uri: item.coverUri }}
            style={styles.coverImage}
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.placeholderText}>
              Sem capa
            </Text>
          </View>
        )}

        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle}>
            {item.title}
          </Text>

          <Text style={styles.bookAuthor}>
            {item.author}
          </Text>

          <Text style={styles.bookPages}>
            {item.totalPages > 0 ? `${item.totalPages} páginas` : 'Total de páginas não informado'}
          </Text>

          <Text style={styles.bookStatus}>
            {item.status}
          </Text>

          {/* Progresso da leitura */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBackground}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${percentage}%` },
                ]}
              />
            </View>

            <Text style={styles.progressText}>
              {percentage}% concluído
            </Text>
          </View>

          {/* Campo para atualizar a página atual */}
          <Text style={styles.currentPageLabel}>
            Página atual:
          </Text>

          <TextInput
            style={styles.currentPageInput}
            value={
              currentPages[item.id] ??
              String(item.currentPage ?? 0)
            }
            onChangeText={(value) =>
              setCurrentPages((previous) => ({
                ...previous,
                [item.id]: value,
              }))
            }
            keyboardType="numeric"
            placeholder="Página"
            returnKeyType="done"
            onSubmitEditing={() => updateProgress(item)}
          />

          <TouchableOpacity
            style={styles.updateButton}
            onPress={() => updateProgress(item)}
          >
            <Text style={styles.updateButtonText}>
              Atualizar progresso
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => openBookDetails(item)}
          >
            <Text style={styles.detailsButtonText}>
              Ver detalhes
            </Text>
          </TouchableOpacity>

          {/* Botão para excluir o livro */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteBook(item.id)}
          >
            <Text style={styles.deleteButtonText}>
              Excluir
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.screenTitle}>
          Minha Biblioteca
        </Text>

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

        <View style={styles.catalogCard}>
          <Text style={styles.catalogTitle}>Pesquisar no catálogo</Text>
          <Text style={styles.catalogDescription}>Encontre livros pelo título ou autor usando o catálogo do Open Library.</Text>
          <View style={styles.catalogSearchRow}>
            <TextInput
              style={[styles.input, styles.catalogInput]}
              placeholder="Título ou autor"
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
          {suggestionsVisible && catalogQuery.trim().length >= 3 && (
            <View style={styles.suggestionsList}>
              {suggestionsLoading && catalogSuggestions.length === 0 ? <Text style={styles.catalogMessage}>Buscando sugestões...</Text> : null}
              {catalogSuggestions.map((item) => (
                <TouchableOpacity key={item.id} onPress={() => chooseCatalogSuggestion(item)} style={styles.suggestionItem}>
                  <Text style={styles.suggestionTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.suggestionAuthor} numberOfLines={1}>{item.authors.join(', ') || 'Autor não informado'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
        </View>

        {/* Formulário de cadastro */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Título do livro"
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
          />

          <TextInput
            style={styles.input}
            placeholder="Autor"
            value={author}
            onChangeText={setAuthor}
            returnKeyType="next"
          />

          <TextInput
            style={styles.input}
            placeholder="Quantidade de páginas"
            value={totalPages}
            onChangeText={setTotalPages}
            keyboardType="numeric"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />

          {/* Botão para selecionar a capa */}
          <TouchableOpacity
            style={styles.selectCoverButton}
            onPress={selectCover}
          >
            <Text style={styles.selectCoverButtonText}>
              Escolher capa
            </Text>
          </TouchableOpacity>

          {/* Prévia da capa selecionada */}
          {coverUri && (
            <Image
              source={{ uri: coverUri }}
              style={styles.coverPreview}
            />
          )}

          {/* Botão para adicionar o livro */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={addBook}
          >
            <Text style={styles.addButtonText}>
              Adicionar livro
            </Text>
          </TouchableOpacity>
        </View>

        {/* Título da lista */}
        <Text style={styles.listTitle}>
          Livros cadastrados
        </Text>

        {/* Lista de livros */}
        {books.length === 0 ? (
          <Text style={styles.emptyText}>
            Sua biblioteca está vazia.
          </Text>
        ) : (
          books.map((item) => renderBook(item))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    paddingHorizontal: 20,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 30,
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

  bookCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },

  coverImage: {
    width: 100,
    height: 150,
    resizeMode: 'cover',
    borderRadius: 8,
  },

  coverPlaceholder: {
    width: 100,
    height: 150,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },

  bookInfo: {
    flex: 1,
    marginLeft: 12,
  },

  bookTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },

  bookAuthor: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },

  bookPages: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },

  bookStatus: {
    fontSize: 13,
    color: COLORS.background,
    fontWeight: 'bold',
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
