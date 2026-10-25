
import { NavigationContainer } from '@react-navigation/native';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';

import AppNavigator from './navigation/AppNavigator';
import AnimatedSplashScreen from './components/AnimatedSplashScreen';
import { initializeDatabase } from './database/database';

export default function App() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider
        databaseName="bentora.db"
        onInit={initializeDatabase}
      >
        <View style={styles.root}>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
          <AnimatedSplashScreen />
        </View>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
