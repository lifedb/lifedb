import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FileItem } from '../types';

interface FileListItemProps {
  item: FileItem;
  onPress: () => void;
  onLongPress?: () => void;
  onContextPress?: () => void;
  onDelete?: () => void;
  onRename?: () => void;
}

export const FileListItem: React.FC<FileListItemProps> = ({
  item,
  onPress,
  onLongPress,
  onContextPress,
  onDelete,
  onRename,
}) => {
  const handleLongPress = () => {
    Alert.alert(
      item.name,
      'Choose an action',
      [
        { text: 'Cancel', style: 'cancel' },
        ...(onRename
          ? [{ text: 'Rename', onPress: onRename }]
          : []),
        ...(onContextPress
          ? [{ text: 'Edit Context', onPress: onContextPress }]
          : []),
        ...(onDelete
          ? [{ text: 'Delete', style: 'destructive' as const, onPress: onDelete }]
          : []),
      ]
    );
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress || handleLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={item.isDirectory ? 'folder' : 'document-text'}
          size={24}
          color={item.isDirectory ? '#007AFF' : '#8E8E93'}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {!item.isDirectory && item.size !== undefined && (
          <Text style={styles.size}>{formatBytes(item.size)}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  iconContainer: {
    width: 32,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 17,
    color: '#000',
  },
  size: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
});
