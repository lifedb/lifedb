import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';

const GeminiLogo = require('../../assets/gemini.png');
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getApiKey, setApiKey, clearApiKey } from '../services/settingsService';
import { initializeGemini, isGeminiInitialized } from '../services/geminiService';
import {
  isGitHubAuthenticated,
  getGitHubUsername,
  loginWithGitHub,
  logoutFromGitHub,
} from '../services/githubService';
import {
  isICloudAvailable,
  getLastBackupTime,
  backupToICloud,
  restoreFromICloud,
} from '../services/icloudBackup';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [apiKey, setApiKeyState] = useState('');
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // GitHub state
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [githubLoading, setGithubLoading] = useState(false);
  
  // iCloud state
  const [icloudAvailable, setIcloudAvailable] = useState(false);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);

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
      
      // Load GitHub status
      const githubAuth = await isGitHubAuthenticated();
      setGithubConnected(githubAuth);
      if (githubAuth) {
        const username = await getGitHubUsername();
        setGithubUsername(username);
      }
      
      // Load iCloud status
      setIcloudAvailable(isICloudAvailable());
      const backup = await getLastBackupTime();
      setLastBackup(backup);
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

  const handleGitHubLogin = async () => {
    setGithubLoading(true);
    try {
      const result = await loginWithGitHub();
      if (result.success) {
        setGithubConnected(true);
        const username = await getGitHubUsername();
        setGithubUsername(username);
        Alert.alert('Success', 'Connected to GitHub!');
      } else {
        Alert.alert('Error', result.error || 'Failed to connect');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to GitHub');
    } finally {
      setGithubLoading(false);
    }
  };

  const handleGitHubLogout = async () => {
    Alert.alert(
      'Disconnect GitHub',
      'Are you sure you want to disconnect your GitHub account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await logoutFromGitHub();
            setGithubConnected(false);
            setGithubUsername(null);
          },
        },
      ]
    );
  };

  const handleBackup = async () => {
    if (!icloudAvailable) {
      Alert.alert('Error', 'iCloud is not available on this device');
      return;
    }
    
    setBackupLoading(true);
    try {
      const result = await backupToICloud();
      if (result.success) {
        const backup = await getLastBackupTime();
        setLastBackup(backup);
        Alert.alert('Success', 'Backup completed!');
      } else {
        Alert.alert('Error', result.error || 'Backup failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Backup failed');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async () => {
    Alert.alert(
      'Restore from iCloud',
      'This will replace all local data with the backup. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setBackupLoading(true);
            try {
              const result = await restoreFromICloud();
              if (result.success) {
                Alert.alert('Success', 'Restore completed! Please restart the app.');
              } else {
                Alert.alert('Error', result.error || 'Restore failed');
              }
            } catch (error) {
              Alert.alert('Error', 'Restore failed');
            } finally {
              setBackupLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.section, { marginTop: 0 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Gemini API</Text>
            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => Alert.alert(
                'Gemini API',
                'Get your API key from aistudio.google.com'
              )}
            >
              <Ionicons name="information-circle-outline" size={22} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          {savedApiKey ? (
            <View style={styles.statusRow}>
              <Image source={GeminiLogo} style={{ width: 18, height: 18 }} />
              <Text style={[styles.statusValue, styles.statusActive]}>
                {savedApiKey.slice(0, 8)}...{savedApiKey.slice(-4)}
              </Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={handleClearApiKey}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.statusRow}>
                <Image source={GeminiLogo} style={{ width: 18, height: 18, opacity: 0.4 }} />
                <Text style={[styles.statusValue, styles.statusInactive, { fontWeight: '600' }]}>
                  Not Configured
                </Text>
              </View>
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
                    styles.connectButton,
                    !apiKey.trim() && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSaveApiKey}
                  disabled={!apiKey.trim()}
                >
                  <Text style={styles.connectButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* GitHub Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>GitHub Sync</Text>
            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => Alert.alert(
                'GitHub Sync',
                'Connect your GitHub account to clone and sync repositories. Add GitHub repos from the Files screen using the + button.'
              )}
            >
              <Ionicons name="information-circle-outline" size={22} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          {githubConnected ? (
            <View style={styles.statusRow}>
              <Ionicons name="logo-github" size={20} color="#333" />
              <Text style={[styles.statusValue, styles.statusActive]}>
                Connected to {githubUsername}
              </Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={handleGitHubLogout}
              >
                <Text style={styles.removeButtonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <Ionicons name="logo-github" size={20} color="#999" />
              <Text style={[styles.statusValue, styles.statusInactive, { fontWeight: '600' }]}>
                Not Connected
              </Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={styles.connectButton}
                onPress={handleGitHubLogin}
                disabled={githubLoading}
              >
                {githubLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.connectButtonText}>Connect</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* iCloud Backup Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>iCloud Backup</Text>
            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => Alert.alert(
                'iCloud Backup',
                'Your notes, context files, chat history, and settings are automatically backed up to iCloud on every save. Use Backup Now for an immediate backup or Restore to recover from iCloud.'
              )}
            >
              <Ionicons name="information-circle-outline" size={22} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.statusRow}>
            <Ionicons name="cloud-outline" size={20} color="#007AFF" />
            <Text
              style={[
                styles.statusValue,
                icloudAvailable ? styles.statusActive : styles.statusInactive,
              ]}
            >
              {icloudAvailable ? 'Available' : 'Not available'}
            </Text>
          </View>

          {lastBackup && (
            <Text style={styles.hint}>
              Last backup: {lastBackup.toLocaleDateString()} {lastBackup.toLocaleTimeString()}
            </Text>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.saveButton, (!icloudAvailable || backupLoading) && styles.saveButtonDisabled]}
              onPress={handleBackup}
              disabled={!icloudAvailable || backupLoading}
            >
              {backupLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Backup Now</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, (!icloudAvailable || backupLoading) && styles.saveButtonDisabled]}
              onPress={handleRestore}
              disabled={!icloudAvailable || backupLoading}
            >
              <Text style={styles.secondaryButtonText}>Restore</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
    textTransform: 'uppercase',
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
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
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
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectedText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  connectedCard: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
  },
  connectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  removeButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  removeButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500' as const,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoButton: {
    padding: 4,
  },
  geminiIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  connectButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
