import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface UndoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  showChat?: boolean;
  onChatPress?: () => void;
  statusContent?: React.ReactNode;
}

export const UndoControls: React.FC<UndoControlsProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  showChat,
  onChatPress,
  statusContent,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftButtons}>
        <TouchableOpacity
          style={[styles.button, !canUndo && styles.buttonDisabled]}
          onPress={onUndo}
          disabled={!canUndo}
        >
          <Ionicons
            name="arrow-undo"
            size={22}
            color={canUndo ? '#007AFF' : '#C7C7CC'}
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, !canRedo && styles.buttonDisabled]}
          onPress={onRedo}
          disabled={!canRedo}
        >
          <Ionicons
            name="arrow-redo"
            size={22}
            color={canRedo ? '#007AFF' : '#C7C7CC'}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.centerContent}>
        {statusContent}
      </View>

      {onChatPress && (
        <TouchableOpacity
          style={[styles.chatButton, showChat && styles.chatButtonActive]}
          onPress={onChatPress}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={22}
            color="#007AFF"
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  leftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 1,
  },
  centerContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    padding: 6,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  chatButton: {
    padding: 6,
    zIndex: 1,
  },
  chatButtonActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
  },
});
