import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';

const GeminiLogo = require('../../assets/gemini.png');

interface GeminiPromptBarProps {
  onSubmit: (prompt: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  loading?: boolean;
}

export const GeminiPromptBar: React.FC<GeminiPromptBarProps> = ({
  onSubmit,
  disabled = false,
  placeholder = 'Ask Gemini to edit this file...',
  loading = false,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Combined loading state: either parent says loading OR we're submitting
  const isLoading = loading || isSubmitting;
  
  // Animation values for smooth transition
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const spinnerFadeAnim = useRef(new Animated.Value(0)).current;
  
  // Animate transition when loading state changes
  useEffect(() => {
    if (isLoading) {
      // Fade out logo, fade in spinner
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(spinnerFadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Fade in logo, fade out spinner
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(spinnerFadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLoading, fadeAnim, spinnerFadeAnim]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading || disabled) return;

    setIsSubmitting(true);
    try {
      await onSubmit(prompt.trim());
      setPrompt('');
    } catch (error) {
      console.error('Gemini prompt error:', error);
    } finally {
      setIsSubmitting(false);
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
          isLoading && styles.buttonLoading,
          (!prompt.trim() || disabled) && !isLoading && styles.buttonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!prompt.trim() || isLoading || disabled}
      >
        <View style={styles.buttonContent}>
          <Animated.View style={[styles.iconWrapper, { opacity: fadeAnim }]}>
            <Image source={GeminiLogo} style={styles.geminiIcon} />
          </Animated.View>
          <Animated.View style={[styles.iconWrapper, styles.spinnerWrapper, { opacity: spinnerFadeAnim }]}>
            <ActivityIndicator size="small" color="#4285F4" />
          </Animated.View>
        </View>
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
  buttonLoading: {
    opacity: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 22,
  },
  buttonText: {
    fontSize: 20,
  },
  geminiIcon: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  buttonContent: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerWrapper: {
    // Same position as iconWrapper, no additional styles needed
  },
});
