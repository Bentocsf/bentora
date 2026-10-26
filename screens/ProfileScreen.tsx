import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import COLORS from '../theme/colors';

type Activity = {
  id: number;
  kind: 'reading' | 'reflection';
  bookTitle: string;
  pagesRead: number;
  durationMinutes: number;
  detail: string | null;
  createdAt: string;
};

type Stats = { pages: number; minutes: number; completed: number; reflections: number };

const emptyStats: Stats = { pages: 0, minutes: 0, completed: 0, reflections: 0 };

export default function ProfileScreen() {
  const db = useSQLiteContext();
  const [name, setName] = useState('Leitor Bentora');
  const [draftName, setDraftName] = useState(name);
  const [stats, setStats] = useState(emptyStats);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [saved, setSaved] = useState(false);

  const loadProfile = useCallback(async () => {
    const [profile, totals, feed] = await Promise.all([
      db.getFirstAsync<{ displayName: string }>('SELECT displayName FROM localProfile WHERE id = 1'),
      db.getFirstAsync<Stats>(`
        SELECT
          COALESCE((SELECT SUM(pagesRead) FROM readingActivities), 0) AS pages,
          COALESCE((SELECT SUM(durationMinutes) FROM readingActivities), 0) AS minutes,
          (SELECT COUNT(*) FROM books WHERE status = 'Concluído') AS completed,
          (SELECT COUNT(*) FROM reflections) AS reflections
      `),
      db.getAllAsync<Activity>(`
        SELECT * FROM (
          SELECT a.id, 'reading' AS kind, b.title AS bookTitle, a.pagesRead, a.durationMinutes,
                 NULL AS detail, a.createdAt
          FROM readingActivities a JOIN books b ON b.id = a.bookId
          UNION ALL
          SELECT r.id, 'reflection' AS kind, b.title AS bookTitle, 0 AS pagesRead, 0 AS durationMinutes,
                 r.content AS detail, r.createdAt
          FROM reflections r JOIN books b ON b.id = r.bookId
        ) ORDER BY julianday(createdAt) DESC, id DESC LIMIT 40
      `),
    ]);

    const currentName = profile?.displayName || 'Leitor Bentora';
    setName(currentName);
    setDraftName(currentName);
    setStats(totals ?? emptyStats);
    setActivities(feed);
  }, [db]);

  useFocusEffect(useCallback(() => { void loadProfile(); }, [loadProfile]));

  const saveName = async () => {
    const nextName = draftName.trim();
    if (!nextName) return;
    await db.runAsync('UPDATE localProfile SET displayName = ? WHERE id = 1', nextName);
    setName(nextName);
    setDraftName(nextName);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const achievements = [
    { icon: 'book-outline' as const, title: 'Primeiras páginas', description: 'Leia 100 páginas', unlocked: stats.pages >= 100 },
    { icon: 'time-outline' as const, title: 'Uma hora de foco', description: 'Registre 60 minutos', unlocked: stats.minutes >= 60 },
    { icon: 'trophy-outline' as const, title: 'Leitor dedicado', description: 'Conclua 3 livros', unlocked: stats.completed >= 3 },
    { icon: 'bulb-outline' as const, title: 'Leitura reflexiva', description: 'Escreva 5 reflexões', unlocked: stats.reflections >= 5 },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>SEU ESPAÇO PESSOAL</Text>
        <Text style={styles.title}>Perfil</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}><Ionicons name="person" size={28} color={COLORS.cream} /></View>
          <Text style={styles.greeting}>Olá, {name}</Text>
          <Text style={styles.muted}>Seu perfil e suas leituras ficam salvos neste aparelho.</Text>
          <TextInput value={draftName} onChangeText={setDraftName} placeholder="Como gostaria de ser chamado?" style={styles.input} maxLength={40} returnKeyType="done" />
          <TouchableOpacity style={styles.saveButton} onPress={() => void saveName()} accessibilityRole="button">
            <Text style={styles.saveButtonText}>{saved ? 'Nome salvo' : 'Salvar nome'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.background} />
          <Text style={styles.noticeText}>Login e sincronização entre dispositivos ainda não estão ativos. Seu perfil atual é local e não exige cadastro de conta.</Text>
        </View>

        <Text style={styles.sectionTitle}>Seu percurso</Text>
        <View style={styles.statsGrid}>
          <StatCard icon="book-outline" value={String(stats.pages)} label="páginas lidas" />
          <StatCard icon="time-outline" value={`${stats.minutes} min`} label="tempo registrado" />
          <StatCard icon="ribbon-outline" value={String(stats.completed)} label="livros concluídos" />
          <StatCard icon="create-outline" value={String(stats.reflections)} label="reflexões" />
        </View>

        <Text style={styles.sectionTitle}>Conquistas</Text>
        <View style={styles.achievementList}>
          {achievements.map((item) => (
            <View key={item.title} style={[styles.achievement, !item.unlocked && styles.locked]}>
              <View style={[styles.achievementIcon, item.unlocked && styles.unlockedIcon]}>
                <Ionicons name={item.icon} size={20} color={item.unlocked ? COLORS.cream : COLORS.textSecondary} />
              </View>
              <View style={styles.achievementCopy}>
                <Text style={styles.achievementTitle}>{item.title}</Text>
                <Text style={styles.muted}>{item.description}</Text>
              </View>
              <Ionicons name={item.unlocked ? 'checkmark-circle' : 'lock-closed-outline'} size={18} color={item.unlocked ? COLORS.background : COLORS.textSecondary} />
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Atividade recente</Text>
        {activities.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sua jornada começa com uma página</Text>
            <Text style={styles.muted}>Atualize o progresso de um livro ou escreva uma reflexão para ver sua atividade aqui.</Text>
          </View>
        ) : activities.map((activity) => (
          <View key={`${activity.kind}-${activity.id}`} style={styles.activityCard}>
            <View style={styles.activityIcon}>
              <Ionicons name={activity.kind === 'reading' ? 'book-outline' : 'create-outline'} size={19} color={COLORS.background} />
            </View>
            <View style={styles.activityCopy}>
              <Text style={styles.activityTitle}>{activity.kind === 'reading' ? `Leu ${activity.pagesRead} páginas` : 'Registrou uma reflexão'}</Text>
              <Text style={styles.activityBook}>{activity.bookTitle}</Text>
              {activity.kind === 'reading' && activity.durationMinutes > 0 ? <Text style={styles.muted}>{activity.durationMinutes} min de leitura registrados</Text> : null}
              {activity.detail ? <Text style={styles.reflection} numberOfLines={3}>{activity.detail}</Text> : null}
              <Text style={styles.date}>{formatDate(activity.createdAt)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, value, label }: { icon: 'book-outline' | 'time-outline' | 'ribbon-outline' | 'create-outline'; value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color={COLORS.background} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatDate(value: string) {
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.cream },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  eyebrow: { color: COLORS.backgroundLight, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '700', marginTop: 5, marginBottom: 18 },
  profileCard: { alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  greeting: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginTop: 10 },
  muted: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  input: { width: '100%', backgroundColor: COLORS.surfaceAlt, padding: 12, borderRadius: 10, marginTop: 14, color: COLORS.text },
  saveButton: { alignSelf: 'stretch', alignItems: 'center', padding: 12, marginTop: 9, backgroundColor: COLORS.background, borderRadius: 10 },
  saveButtonText: { color: COLORS.cream, fontWeight: '700' },
  notice: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: COLORS.surfaceAlt, borderRadius: 12, padding: 13, marginTop: 14 },
  noticeText: { flex: 1, color: COLORS.text, fontSize: 12, lineHeight: 18 },
  sectionTitle: { color: COLORS.text, fontSize: 19, fontWeight: '700', marginTop: 25, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '48%', flexGrow: 1, minHeight: 100, backgroundColor: COLORS.surface, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginTop: 7 },
  statLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  achievementList: { gap: 8 },
  achievement: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, padding: 11 },
  locked: { opacity: 0.72 },
  achievementIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: COLORS.surfaceAlt },
  unlockedIcon: { backgroundColor: COLORS.background },
  achievementCopy: { flex: 1, marginLeft: 11 },
  achievementTitle: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  emptyCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  emptyTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  activityCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.surface, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 9 },
  activityIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  activityCopy: { flex: 1, marginLeft: 11 },
  activityTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  activityBook: { color: COLORS.backgroundLight, fontSize: 12, fontWeight: '600', marginTop: 2 },
  reflection: { color: COLORS.text, fontSize: 13, lineHeight: 19, marginTop: 6 },
  date: { color: COLORS.textSecondary, fontSize: 10, marginTop: 6 },
});
