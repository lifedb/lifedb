import { Paths, File, Directory } from 'expo-file-system';
import { FileItem } from '../types';

// Base directory for all user files
const getBaseDirectory = (): Directory => {
  return new Directory(Paths.document, 'lifedb');
};

// Context file naming conventions
const getFileContextName = (fileName: string): string => `.${fileName}.context`;
const getDirectoryContextName = (): string => '.context';

/**
 * Ensure the base directory exists
 */
export const initializeFileSystem = async (): Promise<void> => {
  const baseDir = getBaseDirectory();
  if (!baseDir.exists) {
    await baseDir.create();
    // Create root context file
    const contextFile = new File(baseDir, getDirectoryContextName());
    await contextFile.create();
  }
};

/**
 * Get a Directory instance for a relative path
 */
const getDirectory = (relativePath: string): Directory => {
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length === 0) {
    return getBaseDirectory();
  }
  return new Directory(getBaseDirectory(), ...parts);
};

/**
 * Get a File instance for a relative path
 */
const getFile = (relativePath: string): File => {
  const parts = relativePath.split('/').filter(Boolean);
  return new File(getBaseDirectory(), ...parts);
};

/**
 * Get relative path from a File or Directory URI
 */
export const getRelativePath = (uri: string): string => {
  const baseUri = getBaseDirectory().uri;
  if (uri.startsWith(baseUri)) {
    const relative = uri.slice(baseUri.length);
    return relative.startsWith('/') ? relative : '/' + relative;
  }
  return '/' + uri;
};

/**
 * List contents of a directory
 */
export const listDirectory = async (relativePath: string): Promise<FileItem[]> => {
  const dir = getDirectory(relativePath);
  
  try {
    if (!dir.exists) {
      return [];
    }
    
    const contents = await dir.list();
    const items: FileItem[] = [];
    
    for (const entry of contents) {
      // Remove trailing slashes and get the last component
      const cleanUri = entry.uri.replace(/\/+$/, '');
      const name = cleanUri.split('/').pop() || '';
      
      // Skip context files from listing
      if (name.startsWith('.') && (name.endsWith('.context') || name === '.context')) {
        continue;
      }
      
      const isDir = entry instanceof Directory;
      
      items.push({
        name,
        path: getRelativePath(entry.uri),
        isDirectory: isDir,
        size: !isDir && entry instanceof File ? entry.size : undefined,
      });
    }
    
    // Sort: directories first, then alphabetically
    return items.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('Error listing directory:', error);
    return [];
  }
};

/**
 * Create a new folder with its context file
 */
export const createFolder = async (parentPath: string, name: string): Promise<void> => {
  const parentDir = getDirectory(parentPath);
  const newDir = new Directory(parentDir, name);
  
  await newDir.create();
  // Create directory context file
  const contextFile = new File(newDir, getDirectoryContextName());
  await contextFile.create();
};

/**
 * Delete a folder and its context file
 */
export const deleteFolder = async (relativePath: string): Promise<void> => {
  const dir = getDirectory(relativePath);
  if (dir.exists) {
    await dir.delete();
  }
};

/**
 * Create a new text file with its context file
 */
export const createTextFile = async (parentPath: string, name: string): Promise<void> => {
  const parentDir = getDirectory(parentPath);
  const file = new File(parentDir, name);
  const contextFile = new File(parentDir, getFileContextName(name));
  
  await file.create();
  await contextFile.create();
};

/**
 * Read a text file
 */
export const readTextFile = async (relativePath: string): Promise<string> => {
  const file = getFile(relativePath);
  try {
    if (!file.exists) {
      return '';
    }
    return await file.text();
  } catch (error) {
    console.error('Error reading file:', error);
    return '';
  }
};

/**
 * Write to a text file
 */
export const writeTextFile = async (relativePath: string, content: string): Promise<void> => {
  const file = getFile(relativePath);
  await file.write(content);
};

/**
 * Delete a text file and its context file
 */
export const deleteTextFile = async (relativePath: string): Promise<void> => {
  const file = getFile(relativePath);
  const fileName = relativePath.split('/').pop() || '';
  const parentPath = relativePath.slice(0, relativePath.lastIndexOf('/')) || '/';
  const parentDir = getDirectory(parentPath);
  const contextFile = new File(parentDir, getFileContextName(fileName));
  
  if (file.exists) {
    await file.delete();
  }
  if (contextFile.exists) {
    await contextFile.delete();
  }
};

/**
 * Get context file content for a file
 */
export const getFileContext = async (relativePath: string): Promise<string> => {
  const fileName = relativePath.split('/').pop() || '';
  const parentPath = relativePath.slice(0, relativePath.lastIndexOf('/')) || '/';
  const parentDir = getDirectory(parentPath);
  const contextFile = new File(parentDir, getFileContextName(fileName));
  
  try {
    if (!contextFile.exists) {
      return '';
    }
    return await contextFile.text();
  } catch {
    return '';
  }
};

/**
 * Set context file content for a file
 */
export const setFileContext = async (relativePath: string, content: string): Promise<void> => {
  const fileName = relativePath.split('/').pop() || '';
  const parentPath = relativePath.slice(0, relativePath.lastIndexOf('/')) || '/';
  const parentDir = getDirectory(parentPath);
  const contextFile = new File(parentDir, getFileContextName(fileName));
  
  await contextFile.write(content);
};

/**
 * Get context file content for a directory
 */
export const getDirectoryContext = async (relativePath: string): Promise<string> => {
  const dir = getDirectory(relativePath);
  const contextFile = new File(dir, getDirectoryContextName());
  
  try {
    if (!contextFile.exists) {
      return '';
    }
    return await contextFile.text();
  } catch {
    return '';
  }
};

/**
 * Set context file content for a directory
 */
export const setDirectoryContext = async (relativePath: string, content: string): Promise<void> => {
  const dir = getDirectory(relativePath);
  const contextFile = new File(dir, getDirectoryContextName());
  
  await contextFile.write(content);
};

/**
 * Check if a path exists
 */
export const pathExists = async (relativePath: string): Promise<boolean> => {
  const file = getFile(relativePath);
  return file.exists;
};

/**
 * Rename a file or folder
 */
export const rename = async (relativePath: string, newName: string): Promise<void> => {
  const oldFile = getFile(relativePath);
  const oldName = relativePath.split('/').pop() || '';
  const parentPath = relativePath.slice(0, relativePath.lastIndexOf('/')) || '/';
  const parentDir = getDirectory(parentPath);
  const newFile = new File(parentDir, newName);
  
  await oldFile.move(newFile);
  
  // Try to rename context file if it exists
  try {
    const oldContextFile = new File(parentDir, getFileContextName(oldName));
    if (oldContextFile.exists) {
      const newContextFile = new File(parentDir, getFileContextName(newName));
      await oldContextFile.move(newContextFile);
    }
  } catch {
    // Context file might not exist for directories
  }
};
