import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface UndoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  historyCount?: number;
  currentIndex?: number;
}

export const UndoControls: React.FC<UndoControlsProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  historyCount,
  currentIndex,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, !canUndo && styles.buttonDisabled]}
        onPress={onUndo}
        disabled={!canUndo}
      >
        <View style={styles.buttonContent}>
          <Ionicons
            name="arrow-undo"
            size={16}
            color={canUndo ? '#007AFF' : '#999'}
          />
          <Text style={[styles.buttonText, !canUndo && styles.textDisabled]}>
            Undo
          </Text>
        </View>
      </TouchableOpacity>
      
      {historyCount !== undefined && currentIndex !== undefined && historyCount > 0 && (
        <Text style={styles.counter}>
          {currentIndex + 1}/{historyCount}
        </Text>
      )}
      
      <TouchableOpacity
        style={[styles.button, !canRedo && styles.buttonDisabled]}
        onPress={onRedo}
        disabled={!canRedo}
      >
        <View style={styles.buttonContent}>
          <Text style={[styles.buttonText, !canRedo && styles.textDisabled]}>
            Redo
          </Text>
          <Ionicons
            name="arrow-redo"
            size={16}
            color={canRedo ? '#007AFF' : '#999'}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f8f8f8',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  buttonDisabled: {
    borderColor: '#C7C7CC',
    backgroundColor: '#f0f0f0',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  buttonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500' as const,
  },
  textDisabled: {
    color: '#999',
  },
  counter: {
    marginHorizontal: 16,
    fontSize: 12,
    color: '#8E8E93',
  },
});
