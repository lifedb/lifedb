/**
 * Git-integrated file operations
 * 
 * Wraps file system operations with git commands (add, rm) and automatic sync.
 * Provides a unified interface for create/delete/rename that handles both
 * the local file system and git operations.
 */

import * as LegacyFileSystem from 'expo-file-system/legacy';
import LifeDBGit from '../../modules/lifedb-git/src';
import { getGitHubToken, getGitHubUsername } from './githubService';
import {
  createTextFile,
  deleteTextFile,
  createFolder,
  deleteFolder,
  rename,
} from './fileSystem';

// Get the git repos directory (this is where repos would be if using old structure)
const getReposDir = () => `${LegacyFileSystem.documentDirectory}repos/`;

// Get the lifedb base directory (where repos are actually cloned now)
// Remove file:// prefix since native functions expect raw path
const getLifeDBDir = (): string => {
  const docDir = LegacyFileSystem.documentDirectory || '';
  return docDir.replace('file://', '') + 'lifedb/';
};

/**
 * Convert a relative path (from FolderScreen) to an absolute file system path
 * Returns path without file:// prefix since native git functions expect raw paths
 */
const toAbsolutePath = (relativePath: string): string => {
  // relativePath is like "/interview" or "/lifedb-test/readme.txt"  
  const cleanPath = relativePath.replace(/^\/+/, '');
  return `${getLifeDBDir()}${cleanPath}`;
};

/**
 * Find the git repository root for a given relative path
 * Walks up the directory tree looking for a .git directory
 * Returns the repo path and info, or null if not in a repo
 */
export const findGitRepoRoot = async (
  relativePath: string
): Promise<{ repoPath: string; relativePath: string; owner: string; repo: string } | null> => {
  const absolutePath = toAbsolutePath(relativePath);
  console.log('[GitFileOps] findGitRepoRoot - relativePath:', relativePath, 'absolutePath:', absolutePath);
  
  // Walk up the directory tree looking for a .git folder
  const parts = relativePath.split('/').filter(Boolean);
  
  // Start from the root folder and check each level
  for (let i = 1; i <= parts.length; i++) {
    const testPath = '/' + parts.slice(0, i).join('/');
    const testAbsPath = toAbsolutePath(testPath);
    
    console.log('[GitFileOps] Checking if git repo:', testAbsPath);
    
    try {
      const isRepo = await LifeDBGit.isRepository(testAbsPath);
      console.log('[GitFileOps] isRepository result:', isRepo);
      if (isRepo) {
        // Found a git repo!
        const repoName = parts[i - 1];
        const relPathWithinRepo = parts.slice(i).join('/');
        console.log('[GitFileOps] Found repo at:', testAbsPath, 'repoName:', repoName, 'relPath:', relPathWithinRepo);
        return { 
          repoPath: testAbsPath, 
          relativePath: relPathWithinRepo, 
          owner: 'unknown', // We don't know the GitHub owner from the path alone
          repo: repoName 
        };
      }
    } catch (e) {
      console.log('[GitFileOps] isRepository check failed:', e);
      // Continue checking parent directories
    }
  }
  
  console.log('[GitFileOps] No git repo found in path');
  return null;
};

/**
 * Sync changes to git after a file operation
 * Full sync flow: stage changes -> commit -> pull (fetch+rebase) -> push
 * Returns success/failure result
 */
export const syncToGit = async (
  repoPath: string,
  commitMessage: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const token = await getGitHubToken();
    const username = await getGitHubUsername();
    
    if (!token || !username) {
      return { success: false, error: 'Not authenticated with GitHub' };
    }
    
    // Step 1: Push (which stages all changes and commits)
    console.log('[GitSync] Pushing changes...');
    const pushResult = await LifeDBGit.push(repoPath, username, token, commitMessage);
    if (!pushResult.success) {
      // If push fails, it might be because we need to pull first
      console.log('[GitSync] Push failed, trying pull first:', pushResult.error);
      
      // Step 2: Pull (fetch + hard reset to remote)
      console.log('[GitSync] Pulling from remote...');
      const pullResult = await LifeDBGit.pull(repoPath, username, token);
      if (!pullResult.success) {
        return { success: false, error: `Pull failed: ${pullResult.error}` };
      }
      
      // Step 3: Push again after pull
      console.log('[GitSync] Retrying push after pull...');
      const retryPushResult = await LifeDBGit.push(repoPath, username, token, commitMessage);
      if (!retryPushResult.success) {
        return { success: false, error: `Push failed after pull: ${retryPushResult.error}` };
      }
      
      return { success: true, message: 'Synced (pulled and pushed)' };
    }
    
    return { success: true, message: 'Synced' };
  } catch (error: any) {
    console.error('Git sync error:', error);
    return { success: false, error: error.message || 'Git sync failed' };
  }
};

