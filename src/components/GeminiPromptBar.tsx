import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';

const GeminiLogo = require('../../assets/gemini.png');

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
          <Image source={GeminiLogo} style={styles.geminiIcon} />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 34,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 16,
    minHeight: 40,
    maxHeight: 100,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    color: '#1a1a1a',
    maxHeight: 80,
    textAlignVertical: 'center',
    paddingVertical: 8,
  },
  button: {
    marginLeft: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 20,
  },
  geminiIcon: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
});
