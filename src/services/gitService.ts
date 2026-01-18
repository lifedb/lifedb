/**
 * Git Service
 * 
 * Provides git operations for repositories within the lifedb directory.
 * Handles auto-commit on file changes and context-aware sync.
 */

import { Paths, Directory, File } from 'expo-file-system';
import LifeDBGit from 'lifedb-git';
import { getGitHubUsername, getGitHubToken } from './githubService';

/**
 * Get the base directory for all user files
 */
const getBaseDirectory = (): Directory => {
  return new Directory(Paths.document, 'lifedb');
};

/**
 * Check if a given path is inside a git repository
 * Returns the repo root path if found, null otherwise
 */
export const findGitRepoRoot = async (relativePath: string): Promise<string | null> => {
  const baseDir = getBaseDirectory();
  const parts = relativePath.split('/').filter(Boolean);
  
  // Start from the file's directory and walk up to find .git
  for (let i = parts.length; i >= 0; i--) {
    const checkPath = parts.slice(0, i).join('/') || '';
    const checkDir = checkPath ? new Directory(baseDir, ...checkPath.split('/')) : baseDir;
    const gitDir = new Directory(checkDir, '.git');
    
    if (gitDir.exists) {
      // Return the relative path to the repo root
      return '/' + checkPath;
    }
  }
  
  return null;
};

/**
 * Check if a path is inside a git repository
 */
export const isInGitRepo = async (relativePath: string): Promise<boolean> => {
  const repoRoot = await findGitRepoRoot(relativePath);
  return repoRoot !== null;
};

/**
 * Commit changes if the path is inside a git repository (commit only, no push)
 */
export const commitOnly = async (
  relativePath: string,
  message: string
): Promise<{ committed: boolean; repoPath?: string; error?: string }> => {
  try {
    const repoRoot = await findGitRepoRoot(relativePath);
    if (!repoRoot) {
      return { committed: false };
    }

    // Get credentials
    const username = await getGitHubUsername();
    const token = await getGitHubToken();
    
    if (!username || !token) {
      return { committed: false, error: 'No credentials' };
    }

    // Get the filesystem path for the repo
    const baseDir = getBaseDirectory();
    const repoParts = repoRoot.split('/').filter(Boolean);
    const repoDir = repoParts.length > 0 
      ? new Directory(baseDir, ...repoParts)
      : baseDir;
    const repoPath = repoDir.uri.replace('file://', '');

    // Use the native push function to stage and commit (it will try to push but we'll sync separately)
    const result = await LifeDBGit.push(repoPath, username, token, message);
    
    if (result.success) {
      return { committed: true, repoPath };
    } else {
      return { committed: false, repoPath, error: result.error };
    }
  } catch (error) {
    return { committed: false, error: String(error) };
  }
};

export type SyncResult = {
  success: boolean;
  message: string;
  reason?: 'success' | 'conflict' | 'no_network' | 'auth_failed' | 'unknown';
};

/**
 * Commit changes and sync with remote (fetch, rebase, push)
 * Returns detailed result with reason
 */
