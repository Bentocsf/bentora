import COLORS from '../theme/colors';

import { View, Text, StyleSheet } from 'react-native';

export default function QuestionsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Perguntas Inteligentes
      </Text>

      <Text style={styles.description}>
        Explore suas leituras com perguntas.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.text,
  },

  description: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 10,
  },
});
