import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getApiKey, setApiKey, clearApiKey } from '../services/settingsService';
import { initializeGemini, isGeminiInitialized } from '../services/geminiService';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [apiKey, setApiKeyState] = useState('');
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const key = await getApiKey();
      setSavedApiKey(key);
      if (key) {
        initializeGemini(key);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }

    try {
      await setApiKey(apiKey.trim());
      initializeGemini(apiKey.trim());
      setSavedApiKey(apiKey.trim());
      setApiKeyState('');
      Alert.alert('Success', 'API key saved and Gemini initialized');
    } catch (error) {
      console.error('Error saving API key:', error);
      Alert.alert('Error', 'Failed to save API key');
    }
  };

  const handleClearApiKey = async () => {
    Alert.alert(
      'Clear API Key',
      'Are you sure you want to remove your API key?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearApiKey();
              setSavedApiKey(null);
              Alert.alert('Success', 'API key cleared');
            } catch (error) {
              console.error('Error clearing API key:', error);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gemini API</Text>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status:</Text>
            <Text
              style={[
                styles.statusValue,
                savedApiKey ? styles.statusActive : styles.statusInactive,
              ]}
            >
              {savedApiKey ? '✓ Connected' : '○ Not configured'}
            </Text>
          </View>

          {savedApiKey ? (
            <View style={styles.keyInfo}>
              <Text style={styles.keyLabel}>Current key:</Text>
              <Text style={styles.keyValue}>
                {savedApiKey.slice(0, 8)}...{savedApiKey.slice(-4)}
              </Text>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearApiKey}
              >
                <Text style={styles.clearButtonText}>Remove Key</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={apiKey}
                onChangeText={setApiKeyState}
                placeholder="Enter Gemini API key"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={true}
              />
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  !apiKey.trim() && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveApiKey}
                disabled={!apiKey.trim()}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.hint}>
            Get your API key from{' '}
            <Text style={styles.link}>aistudio.google.com</Text>
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.aboutText}>
            LifeDB is a file manager with integrated Gemini AI assistance.
            Create folders and text files, add context to help Gemini understand
            your content, and use AI to help edit your files.
          </Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginLeft: 8,
  },
  statusActive: {
    color: '#34C759',
  },
  statusInactive: {
    color: '#999',
  },
  keyInfo: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  keyLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  keyValue: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#1a1a1a',
  },
  clearButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FF3B30',
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  saveButton: {
    marginLeft: 12,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  hint: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  link: {
    color: '#007AFF',
  },
  aboutText: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 22,
  },
  version: {
    fontSize: 13,
    color: '#999',
    marginTop: 16,
  },
});
