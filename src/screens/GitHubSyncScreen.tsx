/**
 * GitHub Sync Screen
 * 
 * Uses native SwiftGit2 module for real git clone/pull/push operations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system';
import { RootStackParamList } from '../types';
import {
  isGitHubAuthenticated,
  listRepositories,
  getGitHubUsername,
  getGitHubToken,
} from '../services/githubService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import native git module
import LifeDBGit from 'lifedb-git';

type Props = NativeStackScreenProps<RootStackParamList, 'GitHubSync'>;

const SELECTED_REPO_KEY = 'github_selected_repo';
const LAST_SYNC_KEY = 'github_last_sync';

interface Repository {
  name: string;
  fullName: string;
  private: boolean;
}

// Get local repo path - uses Expo's document directory
const getRepoPath = async (): Promise<string> => {
  // Use the new Directory API
  const { Paths, Directory } = await import('expo-file-system');
  const reposDir = new Directory(Paths.document, 'repos');
  const repoDir = new Directory(reposDir, 'lifedb');
  
  // Ensure the repos directory exists
  if (!reposDir.exists) {
    await reposDir.create();
  }
  
  // Convert file:// URI to filesystem path for libgit2
  const uri = repoDir.uri;
  const path = uri.replace('file://', '');
  return path;
};

export const GitHubSyncScreen: React.FC<Props> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [gitOutput, setGitOutput] = useState<string[]>([]);
  const [isNativeAvailable, setIsNativeAvailable] = useState(false);

  const addGitOutput = (message: string) => {
    setGitOutput(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Check if native module is available
      try {
        const available = LifeDBGit.isAvailable();
        setIsNativeAvailable(available);
        addGitOutput(`Native git module: ${available ? 'available' : 'not available'}`);
      } catch {
        setIsNativeAvailable(false);
        addGitOutput('Native git module not available');
      }

      const authenticated = await isGitHubAuthenticated();
      if (!authenticated) {
        Alert.alert('Not Connected', 'Please connect your GitHub account in Settings first.');
        navigation.goBack();
        return;
      }

      const [repos, user, savedRepo, syncTimeStr] = await Promise.all([
        listRepositories(),
        getGitHubUsername(),
        AsyncStorage.getItem(SELECTED_REPO_KEY),
        AsyncStorage.getItem(LAST_SYNC_KEY),
      ]);

      setRepositories(repos);
      setUsername(user);
      setSelectedRepo(savedRepo);
      setLastSync(syncTimeStr ? new Date(syncTimeStr) : null);

      if (user) {
        addGitOutput(`Logged in as: ${user}`);
      }
    } catch (error) {
      console.error('Error loading repositories:', error);
      Alert.alert('Error', 'Failed to load repositories');
    } finally {
      setIsLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('FileIssue')}>
          <Ionicons name="bug-outline" size={22} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const handleSelectRepo = async (repo: Repository) => {
    await AsyncStorage.setItem(SELECTED_REPO_KEY, repo.fullName);
    setSelectedRepo(repo.fullName);
    addGitOutput(`Selected repository: ${repo.fullName}`);
  };

  const handleSync = async () => {
    if (!selectedRepo || !username) {
      Alert.alert('No Repository', 'Please select a repository first.');
      return;
    }

    if (!isNativeAvailable) {
      Alert.alert('Not Available', 'Native git is only available on iOS');
      return;
    }

    const token = await getGitHubToken();
    if (!token) {
      Alert.alert('Error', 'No GitHub token found');
      return;
    }

    setIsSyncing(true);
    setGitOutput([]);

    try {
      const [owner, repo] = selectedRepo.split('/');
      const repoPath = await getRepoPath();
      const repoUrl = `https://github.com/${selectedRepo}.git`;

      addGitOutput(`Starting sync for ${selectedRepo}...`);

      // Check if repo already exists locally
      const isRepo = await LifeDBGit.isRepository(repoPath);
      
      if (!isRepo) {
        // Clone the repository
        addGitOutput('Repository not found locally, cloning...');
        const cloneResult = await LifeDBGit.clone(repoUrl, repoPath, username, token);
        
        if (cloneResult.success) {
          addGitOutput('✓ Clone successful');
        } else {
          addGitOutput(`✗ Clone failed: ${cloneResult.error}`);
          Alert.alert('Clone Failed', cloneResult.error || 'Unknown error');
          return;
        }
      } else {
        // Pull latest changes
        addGitOutput('Fetching latest changes...');
        const pullResult = await LifeDBGit.pull(repoPath, username, token);
        
        if (pullResult.success) {
          addGitOutput('✓ Pull successful');
        } else {
          addGitOutput(`✗ Pull failed: ${pullResult.error}`);
        }

        // Push local changes
        addGitOutput('Pushing local changes...');
        const pushResult = await LifeDBGit.push(
          repoPath,
          username,
          token,
          `Sync from LifeDB at ${new Date().toISOString()}`
        );

        if (pushResult.success) {
          addGitOutput(`✓ Push successful${pushResult.commitOid ? ` (${pushResult.commitOid.substring(0, 7)})` : ''}`);
        } else {
          addGitOutput(`✗ Push failed: ${pushResult.error}`);
        }
      }

      // Update last sync time
      const now = new Date();
      await AsyncStorage.setItem(LAST_SYNC_KEY, now.toISOString());
      setLastSync(now);
      addGitOutput('Sync complete!');

    } catch (error: any) {
      addGitOutput(`✗ Error: ${error.message || 'Unknown error'}`);
      Alert.alert('Sync Error', error.message || 'Unknown error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePull = async () => {
    console.log('[handlePull] Starting...');
    if (!selectedRepo || !username) {
      console.log('[handlePull] Missing repo or username');
      return;
    }
    
    const token = await getGitHubToken();
    if (!token) {
      console.log('[handlePull] No token');
      return;
    }
    
    console.log('[handlePull] Setting syncing state');
    setIsSyncing(true);
    
    // Clear and set initial message
    const initialMessage = `${new Date().toLocaleTimeString()}: Pulling from ${selectedRepo}...`;
    console.log('[handlePull] Setting gitOutput:', initialMessage);
    setGitOutput([initialMessage]);
    
    try {
      const repoPath = await getRepoPath();
      console.log('[handlePull] Repo path:', repoPath);
      
      console.log('[handlePull] Calling native pull...');
      const result = await LifeDBGit.pull(repoPath, username, token);
      console.log('[handlePull] Result:', JSON.stringify(result));
      
      const resultMessages = result.success 
        ? [
            `${new Date().toLocaleTimeString()}: ✓ Pull complete`,
            `${new Date().toLocaleTimeString()}: ${result.message || 'Updated successfully'}`
          ]
        : [`${new Date().toLocaleTimeString()}: ✗ Pull failed: ${result.error}`];
      
      console.log('[handlePull] Appending messages:', resultMessages);
      setGitOutput(prev => {
        const newOutput = [...prev, ...resultMessages];
        console.log('[handlePull] New gitOutput:', newOutput);
        return newOutput;
      });
      
      if (!result.success) {
        Alert.alert('Pull Failed', result.error || 'Unknown error');
      }
    } catch (error: any) {
      console.log('[handlePull] Error:', error);
      setGitOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: ✗ Error: ${error.message}`]);
      Alert.alert('Error', error.message);
    } finally {
      console.log('[handlePull] Done');
      setIsSyncing(false);
    }
  };

  const handlePush = async () => {
    if (!selectedRepo || !username) return;
    
    const token = await getGitHubToken();
    if (!token) return;
    
    setIsSyncing(true);
    setGitOutput([]); // Clear previous output
    
    try {
      const repoPath = await getRepoPath();
      addGitOutput(`Pushing to ${selectedRepo}...`);
      addGitOutput(`Local path: ${repoPath}`);
      
      const result = await LifeDBGit.push(
        repoPath,
        username,
        token,
        `Update from LifeDB at ${new Date().toISOString()}`
      );
      
      if (result.success) {
        addGitOutput(`✓ Push complete${result.commitOid ? ` (${result.commitOid.substring(0, 7)})` : ''}`);
        addGitOutput(result.message || 'Pushed successfully');
      } else {
        addGitOutput(`✗ Push failed: ${result.error}`);
        Alert.alert('Push Failed', result.error || 'Unknown error');
      }
    } catch (error: any) {
      addGitOutput(`✗ Error: ${error.message}`);
      Alert.alert('Error', error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const renderRepository = ({ item }: { item: Repository }) => (
    <TouchableOpacity
      style={[
        styles.repoItem,
        selectedRepo === item.fullName && styles.repoItemSelected,
      ]}
      onPress={() => handleSelectRepo(item)}
    >
      <View style={styles.repoInfo}>
        <Ionicons
          name={item.private ? 'lock-closed-outline' : 'globe-outline'}
          size={20}
          color="#666"
        />
        <View style={styles.repoText}>
          <Text style={styles.repoName}>{item.name}</Text>
          <Text style={styles.repoOwner}>{item.fullName}</Text>
        </View>
      </View>
      {selectedRepo === item.fullName && (
        <Ionicons name="checkmark-circle" size={24} color="#34C759" />
      )}
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading repositories...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Git Sync</Text>
        <Text style={styles.headerSubtitle}>
          {isNativeAvailable ? 'Using native git (SwiftGit2)' : 'Native git not available'}
        </Text>
        {username && (
          <View style={styles.userInfo}>
            <Ionicons name="logo-github" size={16} color="#333" />
            <Text style={styles.username}>{username}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={repositories}
        renderItem={renderRepository}
        keyExtractor={(item) => item.fullName}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={48} color="#CCC" />
            <Text style={styles.emptyText}>No repositories found</Text>
          </View>
        }
      />

      {/* Git output console - always visible */}
      <View style={styles.consoleContainer}>
        <Text style={styles.consoleTitle}>Git Output</Text>
        <ScrollView style={styles.console}>
          {gitOutput.length === 0 ? (
            <Text style={styles.consoleLine}>Ready for git operations...</Text>
          ) : (
            gitOutput.map((line, i) => (
              <Text key={i} style={[
                styles.consoleLine,
                line.includes('✓') && styles.consoleSuccess,
                line.includes('✗') && styles.consoleError,
              ]}>
                {line}
              </Text>
            ))
          )}
        </ScrollView>
      </View>

      {selectedRepo && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Syncing to: <Text style={styles.footerRepo}>{selectedRepo}</Text>
          </Text>
          {lastSync && (
            <Text style={styles.lastSyncText}>
              Last sync: {lastSync.toLocaleString()}
            </Text>
          )}
          
          {isSyncing ? (
            <View style={styles.progressContainer}>
              <ActivityIndicator color="#007AFF" />
              <Text style={styles.progressText}>Syncing...</Text>
            </View>
          ) : (
            <View style={styles.syncButtons}>
              <TouchableOpacity 
                style={[styles.syncButton, !isNativeAvailable && styles.syncButtonDisabled]} 
                onPress={handlePull}
                disabled={!isNativeAvailable}
              >
                <Ionicons name="cloud-download-outline" size={20} color="#fff" />
                <Text style={styles.syncButtonText}>Pull</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.syncButton, styles.syncButtonPrimary, !isNativeAvailable && styles.syncButtonDisabled]} 
                onPress={handleSync}
                disabled={!isNativeAvailable}
              >
                <Ionicons name="git-branch-outline" size={20} color="#fff" />
                <Text style={styles.syncButtonText}>Sync</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.syncButton, !isNativeAvailable && styles.syncButtonDisabled]} 
                onPress={handlePush}
                disabled={!isNativeAvailable}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                <Text style={styles.syncButtonText}>Push</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  username: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500' as const,
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
  },
  repoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  repoItemSelected: {
    borderWidth: 2,
    borderColor: '#34C759',
  },
  repoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  repoText: {
    gap: 2,
  },
  repoName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
  },
  repoOwner: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  consoleContainer: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 12,
    maxHeight: 150,
  },
  consoleTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#888',
    marginBottom: 8,
  },
  console: {
    flex: 1,
  },
  consoleLine: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: '#ccc',
    marginBottom: 2,
  },
  consoleSuccess: {
    color: '#34C759',
  },
  consoleError: {
    color: '#FF3B30',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  footerRepo: {
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  lastSyncText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#007AFF',
  },
  syncButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  syncButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5856D6',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  syncButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  syncButtonDisabled: {
    backgroundColor: '#ccc',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
});

export default GitHubSyncScreen;
