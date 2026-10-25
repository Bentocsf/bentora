
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';
import LibraryStack from './LibraryStack';
import DiaryScreen from '../screens/DiaryScreen';
import QuestionsScreen from '../screens/QuestionsScreen';
import COLORS from '../theme/colors';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor: COLORS.background,
        tabBarInactiveTintColor: COLORS.textSecondary,

        tabBarStyle: {
          backgroundColor: COLORS.surface,
          height: 85,
          paddingTop: 10,
          paddingBottom: 20,
          borderTopColor: COLORS.border,
        },

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Início"
        component={HomeScreen}
      />

      <Tab.Screen
        name="Biblioteca"
        component={LibraryStack}
      />

      <Tab.Screen
        name="Diário"
        component={DiaryScreen}
      />

      <Tab.Screen
        name="Perguntas"
        component={QuestionsScreen}
      />
    </Tab.Navigator>
  );
}
