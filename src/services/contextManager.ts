import { AggregatedContext } from '../types';
import { getFileContext, getDirectoryContext } from './fileSystem';

/**
 * Get all ancestor directory paths for a given file path
 */
const getAncestorPaths = (filePath: string): string[] => {
  const parts = filePath.split('/').filter(Boolean);
  const ancestors: string[] = [];
  
  // Build paths from root to parent
  for (let i = 0; i < parts.length - 1; i++) {
    ancestors.push('/' + parts.slice(0, i + 1).join('/'));
  }
  
  // Add root
  ancestors.unshift('/');
  
  return ancestors;
};

/**
 * Aggregate context from file and all ancestor directories
 * Returns context from root down to the file itself
 */
export const getAggregatedContext = async (filePath: string): Promise<AggregatedContext> => {
  const ancestorPaths = getAncestorPaths(filePath);
  
  // Get file's own context
  const fileContext = await getFileContext(filePath);
  
  // Get all ancestor directory contexts
  const ancestorContexts: { path: string; context: string }[] = [];
  
  for (const path of ancestorPaths) {
    const context = await getDirectoryContext(path);
    if (context.trim()) {
      ancestorContexts.push({ path, context });
    }
  }
  
  // Build full context string
  const contextParts: string[] = [];
  
  // Add ancestor contexts (root to parent)
  for (const { path, context } of ancestorContexts) {
    contextParts.push(`[Directory: ${path}]\n${context}`);
  }
  
  // Add file context
  if (fileContext.trim()) {
    contextParts.push(`[File Context]\n${fileContext}`);
  }
  
  const fullContextString = contextParts.join('\n\n---\n\n');
  
  return {
    fileContext,
    ancestorContexts,
    fullContextString,
  };
};

/**
 * Format context for display in UI
 */
export const formatContextForDisplay = (context: AggregatedContext): string => {
  if (!context.fullContextString.trim()) {
    return 'No context defined';
  }
  return context.fullContextString;
};

/**
 * Build system prompt for Gemini including all context
 */
export const buildSystemPrompt = (context: AggregatedContext, fileContent: string): string => {
  const parts: string[] = [];
  
  parts.push('You are an AI assistant helping the user edit a text file.');
  parts.push('');
  
  if (context.fullContextString.trim()) {
    parts.push('## Context Information');
    parts.push(context.fullContextString);
    parts.push('');
  }
  
  parts.push('## Current File Content');
  parts.push('```');
  parts.push(fileContent);
  parts.push('```');
  parts.push('');
  parts.push('When responding, provide the complete updated file content that should replace the current content.');
  parts.push('If the user asks a question, answer it and then provide any suggested edits to the file if applicable.');
  
  return parts.join('\n');
};
