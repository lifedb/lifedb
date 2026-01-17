// Core types for LifeDB

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedTime?: number;
}

export interface AggregatedContext {
  fileContext: string;
  ancestorContexts: {
    path: string;
    context: string;
  }[];
  fullContextString: string;
}

export interface DiffEntry {
  id: string;
  timestamp: number;
  source: 'user' | 'gemini';
  diff: string;
  prompt?: string;
  previousContent: string;
  newContent: string;
}

export interface DiffHistory {
  filePath: string;
  entries: DiffEntry[];
  currentIndex: number; // Points to current state in history for undo/redo
}

export interface GeminiResponse {
  newContent: string;
  explanation?: string;
}

export interface AppSettings {
  geminiApiKey: string | null;
}

// Navigation types
export type RootStackParamList = {
  Folder: { path: string };
  TextFile: { path: string; name: string };
  Settings: undefined;
  EditContext: { path: string; isDirectory: boolean };
  GitHubSync: undefined;
};
