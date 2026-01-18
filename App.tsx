import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootStackParamList } from './src/types';
import { FolderScreen } from './src/screens/FolderScreen';
import { TextFileScreen } from './src/screens/TextFileScreen';
import { EditContextScreen } from './src/screens/EditContextScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { GitHubSyncScreen } from './src/screens/GitHubSyncScreen';
import { FileIssueScreen } from './src/screens/FileIssueScreen';
import { initializeFileSystem } from './src/services/fileSystem';
import { initializeDiffStorage } from './src/services/diffTracker';
import { getApiKey } from './src/services/settingsService';
import { initializeGemini } from './src/services/geminiService';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize file system and diff storage
        await Promise.all([
          initializeFileSystem(),
          initializeDiffStorage(),
        ]);

        // Load and initialize Gemini if API key exists
        const apiKey = await getApiKey();
        if (apiKey) {
          initializeGemini(apiKey);
        }
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
  }, []);

  if (isInitializing) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Folder"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#fff',
            },
            headerShadowVisible: false,
            headerTintColor: '#007AFF',
            headerTitleStyle: {
              fontWeight: '600' as const,
              color: '#007AFF',
            },
            headerBackTitleStyle: {
              fontSize: 17,
            },
          }}
        >
          <Stack.Screen
            name="Folder"
            component={FolderScreen}
            initialParams={{ path: '/' }}
          />
          <Stack.Screen
            name="TextFile"
            component={TextFileScreen}
          />
          <Stack.Screen
            name="EditContext"
            component={EditContextScreen}
            options={{ title: 'Edit Context' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
          <Stack.Screen
            name="GitHubSync"
            component={GitHubSyncScreen}
            options={{ title: 'GitHub Sync' }}
          />
          <Stack.Screen
            name="FileIssue"
            component={FileIssueScreen}
            options={{ title: 'File Issue' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
