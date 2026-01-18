import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Paths, Directory } from 'expo-file-system';
import { RootStackParamList, FileItem } from '../types';
import { FileListItem } from '../components/FileListItem';
import {
  listDirectory,
  createFolder,
  createTextFile,
  deleteFolder,
  deleteTextFile,
  initializeFileSystem,
  rename,
} from '../services/fileSystem';
import { SyncLog } from '../services/gitSyncService';
import { syncRepo, findGitRepoRoot } from '../services/gitService';
import {
  isGitHubAuthenticated,
  listRepositories,
  getGitHubUsername,
  getGitHubToken,
} from '../services/githubService';
import LifeDBGit from 'lifedb-git';

interface Repository {
  name: string;
  fullName: string;
  private: boolean;
}


type Props = NativeStackScreenProps<RootStackParamList, 'Folder'>;

export const FolderScreen: React.FC<Props> = ({ navigation, route }) => {
  const { path } = route.params;
  const isRootPath = !path || path === '/';
  
  const [items, setItems] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newItemType, setNewItemType] = useState<'folder' | 'file' | 'github'>('file');
  const [newItemName, setNewItemName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameItem, setRenameItem] = useState<FileItem | null>(null);
  const [renameName, setRenameName] = useState('');
  const [showAboutModal, setShowAboutModal] = useState(false);
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  
  // GitHub repo selection state
  const [githubRepos, setGithubRepos] = useState<Repository[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const loadDirectory = useCallback(async () => {
    setIsLoading(true);
    try {
      await initializeFileSystem();
      const contents = await listDirectory(path);
      setItems(contents);
    } catch (error) {
      console.error('Error loading directory:', error);
      Alert.alert('Error', 'Failed to load directory contents');
    } finally {
      setIsLoading(false);
    }
  }, [path]);

  // Handle pull-to-refresh with context-aware sync
  const handleRefresh = useCallback(async () => {
    console.log('[handleRefresh] Starting... path:', path);
    
    // Check if we're inside a git repository
    const repoRoot = await findGitRepoRoot(path);
    console.log('[handleRefresh] Git repo root:', repoRoot);
    
    if (repoRoot) {
      // We're in a git repo, do sync
      console.log('[handleRefresh] Starting git sync...');
      setIsSyncing(true);
      setSyncLogs([]);
      setShowSyncModal(true);
      
      const logs: SyncLog[] = [];
      const result = await syncRepo(repoRoot, (message, status) => {
        const newLog: SyncLog = { 
          message, 
          timestamp: new Date(),
          operation: status === 'error' ? 'error' : 'info',
          success: status !== 'error'
        };
        logs.push(newLog);
        setSyncLogs([...logs]);
      });
      
      console.log('[handleRefresh] Sync result:', result);
      setIsSyncing(false);
      // Modal stays open until user clicks Close
    } else {
      console.log('[handleRefresh] Not in a git repo, skipping sync');
    }
    
    // Then reload directory
    console.log('[handleRefresh] Reloading directory...');
    await loadDirectory();
    console.log('[handleRefresh] Done');
  }, [path, loadDirectory]);



  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  useEffect(() => {
    // Reload when screen is focused
    const unsubscribe = navigation.addListener('focus', () => {
      loadDirectory();
    });
    return unsubscribe;
  }, [navigation, loadDirectory]);

  // Set up header
  useEffect(() => {
    const folderName = path === '/' ? 'Files' : path.split('/').pop() || 'Files';
    navigation.setOptions({
      title: folderName,
      headerLeft: () => (
        path === '/' ? (
          <TouchableOpacity
            onPress={() => setShowAboutModal(true)}
            style={styles.headerButton}
          >
            <Ionicons name="information-circle-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        ) : undefined
      ),
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.headerButton}
          >
            <Ionicons name="settings-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setNewItemName('');
              setShowNewModal(true);
            }}
            style={styles.headerButton}
          >
            <Ionicons name="add" size={28} color="#007AFF" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, path]);

  const handleItemPress = (item: FileItem) => {
    if (item.isDirectory) {
      navigation.push('Folder', { path: item.path });
    } else {
      navigation.navigate('TextFile', { path: item.path, name: item.name });
    }
  };

  const handleContextPress = (item: FileItem) => {
    navigation.navigate('EditContext', {
      path: item.path,
      isDirectory: item.isDirectory,
    });
  };

  const handleDelete = async (item: FileItem) => {
    Alert.alert(
      'Delete',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.isDirectory) {
                await deleteFolder(item.path);
              } else {
                await deleteTextFile(item.path);
              }
              loadDirectory();
            } catch (error) {
              console.error('Error deleting:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const handleCreateNew = async () => {
    if (!newItemName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    try {
      if (newItemType === 'folder') {
        await createFolder(path, newItemName.trim());
      } else {
        // Use the name as-is, don't auto-append .txt
        await createTextFile(path, newItemName.trim());
      }
      setShowNewModal(false);
      setNewItemName('');
      loadDirectory();
    } catch (error) {
      console.error('Error creating:', error);
      Alert.alert('Error', 'Failed to create item');
    }
  };

  // Load GitHub repositories when switching to github type
  const loadGitHubRepos = async () => {
    console.log('[GitHub] Starting to load repos');
    setIsLoadingRepos(true);
    try {
      const isAuth = await isGitHubAuthenticated();
      console.log('[GitHub] Auth check:', isAuth);
      if (!isAuth) {
        Alert.alert('Not Connected', 'Please connect your GitHub account in Settings first.');
        setNewItemType('file');
        return;
      }
      const repos = await listRepositories();
      console.log('[GitHub] Loaded repos:', repos.length);
      setGithubRepos(repos);
      if (repos.length === 0) {
        Alert.alert('No Repositories', 'No GitHub repositories found. Make sure you have repositories and try again.');
      }
    } catch (error) {
      console.error('Error loading repos:', error);
      Alert.alert('Error', 'Failed to load GitHub repositories');
    } finally {
      setIsLoadingRepos(false);
    }
  };

  // Clone a GitHub repository to the root directory
  const handleCloneRepo = async (repo: Repository) => {
    setIsCloning(true);
    try {
      const username = await getGitHubUsername();
      const token = await getGitHubToken();
      
      if (!username || !token) {
        Alert.alert('Error', 'GitHub credentials not found');
        return;
      }

      // Create repo path in the lifedb directory
      const baseDir = new Directory(Paths.document, 'lifedb');
      const repoDir = new Directory(baseDir, repo.name);
      const repoPath = repoDir.uri.replace('file://', '');
      const repoUrl = `https://github.com/${repo.fullName}.git`;

      // Check if directory already exists
      if (repoDir.exists) {
        Alert.alert('Error', `A folder named "${repo.name}" already exists`);
        return;
      }

      // Clone the repository
      const result = await LifeDBGit.clone(repoUrl, repoPath, username, token);
      
      if (result.success) {
        Alert.alert('Success', `Cloned ${repo.name} successfully!`);
        setShowNewModal(false);
        setNewItemType('file');
        loadDirectory();
      } else {
        Alert.alert('Clone Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error cloning:', error);
      Alert.alert('Error', 'Failed to clone repository');
    } finally {
      setIsCloning(false);
    }
  };

  const handleRename = (item: FileItem) => {
    setRenameItem(item);
    setRenameName(item.name);
    setShowRenameModal(true);
  };

  const handleRenameSubmit = async () => {
    if (!renameItem || !renameName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    if (renameName.trim() === renameItem.name) {
      setShowRenameModal(false);
      return;
    }

    try {
      await rename(renameItem.path, renameName.trim());
      setShowRenameModal(false);
      setRenameItem(null);
      setRenameName('');
      loadDirectory();
    } catch (error) {
      console.error('Error renaming:', error);
      Alert.alert('Error', 'Failed to rename item');
    }
  };

  const renderItem = ({ item }: { item: FileItem }) => (
    <FileListItem
      item={item}
      onPress={() => handleItemPress(item)}
      onContextPress={() => handleContextPress(item)}
      onDelete={() => handleDelete(item)}
      onRename={() => handleRename(item)}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.path}
        refreshing={isLoading || isSyncing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptySubtext}>This folder is empty</Text>
            <Text style={styles.emptyHint}>Tap + to create a file or folder</Text>
          </View>
        }
      />

      {/* Edit folder context button */}
      <TouchableOpacity
        style={styles.contextButton}
        onPress={() => navigation.navigate('EditContext', { path, isDirectory: true })}
      >
        <View style={styles.contextButtonContent}>
          <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
          <Text style={styles.contextButtonText}>Folder Context</Text>
        </View>
      </TouchableOpacity>

      {/* New item modal */}
      <Modal
        visible={showNewModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNewModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowNewModal(false); setNewItemType('file'); }}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Item</Text>
            {newItemType !== 'github' ? (
              <TouchableOpacity onPress={handleCreateNew}>
                <Text style={styles.modalDone}>Create</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 50 }} />
            )}
          </View>

          <View style={styles.modalContent}>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  newItemType === 'file' && styles.typeButtonActive,
                ]}
                onPress={() => setNewItemType('file')}
              >
                <Ionicons
                  name="document-text-outline"
                  size={32}
                  color={newItemType === 'file' ? '#007AFF' : '#8E8E93'}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    newItemType === 'file' && styles.typeLabelActive,
                  ]}
                >
                  Text File
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  newItemType === 'folder' && styles.typeButtonActive,
                ]}
                onPress={() => setNewItemType('folder')}
              >
                <Ionicons
                  name="folder-outline"
                  size={32}
                  color={newItemType === 'folder' ? '#007AFF' : '#8E8E93'}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    newItemType === 'folder' && styles.typeLabelActive,
                  ]}
                >
                  Folder
                </Text>
              </TouchableOpacity>
              {isRootPath && (
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newItemType === 'github' && styles.typeButtonActive,
                  ]}
                  onPress={() => {
                    setNewItemType('github');
                    loadGitHubRepos();
                  }}
                >
                  <Ionicons
                    name="logo-github"
                    size={32}
                    color={newItemType === 'github' ? '#007AFF' : '#8E8E93'}
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      newItemType === 'github' && styles.typeLabelActive,
                    ]}
                  >
                    GitHub
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {newItemType === 'github' ? (
              <View style={styles.repoList}>
                {isLoadingRepos ? (
                  <View style={styles.repoLoading}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.repoLoadingText}>Loading repositories...</Text>
                  </View>
                ) : isCloning ? (
                  <View style={styles.repoLoading}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.repoLoadingText}>Cloning repository...</Text>
                  </View>
                ) : (
                  <ScrollView>
                    {githubRepos.map((repo) => (
                      <TouchableOpacity
                        key={repo.fullName}
                        style={styles.repoItem}
                        onPress={() => handleCloneRepo(repo)}
                      >
                        <View style={styles.repoInfo}>
                          <Ionicons
                            name={repo.private ? 'lock-closed-outline' : 'globe-outline'}
                            size={20}
                            color="#666"
                          />
                          <View style={styles.repoText}>
                            <Text style={styles.repoName}>{repo.name}</Text>
                            <Text style={styles.repoOwner}>{repo.fullName}</Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#c7c7cc" />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : (
              <TextInput
                style={styles.nameInput}
                value={newItemName}
                onChangeText={setNewItemName}
                placeholder={newItemType === 'folder' ? 'Folder name' : 'File name'}
                placeholderTextColor="#999"
                autoFocus={true}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleCreateNew}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Rename modal */}
      <Modal
        visible={showRenameModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowRenameModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Rename</Text>
            <TouchableOpacity onPress={handleRenameSubmit}>
              <Text style={styles.modalDone}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.renameRow}>
              <Ionicons
                name={renameItem?.isDirectory ? 'folder' : 'document-text'}
                size={24}
                color={renameItem?.isDirectory ? '#007AFF' : '#8E8E93'}
              />
              <TextInput
                style={styles.renameInput}
                value={renameName}
                onChangeText={setRenameName}
                placeholder="Enter new name"
                placeholderTextColor="#999"
                autoFocus={true}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleRenameSubmit}
                selectTextOnFocus={true}
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* About modal */}
      <Modal
        visible={showAboutModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowAboutModal(false)}
      >
        <TouchableOpacity 
          style={styles.aboutOverlay}
          activeOpacity={1}
          onPress={() => setShowAboutModal(false)}
        >
          <View style={styles.aboutContainer}>
            <View style={styles.aboutHeader}>
              <Ionicons name="leaf" size={40} color="#34C759" />
              <Text style={styles.aboutTitle}>LifeDB</Text>
              <Text style={styles.aboutVersion}>Version 1.0.0</Text>
            </View>
            <Text style={styles.aboutDescription}>
              A file manager with integrated Gemini AI assistance. Create folders and text files, add context to help Gemini understand your content, and use AI to help edit your files.
            </Text>
            <TouchableOpacity
              style={styles.aboutDismiss}
              onPress={() => setShowAboutModal(false)}
            >
              <Text style={styles.aboutDismissText}>OK</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sync Modal */}
      <Modal
        visible={showSyncModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSyncModal(false)}
      >
        <View style={styles.syncModalOverlay}>
          <View style={styles.syncModalContent}>
            <View style={styles.syncModalHeader}>
              <Ionicons name="git-branch" size={24} color="#007AFF" />
              <Text style={styles.syncModalTitle}>Git Sync</Text>
              {isSyncing && <ActivityIndicator size="small" color="#007AFF" style={{ marginLeft: 8 }} />}
            </View>
            <ScrollView style={styles.syncLogContainer}>
              {syncLogs.map((log, index) => (
                <View key={index} style={styles.syncLogRow}>
                  <Ionicons 
                    name={
                      log.operation === 'error' ? 'close-circle' : 
                      log.operation === 'info' ? 'information-circle' :
                      log.success === true ? 'checkmark-circle' :
                      log.success === false ? 'close-circle' : 'sync'
                    } 
                    size={16} 
                    color={
                      log.operation === 'error' || log.success === false ? '#FF3B30' : 
                      log.success === true ? '#34C759' : '#007AFF'
                    } 
                  />
                  <Text style={[
                    styles.syncLogText,
                    log.operation === 'error' && styles.syncLogError,
                    log.success === true && styles.syncLogSuccess,
                  ]}>
                    {log.message}
                  </Text>
                </View>
              ))}
              {syncLogs.length === 0 && isSyncing && (
                <Text style={styles.syncLogText}>Connecting...</Text>
              )}
            </ScrollView>
            {!isSyncing && (
              <TouchableOpacity
                style={styles.syncModalDismiss}
                onPress={() => setShowSyncModal(false)}
              >
                <Text style={styles.syncModalDismissText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>

  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 16,
  },
  headerButtonText: {
    fontSize: 22,
    color: '#007AFF',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptySubtext: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#999',
  },
  contextButton: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  contextButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contextButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  modalCancel: {
    fontSize: 17,
    color: '#007AFF',
  },
  modalDone: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600' as const,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonActive: {
    borderColor: '#007AFF',
  },
  typeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 14,
    color: '#666',
  },
  typeLabelActive: {
    color: '#007AFF',
    fontWeight: '600' as const,
  },
  nameInput: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
  },
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  renameInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 4,
  },
  aboutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 32,
    alignItems: 'center',
    maxWidth: 320,
  },
  aboutHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  aboutTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginTop: 8,
    color: '#000',
  },
  aboutVersion: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  aboutDescription: {
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  aboutDismiss: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 8,
  },
  aboutDismissText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  // Sync Modal Styles
  syncModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  syncModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  syncModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    marginBottom: 16,
  },
  syncModalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginLeft: 8,
    color: '#000',
  },
  syncLogContainer: {
    maxHeight: 200,
    marginBottom: 16,
  },
  syncLogRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingVertical: 4,
  },
  syncLogText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  syncLogError: {
    color: '#FF3B30',
  },
  syncLogSuccess: {
    color: '#34C759',
  },
  syncModalDismiss: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncModalDismissText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  // GitHub repo styles
  repoList: {
    flex: 1,
    marginTop: 16,
  },
  repoLoading: {
    padding: 40,
    alignItems: 'center',
  },
  repoLoadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  repoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  repoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  repoText: {
    marginLeft: 12,
    flex: 1,
  },
  repoName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#1a1a1a',
  },
  repoOwner: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
});

