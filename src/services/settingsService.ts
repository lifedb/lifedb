import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings } from '../types';

const SETTINGS_KEY = '@lifedb_settings';

const defaultSettings: AppSettings = {
  geminiApiKey: null,
};

/**
 * Load settings from storage
 */
export const loadSettings = async (): Promise<AppSettings> => {
  try {
    const json = await AsyncStorage.getItem(SETTINGS_KEY);
    if (json) {
      return { ...defaultSettings, ...JSON.parse(json) };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return defaultSettings;
};

/**
 * Save settings to storage
 */
export const saveSettings = async (settings: AppSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

/**
 * Get the Gemini API key
 */
export const getApiKey = async (): Promise<string | null> => {
  const settings = await loadSettings();
  return settings.geminiApiKey;
};

/**
 * Set the Gemini API key
 */
export const setApiKey = async (apiKey: string): Promise<void> => {
  const settings = await loadSettings();
  settings.geminiApiKey = apiKey;
  await saveSettings(settings);
};

/**
 * Clear the API key
 */
export const clearApiKey = async (): Promise<void> => {
  const settings = await loadSettings();
  settings.geminiApiKey = null;
  await saveSettings(settings);
};
