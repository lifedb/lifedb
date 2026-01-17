/**
 * GitHub Sync Service
 * 
 * Handles syncing files between the app and a GitHub repository.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Paths, File, Directory } from 'expo-file-system';
import {
  getFileContent,
  updateFile,
  listRepoFiles,
  getGitHubUsername,
} from './githubService';

const SELECTED_REPO_KEY = 'github_selected_repo';
const LAST_SYNC_KEY = 'github_last_sync';

interface SyncResult {
  success: boolean;
  filesUploaded: number;
  filesDownloaded: number;
  error?: string;
}

/**
 * Get the currently selected repository
 */
export const getSelectedRepo = async (): Promise<{ owner: string; repo: string } | null> => {
  const fullName = await AsyncStorage.getItem(SELECTED_REPO_KEY);
  if (!fullName) return null;
  
  const [owner, repo] = fullName.split('/');
  return { owner, repo };
};

/**
 * Get the local documents directory
 */
const getLocalDocsDir = (): Directory => {
  return new Directory(Paths.document, 'lifedb');
};

/**
 * Recursively get all files in a directory
 */
const getAllLocalFiles = async (
  dir: Directory,
  basePath: string = ''
): Promise<Array<{ path: string; content: string }>> => {
  const files: Array<{ path: string; content: string }> = [];
  
  if (!dir.exists) return files;
  
  const items = await dir.list();
  
  for (const item of items) {
    const relativePath = basePath ? `${basePath}/${item.name}` : item.name;
    
    if (item instanceof Directory) {
      // Skip hidden directories and special folders
      if (!item.name.startsWith('.') && item.name !== 'context') {
        const subFiles = await getAllLocalFiles(item, relativePath);
        files.push(...subFiles);
      }
    } else if (item instanceof File) {
      // Only sync markdown and text files
      if (item.name.endsWith('.md') || item.name.endsWith('.txt')) {
        try {
          const content = await item.text();
          files.push({ path: relativePath, content });
        } catch (error) {
          console.warn(`Could not read file: ${relativePath}`, error);
        }
      }
    }
  }
  
  return files;
};

/**
 * Upload local files to GitHub
 */
export const pushToGitHub = async (): Promise<SyncResult> => {
  const repoInfo = await getSelectedRepo();
  if (!repoInfo) {
    return { success: false, filesUploaded: 0, filesDownloaded: 0, error: 'No repository selected' };
  }
  
  const { owner, repo } = repoInfo;
  const localDir = getLocalDocsDir();
  
  try {
    const localFiles = await getAllLocalFiles(localDir);
    let filesUploaded = 0;
    
    for (const file of localFiles) {
      // Check if file exists on GitHub
      const githubFile = await getFileContent(owner, repo, file.path);
      
      // Only upload if content is different
      if (!githubFile || githubFile.content !== file.content) {
        const message = githubFile 
          ? `Update ${file.path} from LifeDB`
          : `Add ${file.path} from LifeDB`;
        
        const success = await updateFile(
          owner,
          repo,
          file.path,
          file.content,
          message,
          githubFile?.sha
        );
        
        if (success) filesUploaded++;
      }
    }
    
    // Update last sync time
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    
    return { success: true, filesUploaded, filesDownloaded: 0 };
  } catch (error) {
    console.error('Push to GitHub failed:', error);
    return { success: false, filesUploaded: 0, filesDownloaded: 0, error: String(error) };
  }
};

/**
 * Download files from GitHub to local
 */
export const pullFromGitHub = async (): Promise<SyncResult> => {
  const repoInfo = await getSelectedRepo();
  if (!repoInfo) {
    return { success: false, filesUploaded: 0, filesDownloaded: 0, error: 'No repository selected' };
  }
  
  const { owner, repo } = repoInfo;
  const localDir = getLocalDocsDir();
  
  try {
    // Ensure local directory exists
    if (!localDir.exists) {
      await localDir.create();
    }
    
    // Get all files from GitHub (recursive would require additional API calls)
    const repoFiles = await listRepoFiles(owner, repo, '');
    let filesDownloaded = 0;
    
    for (const repoFile of repoFiles) {
      if (repoFile.type === 'file' && 
          (repoFile.name.endsWith('.md') || repoFile.name.endsWith('.txt'))) {
        
        const githubContent = await getFileContent(owner, repo, repoFile.path);
        if (!githubContent) continue;
        
        // Check if local file exists and is different
        const localFile = new File(localDir, repoFile.path);
        let shouldDownload = true;
        
        if (localFile.exists) {
          try {
            const localContent = await localFile.text();
            shouldDownload = localContent !== githubContent.content;
          } catch {
            // If we can't read it, download it
          }
        }
        
        if (shouldDownload) {
          // Ensure parent directories exist
          const pathParts = repoFile.path.split('/');
          if (pathParts.length > 1) {
            let currentDir = localDir;
            for (let i = 0; i < pathParts.length - 1; i++) {
              currentDir = new Directory(currentDir, pathParts[i]);
              if (!currentDir.exists) {
                await currentDir.create();
              }
            }
          }
          
          await localFile.write(githubContent.content);
          filesDownloaded++;
        }
      }
    }
    
    // Update last sync time
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    
    return { success: true, filesUploaded: 0, filesDownloaded };
  } catch (error) {
    console.error('Pull from GitHub failed:', error);
    return { success: false, filesUploaded: 0, filesDownloaded: 0, error: String(error) };
  }
};

/**
 * Full sync: pull then push
 */
export const syncWithGitHub = async (): Promise<SyncResult> => {
  // First pull to get latest
  const pullResult = await pullFromGitHub();
  if (!pullResult.success) {
    return pullResult;
  }
  
  // Then push local changes
  const pushResult = await pushToGitHub();
  if (!pushResult.success) {
    return { ...pushResult, filesDownloaded: pullResult.filesDownloaded };
  }
  
  return {
    success: true,
    filesUploaded: pushResult.filesUploaded,
    filesDownloaded: pullResult.filesDownloaded,
  };
};

/**
 * Get last sync time
 */
export const getLastSyncTime = async (): Promise<Date | null> => {
  const timestamp = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return timestamp ? new Date(parseInt(timestamp, 10)) : null;
};