export const commitAndSync = async (
  relativePath: string,
  commitMessage: string
): Promise<SyncResult> => {
  try {
    const repoRoot = await findGitRepoRoot(relativePath);
    if (!repoRoot) {
      return { success: true, message: 'Not in a git repo', reason: 'success' };
    }

    // Get credentials
    const username = await getGitHubUsername();
    const token = await getGitHubToken();
    
    if (!username || !token) {
      return { success: false, message: 'Fail: auth failed', reason: 'auth_failed' };
    }

    // Get the filesystem path for the repo
    const baseDir = getBaseDirectory();
    const repoParts = repoRoot.split('/').filter(Boolean);
    const repoDir = repoParts.length > 0 
      ? new Directory(baseDir, ...repoParts)
      : baseDir;
    const repoPath = repoDir.uri.replace('file://', '');

    // Step 1: Commit local changes
    console.log('[Git] Committing:', commitMessage);
    const commitResult = await LifeDBGit.push(repoPath, username, token, commitMessage);
    console.log('[Git] Commit result:', commitResult);

    // Step 2: Pull (fetch + reset to remote)
    console.log('[Git] Pulling...');
    const pullResult = await LifeDBGit.pull(repoPath, username, token);
    
    if (!pullResult.success) {
      const error = pullResult.error || 'Pull failed';
      // Check for common error types
      if (error.toLowerCase().includes('network') || error.toLowerCase().includes('connect')) {
        return { success: false, message: 'Fail: no network', reason: 'no_network' };
      }
      if (error.toLowerCase().includes('conflict') || error.toLowerCase().includes('merge')) {
        return { success: false, message: 'Fail: conflict', reason: 'conflict' };
      }
      if (error.toLowerCase().includes('auth') || error.toLowerCase().includes('credential')) {
        return { success: false, message: 'Fail: auth failed', reason: 'auth_failed' };
      }
      return { success: false, message: `Fail: ${error}`, reason: 'unknown' };
    }

    // Step 3: Push (in case there are any remaining local commits)
    console.log('[Git] Pushing...');
    const pushResult = await LifeDBGit.push(repoPath, username, token, commitMessage);
    
    if (!pushResult.success) {
      const error = pushResult.error || 'Push failed';
      if (error.toLowerCase().includes('network') || error.toLowerCase().includes('connect')) {
        return { success: false, message: 'Fail: no network', reason: 'no_network' };
      }
      return { success: false, message: `Fail: ${error}`, reason: 'unknown' };
    }

    return { success: true, message: 'Success', reason: 'success' };
  } catch (error) {
    const errorStr = String(error);
    if (errorStr.toLowerCase().includes('network')) {
      return { success: false, message: 'Fail: no network', reason: 'no_network' };
    }
    return { success: false, message: `Fail: ${errorStr}`, reason: 'unknown' };
  }
};

// Keep the old function for backward compatibility
export const commitIfInRepo = commitOnly;


/**
 * Perform a sync operation (fetch, rebase, push) for a specific repo
 */
export const syncRepo = async (
  repoRelativePath: string,
  onLog?: (message: string, status: 'info' | 'success' | 'error') => void
): Promise<{ success: boolean; message: string }> => {
  try {
    const log = onLog || ((msg: string) => console.log('[Git Sync]', msg));
    
    // Find the repo root
    const repoRoot = await findGitRepoRoot(repoRelativePath);
    if (!repoRoot) {
      return { success: false, message: 'Not in a git repository' };
    }

    // Get credentials
    const username = await getGitHubUsername();
    const token = await getGitHubToken();
    
    if (!username || !token) {
      return { success: false, message: 'GitHub credentials not found' };
    }

    // Get the filesystem path for the repo
    const baseDir = getBaseDirectory();
    const repoParts = repoRoot.split('/').filter(Boolean);
    const repoDir = repoParts.length > 0 
      ? new Directory(baseDir, ...repoParts)
      : baseDir;
    const repoPath = repoDir.uri.replace('file://', '');

    log('Fetching and updating from remote...', 'info');

    // Pull (fetch + hard reset to remote)
    const pullResult = await LifeDBGit.pull(repoPath, username, token);
    
    if (pullResult.success) {
      log(`✓ ${pullResult.message || 'Updated from remote'}`, 'success');
    } else {
      log(`✗ Pull failed: ${pullResult.error}`, 'error');
      return { success: false, message: pullResult.error || 'Pull failed' };
    }

    // Push any local changes
    const pushResult = await LifeDBGit.push(
      repoPath,
      username,
      token,
      `Sync from LifeDB at ${new Date().toISOString()}`
    );

    if (pushResult.success) {
      if (pushResult.message !== 'Nothing to push') {
        log(`✓ Pushed local changes`, 'success');
      }
    } else {
      log(`✗ Push failed: ${pushResult.error}`, 'error');
      return { success: false, message: pushResult.error || 'Push failed' };
    }

    log('Sync completed successfully', 'success');
    return { success: true, message: 'Sync completed' };
  } catch (error) {
    console.error('[Git Sync] Error:', error);
    return { success: false, message: String(error) };
  }
};
