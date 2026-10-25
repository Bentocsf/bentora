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

  const percentage =
    book.totalPages > 0
      ? Math.min(
          100,
          Math.round(
            (Number(currentPage) / book.totalPages) * 100
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
          {book.status}
        </Text>

        {/* Progresso da leitura */}
        <View style={styles.progressCard}>
          <Text style={styles.sectionTitle}>
            Seu progresso
          </Text>

          <Text style={styles.pages}>
            Página {currentPage} de {book.totalPages}
          </Text>

          <TextInput value={currentPage} onChangeText={setCurrentPage} keyboardType="numeric" placeholder="Página atual" style={styles.pageInput} />
          <TouchableOpacity style={styles.updateButton} onPress={async () => {
            const page = Number(currentPage);
            if (!Number.isInteger(page) || page < 0 || page > book.totalPages) {
              Alert.alert('Página inválida', `Informe uma página entre 0 e ${book.totalPages}.`);
              return;
            }
            const status = page === book.totalPages ? 'Concluído' : page > 0 ? 'Lendo' : 'Quero ler';
            const now = new Date().toISOString();
            await db.runAsync(
              `UPDATE books SET currentPage = ?, status = ?,
               startedAt = CASE WHEN ? > 0 AND startedAt IS NULL THEN ? ELSE startedAt END,
               completedAt = ? WHERE id = ?`,
              page, status, page, now, page === book.totalPages ? now : null, book.id
            );
            Alert.alert('Progresso salvo', `Página ${page} de ${book.totalPages}.`);
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
