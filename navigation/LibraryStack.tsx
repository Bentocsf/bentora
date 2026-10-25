
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LibraryScreen from '../screens/LibraryScreen';
import BookDetailsScreen from '../screens/BookDetailsScreen';

export type LibraryStackParamList = {
  LibraryList: undefined;

  BookDetails: {
    id: number;
    title: string;
    author: string;
    totalPages: number;
    currentPage: number;
    status: string;
    coverUri: string | null;
  };
};

const Stack = createNativeStackNavigator<LibraryStackParamList>();

export default function LibraryStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="LibraryList"
        component={LibraryScreen}
      />

      <Stack.Screen
        name="BookDetails"
        component={BookDetailsScreen}
      />
    </Stack.Navigator>
  );
}
