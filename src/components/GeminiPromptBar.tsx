import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface GeminiPromptBarProps {
  onSubmit: (prompt: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export const GeminiPromptBar: React.FC<GeminiPromptBarProps> = ({
  onSubmit,
  disabled = false,
  placeholder = 'Ask Gemini to edit this file...',
}) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading || disabled) return;

    setIsLoading(true);
    try {
      await onSubmit(prompt.trim());
      setPrompt('');
    } catch (error) {
      console.error('Gemini prompt error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder={placeholder}
          placeholderTextColor="#999"
          multiline={true}
          maxLength={2000}
          editable={!isLoading && !disabled}
        />
      </View>
      <TouchableOpacity
        style={[
          styles.button,
          (!prompt.trim() || isLoading || disabled) && styles.buttonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!prompt.trim() || isLoading || disabled}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="sparkles" size={22} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f8f8',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
    maxHeight: 100,
  },
  input: {
    fontSize: 16,
    color: '#1a1a1a',
    maxHeight: 80,
  },
  button: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    fontSize: 20,
  },
});