/**
 * Create a file and sync to git
 */
export const createFileWithGit = async (
  parentPath: string,
  name: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  console.log('[GitFileOps] createFileWithGit called with parentPath:', parentPath, 'name:', name);
  
  // Create the file locally first
  await createTextFile(parentPath, name);
  
  // Check if this is in a git repo
  const fullPath = parentPath.endsWith('/') 
    ? `${parentPath}${name}` 
    : `${parentPath}/${name}`;
  console.log('[GitFileOps] Full path:', fullPath);
  console.log('[GitFileOps] Repos dir:', getReposDir());
  
  const repoInfo = await findGitRepoRoot(fullPath);
  console.log('[GitFileOps] Repo info:', repoInfo);
  
  if (!repoInfo) {
    // Not in a git repo, just return success
    console.log('[GitFileOps] Not in a git repo, skipping sync');
    return { success: true, message: 'File created' };
  }
  
  // Sync to git
  return await syncToGit(repoInfo.repoPath, `Create ${name}`);
};

/**
 * Delete a file and sync to git
 */
export const deleteFileWithGit = async (
  filePath: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  // Get repo info before deleting
  const repoInfo = await findGitRepoRoot(filePath);
  const fileName = filePath.split('/').pop() || 'file';
  
  // Delete the file locally
  await deleteTextFile(filePath);
  
  if (!repoInfo) {
    // Not in a git repo, just return success
    return { success: true, message: 'File deleted' };
  }
  
  // Sync to git (the deletion will be picked up by git add .)
  return await syncToGit(repoInfo.repoPath, `Delete ${fileName}`);
};

/**
 * Create a folder and sync to git
 */
export const createFolderWithGit = async (
  parentPath: string,
  name: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  console.log('[GitFileOps] createFolderWithGit called with parentPath:', parentPath, 'name:', name);
  
  // Create the folder locally first
  await createFolder(parentPath, name);
  
  // Check if this is in a git repo
  const fullPath = parentPath.endsWith('/') 
    ? `${parentPath}${name}` 
    : `${parentPath}/${name}`;
  console.log('[GitFileOps] Folder full path:', fullPath);
  
  const repoInfo = await findGitRepoRoot(fullPath);
  console.log('[GitFileOps] Folder repo info:', repoInfo);
  
  if (!repoInfo) {
    // Not in a git repo, just return success
    console.log('[GitFileOps] Not in a git repo, skipping sync');
    return { success: true, message: 'Folder created' };
  }
  
  // Note: Git doesn't track empty directories, but we create a .context file
  // which will be tracked
  return await syncToGit(repoInfo.repoPath, `Create folder ${name}`);
};

/**
 * Delete a folder and sync to git
 */
export const deleteFolderWithGit = async (
  folderPath: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  // Get repo info before deleting
  const repoInfo = await findGitRepoRoot(folderPath);
  const folderName = folderPath.split('/').filter(Boolean).pop() || 'folder';
  
  // Delete the folder locally
  await deleteFolder(folderPath);
  
  if (!repoInfo) {
    // Not in a git repo, just return success
    return { success: true, message: 'Folder deleted' };
  }
  
  // Sync to git
  return await syncToGit(repoInfo.repoPath, `Delete folder ${folderName}`);
};

/**
 * Rename a file or folder and sync to git
 */
export const renameWithGit = async (
  path: string,
  newName: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  // Get repo info and old name before renaming
  const repoInfo = await findGitRepoRoot(path);
  const oldName = path.split('/').filter(Boolean).pop() || 'item';
  
  // Rename locally
  await rename(path, newName);
  
  if (!repoInfo) {
    // Not in a git repo, just return success
    return { success: true, message: 'Renamed successfully' };
  }
  
  // Sync to git (git add . will pick up the rename as delete + add)
  return await syncToGit(repoInfo.repoPath, `Rename ${oldName} to ${newName}`);
};
