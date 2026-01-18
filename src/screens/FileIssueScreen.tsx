import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { createIssue } from '../services/githubIssueService';
import { isGitHubAuthenticated } from '../services/githubService';

type Props = NativeStackScreenProps<RootStackParamList, 'FileIssue'>;

export const FileIssueScreen: React.FC<Props> = ({ navigation }) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSend = async () => {
    // If empty, just go back
    if (!content.trim()) {
      navigation.goBack();
      return;
    }

    // Check if authenticated
    const isAuth = await isGitHubAuthenticated();
    if (!isAuth) {
      Alert.alert(
        'Not Connected',
        'Please connect your GitHub account in Settings to file issues.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => navigation.navigate('Settings') },
        ]
      );
      return;
    }

    setIsSubmitting(true);

    // Parse first line as title, rest as body
    const lines = content.trim().split('\n');
    const title = lines[0];
    const body = lines.slice(1).join('\n').trim();

    const result = await createIssue(title, body);

    setIsSubmitting(false);

    if (result.success) {
      Alert.alert('Issue Created', 'Your issue has been filed successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Error', result.error || 'Failed to create issue');
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: 'File Issue',
      headerTitleAlign: 'center',
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.headerButton, styles.headerButtonActive]}
          >
            <Ionicons name="bug-outline" size={22} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSend}
            style={styles.headerButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Ionicons name="send-outline" size={22} color="#007AFF" />
            )}
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, content, isSubmitting]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <TextInput
          style={styles.editor}
          value={content}
          onChangeText={setContent}
          multiline={true}
          textAlignVertical="top"
          placeholder="First line = issue title&#10;&#10;Remaining lines = issue body..."
          placeholderTextColor="#999"
          autoFocus={true}
          editable={!isSubmitting}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  editor: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    color: '#1a1a1a',
    backgroundColor: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 6,
  },
  headerButtonActive: {
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
  },
});
