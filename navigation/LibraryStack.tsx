
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LibraryScreen from '../screens/LibraryScreen';
import BookDetailsScreen from '../screens/BookDetailsScreen';
import ReaderScreen from '../screens/ReaderScreen';

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
    fileUri: string | null;
    fileType: 'pdf' | 'epub' | null;
    readerPosition: string | null;
  };
  Reader: {
    id: number;
    title: string;
    fileUri: string;
    fileType: 'pdf' | 'epub';
    currentPage: number;
    totalPages: number;
    readerPosition: string | null;
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

      <Stack.Screen name="Reader" component={ReaderScreen} />
    </Stack.Navigator>
  );
}
