import { Paths, File, Directory } from 'expo-file-system';

export interface ChatMessage {
  id: string;
  timestamp: number;
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatLog {
  filePath: string;
  messages: ChatMessage[];
}

// Storage directory for chat logs
const getChatLogDirectory = (): Directory => {
  return new Directory(Paths.document, 'lifedb_chats');
};

/**
 * Generate a unique ID
 */
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Get the storage file for a file's chat log
 */
const getChatLogFile = (filePath: string): File => {
  // Create a safe filename from the path
  const safeName = filePath.replace(/[^a-zA-Z0-9]/g, '_') + '_chat.json';
  return new File(getChatLogDirectory(), safeName);
};

/**
 * Initialize chat log storage directory
 */
export const initializeChatLogStorage = async (): Promise<void> => {
  const dir = getChatLogDirectory();
  if (!dir.exists) {
    await dir.create();
  }
};

/**
 * Load chat log for a file
 */
export const loadChatLog = async (filePath: string): Promise<ChatLog> => {
  const logFile = getChatLogFile(filePath);
  
  try {
    if (!logFile.exists) {
      return {
        filePath,
        messages: [],
      };
    }
    const content = await logFile.text();
    return JSON.parse(content);
  } catch {
    return {
      filePath,
      messages: [],
    };
  }
};

/**
 * Save chat log for a file
 */
const saveChatLog = async (log: ChatLog): Promise<void> => {
  await initializeChatLogStorage();
  const logFile = getChatLogFile(log.filePath);
  await logFile.write(JSON.stringify(log, null, 2));
};

/**
 * Add a message to the chat log
 */
export const addChatMessage = async (
  filePath: string,
  role: 'user' | 'assistant',
  content: string
): Promise<ChatMessage> => {
  const log = await loadChatLog(filePath);
  
  const message: ChatMessage = {
    id: generateId(),
    timestamp: Date.now(),
    role,
    content,
  };
  
  log.messages.push(message);
  
  // Limit to last 100 messages per file
  if (log.messages.length > 100) {
    log.messages = log.messages.slice(-100);
  }
  
  await saveChatLog(log);
  return message;
};

/**
 * Add a conversation (user prompt + assistant response) to the chat log
 */
export const addConversation = async (
  filePath: string,
  userPrompt: string,
  assistantResponse: string
): Promise<void> => {
  await addChatMessage(filePath, 'user', userPrompt);
  await addChatMessage(filePath, 'assistant', assistantResponse);
};

/**
 * Get chat messages for a file
 */
export const getChatMessages = async (filePath: string): Promise<ChatMessage[]> => {
  const log = await loadChatLog(filePath);
  return log.messages;
};

/**
 * Clear chat log for a file
 */
export const clearChatLog = async (filePath: string): Promise<void> => {
  const logFile = getChatLogFile(filePath);
  try {
    if (logFile.exists) {
      await logFile.delete();
    }
  } catch {
    // Ignore errors
  }
};
