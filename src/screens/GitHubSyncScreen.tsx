/**
 * GitHub Sync Screen
 * 
 * Allows users to select a GitHub repository and sync their notes.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import {
  isGitHubAuthenticated,
  listRepositories,
  getGitHubUsername,
} from '../services/githubService';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'GitHubSync'>;

const SELECTED_REPO_KEY = 'github_selected_repo';

interface Repository {
  name: string;
  fullName: string;
  private: boolean;
}

export const GitHubSyncScreen: React.FC<Props> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const authenticated = await isGitHubAuthenticated();
      if (!authenticated) {
        Alert.alert('Not Connected', 'Please connect your GitHub account in Settings first.');
        navigation.goBack();
        return;
      }

      const [repos, user, savedRepo] = await Promise.all([
        listRepositories(),
        getGitHubUsername(),
        AsyncStorage.getItem(SELECTED_REPO_KEY),
      ]);

      setRepositories(repos);
      setUsername(user);
      setSelectedRepo(savedRepo);
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

  const handleSelectRepo = async (repo: Repository) => {
    try {
      await AsyncStorage.setItem(SELECTED_REPO_KEY, repo.fullName);
      setSelectedRepo(repo.fullName);
      Alert.alert(
        'Repository Selected',
        `"${repo.name}" is now your sync repository. Notes will be synced here.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save selection');
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
        <Text style={styles.headerTitle}>Select Repository</Text>
        <Text style={styles.headerSubtitle}>
          Choose a repository to sync your notes with
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

      {selectedRepo && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Syncing to: <Text style={styles.footerRepo}>{selectedRepo}</Text>
          </Text>
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
  },
  repoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  repoItemSelected: {
    borderWidth: 2,
    borderColor: '#34C759',
  },
  repoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  repoText: {
    flex: 1,
  },
  repoName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
  },
  repoOwner: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
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
});
