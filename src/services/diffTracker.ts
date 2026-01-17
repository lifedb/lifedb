import { Paths, File, Directory } from 'expo-file-system';
import { createPatch } from 'diff';
import { DiffEntry, DiffHistory } from '../types';

// Storage directory for diff history
const getDiffStorageDirectory = (): Directory => {
  return new Directory(Paths.document, 'lifedb_diffs');
};

/**
 * Generate a unique ID
 */
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Get the storage file for a file's diff history
 */
const getHistoryFile = (filePath: string): File => {
  // Create a safe filename from the path
  const safeName = filePath.replace(/[^a-zA-Z0-9]/g, '_') + '.json';
  return new File(getDiffStorageDirectory(), safeName);
};

/**
 * Initialize diff storage directory
 */
export const initializeDiffStorage = async (): Promise<void> => {
  const dir = getDiffStorageDirectory();
  if (!dir.exists) {
    await dir.create();
  }
};

/**
 * Load diff history for a file
 */
export const loadHistory = async (filePath: string): Promise<DiffHistory> => {
  const historyFile = getHistoryFile(filePath);
  
  try {
    if (!historyFile.exists) {
      return {
        filePath,
        entries: [],
        currentIndex: -1,
      };
    }
    const content = await historyFile.text();
    return JSON.parse(content);
  } catch {
    // No history exists yet
    return {
      filePath,
      entries: [],
      currentIndex: -1,
    };
  }
};

/**
 * Save diff history for a file
 */
const saveHistory = async (history: DiffHistory): Promise<void> => {
  const historyFile = getHistoryFile(history.filePath);
  await historyFile.write(JSON.stringify(history, null, 2));
};

/**
 * Record a change to a file
 */
export const recordChange = async (
  filePath: string,
  previousContent: string,
  newContent: string,
  source: 'user' | 'gemini',
  metadata?: { prompt?: string }
): Promise<void> => {
  // Don't record if content hasn't changed
  if (previousContent === newContent) {
    return;
  }

  const history = await loadHistory(filePath);
  
  // If we're not at the end of history (user undid some changes),
  // truncate the future entries
  if (history.currentIndex < history.entries.length - 1) {
    history.entries = history.entries.slice(0, history.currentIndex + 1);
  }
  
  // Create diff
  const diff = createPatch(filePath, previousContent, newContent, '', '');
  
  const entry: DiffEntry = {
    id: generateId(),
    timestamp: Date.now(),
    source,
    diff,
    prompt: metadata?.prompt,
    previousContent,
    newContent,
  };
  
  history.entries.push(entry);
  history.currentIndex = history.entries.length - 1;
  
  // Limit history size (keep last 100 entries)
  if (history.entries.length > 100) {
    history.entries = history.entries.slice(-100);
    history.currentIndex = history.entries.length - 1;
  }
  
  await saveHistory(history);
};

/**
 * Undo the last change
 * Returns the content to restore, or null if nothing to undo
 */
export const undo = async (filePath: string): Promise<string | null> => {
  const history = await loadHistory(filePath);
  
  if (history.currentIndex < 0 || history.entries.length === 0) {
    return null; // Nothing to undo
  }
  
  const currentEntry = history.entries[history.currentIndex];
  history.currentIndex--;
  
  await saveHistory(history);
  
  return currentEntry.previousContent;
};

/**
 * Redo a previously undone change
 * Returns the content to restore, or null if nothing to redo
 */
export const redo = async (filePath: string): Promise<string | null> => {
  const history = await loadHistory(filePath);
  
  if (history.currentIndex >= history.entries.length - 1) {
    return null; // Nothing to redo
  }
  
  history.currentIndex++;
  const entry = history.entries[history.currentIndex];
  
  await saveHistory(history);
  
  return entry.newContent;
};

/**
 * Get list of entries for UI display
 */
export const getHistoryEntries = async (filePath: string): Promise<DiffEntry[]> => {
  const history = await loadHistory(filePath);
  return history.entries;
};

/**
 * Get current position in history
 */
export const getCurrentIndex = async (filePath: string): Promise<number> => {
  const history = await loadHistory(filePath);
  return history.currentIndex;
};

/**
 * Check if undo is available
 */
export const canUndo = async (filePath: string): Promise<boolean> => {
  const history = await loadHistory(filePath);
  return history.currentIndex >= 0;
};

/**
 * Check if redo is available
 */
export const canRedo = async (filePath: string): Promise<boolean> => {
  const history = await loadHistory(filePath);
  return history.currentIndex < history.entries.length - 1;
};

/**
 * Undo to a specific entry by ID
 * Returns the content at that point in history
 */
export const undoToEntry = async (filePath: string, entryId: string): Promise<string | null> => {
  const history = await loadHistory(filePath);
  
  const entryIndex = history.entries.findIndex(e => e.id === entryId);
  if (entryIndex === -1) {
    return null;
  }
  
  // The content after applying the entry at entryIndex
  const targetEntry = history.entries[entryIndex];
  history.currentIndex = entryIndex;
  
  await saveHistory(history);
  
  return targetEntry.newContent;
};

/**
 * Clear history for a file (e.g., when file is deleted)
 */
export const clearHistory = async (filePath: string): Promise<void> => {
  const historyFile = getHistoryFile(filePath);
  try {
    if (historyFile.exists) {
      await historyFile.delete();
    }
  } catch {
    // Ignore errors
  }
};
