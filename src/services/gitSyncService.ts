/**
 * Git Sync Service
 * 
 * Provides unified sync operations using the native LifeDBGit module.
 * Handles fetch, merge, push with logging and conflict rollback.
 */

import LifeDBGit from 'lifedb-git';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Paths, Directory } from 'expo-file-system';
import { getGitHubToken, getGitHubUsername } from './githubService';

export interface SyncLog {
  timestamp: Date;
  operation: 'fetch' | 'merge' | 'push' | 'error' | 'info';
  message: string;
  success?: boolean;
}

export interface SyncResult {
  success: boolean;
  logs: SyncLog[];
  error?: string;
}

// Key matching what GitHubSyncScreen uses
const SELECTED_REPO_KEY = 'github_selected_repo';

async function getSelectedRepo(): Promise<string | null> {
  return AsyncStorage.getItem(SELECTED_REPO_KEY);
}

function getRepoPath(repoName: string): string {
  // Create a Directory for repos using the same pattern as fileSystem.ts
  const reposDir = new Directory(Paths.document, 'repos', repoName);
  // Get the URI and convert to a path for native Git module
  let path = reposDir.uri;
  // Remove file:// prefix if present
  if (path.startsWith('file://')) {
    path = path.replace('file://', '');
  }
  // Ensure trailing slash
  if (!path.endsWith('/')) {
    path = path + '/';
  }
  console.log(`[getRepoPath] uri: ${reposDir.uri}, path: ${path}`);
  return path;
}



/**
 * Perform a full git sync: fetch → merge → push
 * Returns logs of all operations
 */
export async function performSync(): Promise<SyncResult> {
  console.log('[performSync] Starting...');
  const logs: SyncLog[] = [];
  const addLog = (operation: SyncLog['operation'], message: string, success?: boolean) => {
    console.log(`[performSync] ${operation}: ${message} (${success})`);
    logs.push({ timestamp: new Date(), operation, message, success });
  };

  try {
    // Check prerequisites
    const token = await getGitHubToken();
    const username = await getGitHubUsername();
    const selectedRepo = await getSelectedRepo();

    console.log(`[performSync] token: ${!!token}, username: ${username}, selectedRepo: ${selectedRepo}`);

    if (!token || !username) {
      addLog('error', 'Not authenticated with GitHub', false);
      return { success: false, logs, error: 'Not authenticated with GitHub' };
    }

    if (!selectedRepo) {
      addLog('error', 'No repository selected', false);
      return { success: false, logs, error: 'No repository selected' };
    }

    const repoName = selectedRepo.split('/').pop() || 'lifedb';
    const repoPath = getRepoPath(repoName);
    console.log(`[performSync] repoPath: ${repoPath}`);

    // Check if repo exists
    const isRepo = await LifeDBGit.isRepository(repoPath);
    console.log(`[performSync] isRepository: ${isRepo}`);
    
    if (!isRepo) {
      addLog('info', `Repository not cloned. Cloning ${selectedRepo}...`);
      const cloneResult = await LifeDBGit.clone(
        `https://github.com/${selectedRepo}`,
        repoPath,
        username,
        token
      );
      if (!cloneResult.success) {
        addLog('error', `Clone failed: ${cloneResult.error}`, false);
        return { success: false, logs, error: cloneResult.error };
      }
      addLog('info', 'Repository cloned successfully', true);
      return { success: true, logs };
    }

    // Step 1: Pull (fetch + reset to remote)
    addLog('fetch', 'Fetching and updating from remote...');
    const pullResult = await LifeDBGit.pull(repoPath, username, token);
    console.log(`[performSync] pullResult: ${JSON.stringify(pullResult)}`);
    
    if (!pullResult.success) {
      addLog('error', `Pull failed: ${pullResult.error}`, false);
      return { success: false, logs, error: pullResult.error };
    }
    addLog('merge', pullResult.message || 'Pull complete', true);

    // Step 2: Push local changes (only if there are any)
    const pushResult = await LifeDBGit.push(
      repoPath,
      username,
      token,
      `Sync from LifeDB at ${new Date().toISOString()}`
    );
    console.log(`[performSync] pushResult: ${JSON.stringify(pushResult)}`);

    if (!pushResult.success) {
      addLog('error', `Push failed: ${pushResult.error}`, false);
      return { success: false, logs, error: pushResult.error };
    }
    
    // Only show push message if we actually pushed something
    if (pushResult.message !== 'Nothing to push') {
      addLog('push', pushResult.message || 'Pushed successfully', true);
    }

    addLog('info', 'Sync completed successfully', true);
    return { success: true, logs };

  } catch (error: any) {
    console.log(`[performSync] Error: ${error.message}`);
    addLog('error', `Unexpected error: ${error.message}`, false);
    return { success: false, logs, error: error.message };
  }
}

/**
 * Check if git sync is configured (has token, username, and selected repo)
 */
export async function isSyncConfigured(): Promise<boolean> {
  try {
    const token = await getGitHubToken();
    const username = await getGitHubUsername();
    const selectedRepo = await getSelectedRepo();
    const result = !!(token && username && selectedRepo);
    console.log(`[isSyncConfigured] token: ${!!token}, username: ${!!username}, selectedRepo: ${!!selectedRepo}, result: ${result}`);
    return result;
  } catch (error) {
    console.log(`[isSyncConfigured] Error: ${error}`);
    return false;
  }
}

/**
 * Get the currently selected repository
 */
export async function getSelectedRepoName(): Promise<string | null> {
  return getSelectedRepo();
}
