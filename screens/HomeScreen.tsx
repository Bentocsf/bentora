import { useCallback, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  NavigationProp,
  ParamListBase,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';

import COLORS from '../theme/colors';

type ReadingBook = {
  id: number;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  coverUri: string | null;
};

export default function HomeScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [book, setBook] = useState<ReadingBook | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadCurrentBook = async () => {
        setLoading(true);

        try {
          const currentBook = await db.getFirstAsync<ReadingBook>(`
            SELECT id, title, author, totalPages, currentPage, coverUri
            FROM books
            WHERE status = 'Lendo'
            ORDER BY COALESCE(startedAt, '') DESC, id DESC
            LIMIT 1
          `);

          if (isActive) setBook(currentBook ?? null);
        } catch (error) {
          console.error('Não foi possível carregar a leitura atual.', error);
          if (isActive) setBook(null);
        } finally {
          if (isActive) setLoading(false);
        }
      };

      void loadCurrentBook();

      return () => {
        isActive = false;
      };
    }, [db])
  );

  const progress = book?.totalPages
    ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100))
    : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <View style={styles.brandPageLeft} />
            <View style={styles.brandPageRight} />
          </View>
          <Text style={styles.logo}>Bentora</Text>
        </View>

        <View style={styles.introduction}>
          <Text style={styles.eyebrow}>SEU ESPAÇO DE LEITURA</Text>
          <Text style={styles.greeting}>Olá, leitor.</Text>
          <Text style={styles.subtitle}>
            Leia. Reflita. Guarde o que importa.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Continue lendo</Text>
          <View style={styles.sectionAccent} />
        </View>

        {loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Carregando sua leitura...</Text>
          </View>
        ) : book ? (
          <TouchableOpacity
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={`Abrir biblioteca. Leitura atual: ${book.title}`}
            onPress={() => navigation.navigate('Biblioteca')}
            style={styles.bookCard}
          >
            {book.coverUri ? (
              <Image source={{ uri: book.coverUri }} style={styles.cover} />
            ) : (
              <View style={styles.coverPlaceholder}>
                <View style={styles.placeholderBook}>
                  <View style={styles.placeholderPageLeft} />
                  <View style={styles.placeholderPageRight} />
                </View>
              </View>
            )}

            <View style={styles.bookInfo}>
              <Text style={styles.bookEyebrow}>LENDO AGORA</Text>
              <Text style={styles.bookTitle} numberOfLines={2}>
                {book.title}
              </Text>
              <Text style={styles.bookAuthor} numberOfLines={1}>
                {book.author}
              </Text>
              <Text style={styles.progressText}>
                Página {book.currentPage} de {book.totalPages}
              </Text>
              <View
                style={styles.progressTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: progress }}
              >
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.percentage}>{progress}% concluído</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sua próxima leitura começa aqui</Text>
            <Text style={styles.emptyText}>
              Adicione um livro à biblioteca e acompanhe seu progresso por aqui.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => navigation.navigate('Biblioteca')}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Abrir biblioteca</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>O que deseja fazer?</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.navigate('Diário')}
            style={styles.actionCard}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>✎</Text>
            </View>
            <Text style={styles.actionTitle}>Nova reflexão</Text>
            <Text style={styles.actionDescription}>
              Registre uma ideia da sua leitura.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.navigate('Biblioteca')}
            style={styles.actionCard}
          >
            <View style={[styles.actionIcon, styles.libraryIcon]}>
              <Text style={styles.actionIconText}>↗</Text>
            </View>
            <Text style={styles.actionTitle}>Minha biblioteca</Text>
            <Text style={styles.actionDescription}>
              Explore seus livros e leituras.
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 32,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 26,
    height: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  brandPageLeft: {
    width: 12,
    height: 16,
    borderColor: COLORS.gold,
    borderWidth: 1.5,
    borderRightWidth: 0.75,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 2,
    backgroundColor: COLORS.backgroundLight,
  },
  brandPageRight: {
    width: 12,
    height: 16,
    borderColor: COLORS.gold,
    borderWidth: 1.5,
    borderLeftWidth: 0.75,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 2,
    backgroundColor: COLORS.backgroundLight,
  },
  logo: {
    color: COLORS.background,
    fontFamily: 'serif',
    fontSize: 23,
    letterSpacing: 0.5,
  },
  introduction: {
    marginTop: 36,
    marginBottom: 28,
  },
  eyebrow: {
    color: COLORS.backgroundLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  greeting: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '700',
    marginTop: 8,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 7,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionAccent: {
    width: 34,
    height: 3,
    borderRadius: 2,
    marginBottom: 12,
    backgroundColor: COLORS.gold,
  },
  bookCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cover: {
    width: 92,
    height: 138,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceAlt,
  },
  coverPlaceholder: {
    width: 92,
    height: 138,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundLight,
  },
  placeholderBook: {
    width: 44,
    height: 32,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  placeholderPageLeft: {
    width: 22,
    height: 26,
    borderColor: COLORS.gold,
    borderWidth: 1.5,
    borderRightWidth: 0.75,
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 2,
  },
  placeholderPageRight: {
    width: 22,
    height: 26,
    borderColor: COLORS.gold,
    borderWidth: 1.5,
    borderLeftWidth: 0.75,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 2,
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 14,
  },
  bookEyebrow: {
    color: COLORS.backgroundLight,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bookTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 5,
  },
  bookAuthor: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  progressText: {
    color: COLORS.text,
    fontSize: 12,
    marginTop: 13,
  },
  progressTrack: {
    height: 6,
    borderRadius: 4,
    marginTop: 7,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceAlt,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: COLORS.gold,
  },
  percentage: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 5,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 16,
  },
  primaryButtonText: {
    color: COLORS.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minHeight: 150,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundLight,
  },
  libraryIcon: {
    backgroundColor: COLORS.gold,
  },
  actionIconText: {
    color: COLORS.cream,
    fontSize: 20,
    fontWeight: '600',
  },
  actionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  actionDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
});
