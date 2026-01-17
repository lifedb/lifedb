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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Folder'>;

export const FolderScreen: React.FC<Props> = ({ navigation, route }) => {
  const { path } = route.params;
  const [items, setItems] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newItemType, setNewItemType] = useState<'folder' | 'file'>('file');
  const [newItemName, setNewItemName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameItem, setRenameItem] = useState<FileItem | null>(null);
  const [renameName, setRenameName] = useState('');

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
        refreshing={isLoading}
        onRefresh={loadDirectory}
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
            <TouchableOpacity onPress={() => setShowNewModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Item</Text>
            <TouchableOpacity onPress={handleCreateNew}>
              <Text style={styles.modalDone}>Create</Text>
            </TouchableOpacity>
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
            </View>

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
});
