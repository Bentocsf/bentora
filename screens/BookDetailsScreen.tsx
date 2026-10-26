import COLORS from '../theme/colors';

import React, { useState } from 'react';

import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import {
  LibraryStackParamList,
} from '../navigation/LibraryStack';

type Props = NativeStackScreenProps<
  LibraryStackParamList,
  'BookDetails'
>;

export default function BookDetailsScreen({
  route,
  navigation,
}: Props) {
  const book = route.params;
  const db = useSQLiteContext();
  const [currentPage, setCurrentPage] = useState(String(book.currentPage));
  const [totalPages, setTotalPages] = useState(book.totalPages);
  const [status, setStatus] = useState(book.status);
  const [fileUri, setFileUri] = useState(book.fileUri);
  const [fileType, setFileType] = useState(book.fileType);
  const [readerPosition, setReaderPosition] = useState(book.readerPosition);
  const [sessionMinutes, setSessionMinutes] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    void db.getFirstAsync<{
      currentPage: number;
      totalPages: number;
      status: string;
      fileUri: string | null;
      fileType: 'pdf' | 'epub' | null;
      readerPosition: string | null;
    }>('SELECT currentPage, totalPages, status, fileUri, fileType, readerPosition FROM books WHERE id = ?', book.id)
      .then((latest) => {
        if (!active || !latest) return;
        setCurrentPage(String(latest.currentPage ?? 0));
        setTotalPages(latest.totalPages);
        setStatus(latest.status);
        setFileUri(latest.fileUri);
        setFileType(latest.fileType);
        setReaderPosition(latest.readerPosition);
      });
    return () => { active = false; };
  }, [book.id, db]));

  const importBookFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/epub+zip'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    const selected = result.assets[0];
    const extension = selected.name.split('.').pop()?.toLowerCase();
    if (extension !== 'pdf' && extension !== 'epub') {
      Alert.alert('Formato inválido', 'Escolha um arquivo PDF ou EPUB.');
      return;
    }
    if (!FileSystem.documentDirectory) {
      Alert.alert('Erro', 'Não foi possível acessar o armazenamento do app.');
      return;
    }

    const destination = `${FileSystem.documentDirectory}book_${book.id}_${Date.now()}.${extension}`;
    try {
      await FileSystem.copyAsync({ from: selected.uri, to: destination });
      await db.runAsync(
        'UPDATE books SET fileUri = ?, fileType = ?, readerPosition = NULL WHERE id = ?',
        destination, extension, book.id
      );
      if (book.fileUri?.startsWith(FileSystem.documentDirectory)) {
        await FileSystem.deleteAsync(book.fileUri, { idempotent: true });
      }
      setFileUri(destination);
      setFileType(extension);
      setReaderPosition(null);
      Alert.alert('Arquivo adicionado', `${selected.name} está disponível para leitura no Bentora.`);
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível copiar o arquivo para a biblioteca.');
    }
  };

  const openReader = () => {
    if (!fileUri || !fileType) return;
    navigation.navigate('Reader', {
      id: book.id,
      title: book.title,
      fileUri,
      fileType,
      currentPage: Number(currentPage) || 0,
      totalPages,
      readerPosition,
    });
  };

  const percentage =
    totalPages > 0
      ? Math.min(
          100,
          Math.round(
            (Number(currentPage) / totalPages) * 100
          )
        )
      : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
      >
        {/* Botão para voltar */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>
            ← Voltar à biblioteca
          </Text>
        </TouchableOpacity>

        {/* Capa do livro */}
        {book.coverUri ? (
          <Image
            source={{ uri: book.coverUri }}
            style={styles.cover}
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.placeholderText}>
              Sem capa
            </Text>
          </View>
        )}

        {/* Informações do livro */}
        <Text style={styles.title}>
          {book.title}
        </Text>

        <Text style={styles.author}>
          {book.author}
        </Text>

        <Text style={styles.status}>
          {status}
        </Text>

        <View style={styles.progressCard}>
          <Text style={styles.sectionTitle}>Leitura no aplicativo</Text>
          <Text style={styles.pages}>
            {fileType ? `Arquivo ${fileType.toUpperCase()} adicionado` : 'Adicione um PDF ou EPUB para ler aqui.'}
          </Text>
          {fileUri ? (
            <>
              <TouchableOpacity style={styles.updateButton} onPress={openReader}>
                <Text style={styles.updateButtonText}>Continuar leitura</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.updateButton, { marginTop: 8, backgroundColor: COLORS.surfaceAlt }]} onPress={() => void importBookFile()}>
                <Text style={[styles.updateButtonText, { color: COLORS.background }]}>Substituir arquivo</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.updateButton} onPress={() => void importBookFile()}>
              <Text style={styles.updateButtonText}>Importar PDF ou EPUB</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Progresso da leitura */}
        <View style={styles.progressCard}>
          <Text style={styles.sectionTitle}>
            Seu progresso
          </Text>

          <Text style={styles.pages}>
            Página {currentPage} de {totalPages}
          </Text>

          <TextInput value={currentPage} onChangeText={setCurrentPage} keyboardType="numeric" placeholder="Página atual" style={styles.pageInput} />
          <Text style={styles.pages}>Minutos lidos nesta sessão (opcional)</Text>
          <TextInput value={sessionMinutes} onChangeText={setSessionMinutes} keyboardType="numeric" placeholder="Ex.: 25" style={styles.pageInput} />
          <TouchableOpacity style={styles.updateButton} onPress={async () => {
            const page = Number(currentPage);
            if (!Number.isInteger(page) || page < 0 || page > totalPages) {
              Alert.alert('Página inválida', `Informe uma página entre 0 e ${totalPages}.`);
              return;
            }
            const minutes = sessionMinutes.trim() ? Number(sessionMinutes) : 0;
            if (!Number.isInteger(minutes) || minutes < 0) {
              Alert.alert('Tempo inválido', 'Informe os minutos como um número inteiro positivo.');
              return;
            }
            const latestProgress = await db.getFirstAsync<{ currentPage: number }>('SELECT currentPage FROM books WHERE id = ?', book.id);
            const previousPage = latestProgress?.currentPage ?? book.currentPage ?? 0;
            const status = page === totalPages ? 'Concluído' : page > 0 ? 'Lendo' : 'Quero ler';
            const now = new Date().toISOString();
            await db.withTransactionAsync(async () => {
              await db.runAsync(
                `UPDATE books SET currentPage = ?, status = ?,
                 startedAt = CASE WHEN ? > 0 AND startedAt IS NULL THEN ? ELSE startedAt END,
                 completedAt = ? WHERE id = ?`,
                page, status, page, now, page === totalPages ? now : null, book.id
              );
              if (page > previousPage || minutes > 0) {
                await db.runAsync(
                  'INSERT INTO readingActivities (bookId, fromPage, toPage, pagesRead, durationMinutes) VALUES (?, ?, ?, ?, ?)',
                  book.id, previousPage, page, Math.max(0, page - previousPage), minutes
                );
              }
            });
            setStatus(status);
            Alert.alert('Progresso salvo', `Página ${page} de ${totalPages}.`);
            navigation.goBack();
          }}><Text style={styles.updateButtonText}>Salvar progresso</Text></TouchableOpacity>

          <View style={styles.progressBackground}>
            <View
              style={[
                styles.progressFill,
                { width: `${percentage}%` },
              ]}
            />
          </View>

          <Text style={styles.percentage}>
            {percentage}% concluído
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },

  content: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 30,
  },

  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },

  backButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: 'bold',
  },

  cover: {
    width: 180,
    height: 270,
    resizeMode: 'cover',
    borderRadius: 12,
    marginBottom: 20,
  },

  coverPlaceholder: {
    width: 180,
    height: 270,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  placeholderText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },

  author: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },

  status: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.background,
    marginBottom: 20,
  },

  progressCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    padding: 18,
    borderRadius: 12,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },

  pages: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },

  progressBackground: {
    height: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 10,
  },

  percentage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  pageInput: { backgroundColor: COLORS.surfaceAlt, padding: 11, borderRadius: 8, fontSize: 16, marginBottom: 10 },
  updateButton: { backgroundColor: COLORS.background, padding: 12, borderRadius: 8, alignItems: 'center' },
  updateButtonText: { color: COLORS.surface, fontWeight: 'bold' },
});
