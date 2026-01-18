/**
 * Native Git Service using isomorphic-git
 * 
 * Provides clone, pull, push operations using isomorphic-git
 * with expo-file-system as the underlying storage.
 */

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import * as FileSystem from 'expo-file-system';
import { fs } from './expoFsWrapper';
import { getGitHubToken, getGitHubUsername } from './githubService';

// Base directory for git repositories
const getReposDir = () => `${FileSystem.documentDirectory}repos/`;

interface GitResult {
  success: boolean;
  message?: string;
  error?: string;
}

interface CloneResult extends GitResult {}

interface PullResult extends GitResult {
  filesUpdated?: number;
}

interface PushResult extends GitResult {
  commitOid?: string;
}

export type ProgressCallback = (phase: string, loaded: number, total: number) => void;

/**
 * Get the local path for a repository
 */
export const getRepoPath = (owner: string, repo: string): string => {
  return `${getReposDir()}${owner}/${repo}`;
};

/**
 * Check if a repository is already cloned
 */
export const isCloned = async (owner: string, repo: string): Promise<boolean> => {
  const repoPath = getRepoPath(owner, repo);
  const gitDir = `${repoPath}/.git`;
  try {
    const info = await FileSystem.getInfoAsync(gitDir);
    return info.exists && info.isDirectory;
  } catch {
    return false;
  }
};

/**
 * Clone a repository
 */
export const cloneRepo = async (
  owner: string,
  repo: string,
  onProgress?: ProgressCallback
): Promise<CloneResult> => {
  const token = await getGitHubToken();
  const username = await getGitHubUsername();
  
  if (!token || !username) {
    return { success: false, error: 'Not authenticated with GitHub' };
  }

  const repoPath = getRepoPath(owner, repo);
  const url = `https://github.com/${owner}/${repo}`;

  try {
    // Ensure directory exists
    await FileSystem.makeDirectoryAsync(repoPath, { intermediates: true }).catch(() => {});

    await git.clone({
      fs,
      http,
      dir: repoPath,
      url,
      singleBranch: true,
      depth: 1,
      onAuth: () => ({ username: 'x-access-token', password: token }),
      onProgress: onProgress ? (event) => {
        onProgress(event.phase, event.loaded, event.total || 0);
      } : undefined,
    });

    return { success: true, message: 'Repository cloned successfully' };
  } catch (error: any) {
    console.error('Clone error:', error);
    return { success: false, error: error.message || 'Clone failed' };
  }
};

/**
 * Pull latest changes from remote
 */
export const pullRepo = async (
  owner: string,
  repo: string,
  onProgress?: ProgressCallback
): Promise<PullResult> => {
  const token = await getGitHubToken();
  
  if (!token) {
    return { success: false, error: 'Not authenticated with GitHub' };
  }

  const repoPath = getRepoPath(owner, repo);

  try {
    // Check if repo exists
    if (!await isCloned(owner, repo)) {
      return { success: false, error: 'Repository not cloned' };
    }

    await git.pull({
      fs,
      http,
      dir: repoPath,
      author: {
        name: 'LifeDB',
        email: 'lifedb@users.noreply.github.com',
      },
      onAuth: () => ({ username: 'x-access-token', password: token }),
      onProgress: onProgress ? (event) => {
        onProgress(event.phase, event.loaded, event.total || 0);
      } : undefined,
    });

    return { success: true, message: 'Pulled successfully' };
  } catch (error: any) {
    console.error('Pull error:', error);
    return { success: false, error: error.message || 'Pull failed' };
  }
};

/**
 * Push changes to remote
 */
export const pushRepo = async (
  owner: string,
  repo: string,
  commitMessage: string = 'Update from LifeDB',
  onProgress?: ProgressCallback
): Promise<PushResult> => {
  const token = await getGitHubToken();
  const username = await getGitHubUsername();
  
  if (!token || !username) {
    return { success: false, error: 'Not authenticated with GitHub' };
  }

  const repoPath = getRepoPath(owner, repo);

  try {
    // Check if repo exists
    if (!await isCloned(owner, repo)) {
      return { success: false, error: 'Repository not cloned' };
    }

    // Stage all changes
    await git.add({
      fs,
      dir: repoPath,
      filepath: '.',
    });

    // Check for changes
    const status = await git.statusMatrix({ fs, dir: repoPath });
    const hasChanges = status.some(([_, head, workdir, stage]) => head !== workdir || head !== stage);
    
    if (!hasChanges) {
      return { success: true, message: 'No changes to commit' };
    }

    // Commit
    const sha = await git.commit({
      fs,
      dir: repoPath,
      message: commitMessage,
      author: {
        name: username,
        email: `${username}@users.noreply.github.com`,
      },
    });

    // Push
    await git.push({
      fs,
      http,
      dir: repoPath,
      onAuth: () => ({ username: 'x-access-token', password: token }),
      onProgress: onProgress ? (event) => {
        onProgress(event.phase, event.loaded, event.total || 0);
      } : undefined,
    });

    return { success: true, message: 'Pushed successfully', commitOid: sha };
  } catch (error: any) {
    console.error('Push error:', error);
    return { success: false, error: error.message || 'Push failed' };
  }
};

/**
 * Sync repository (pull then push)
 */
export const syncRepo = async (
  owner: string,
  repo: string,
  onProgress?: ProgressCallback
): Promise<GitResult> => {
  // First check if cloned
  if (!await isCloned(owner, repo)) {
    // Clone first
    const cloneResult = await cloneRepo(owner, repo, onProgress);
    if (!cloneResult.success) {
      return cloneResult;
    }
    return { success: true, message: 'Repository cloned successfully' };
  }

  // Pull first
  const pullResult = await pullRepo(owner, repo, onProgress);
  if (!pullResult.success) {
    return pullResult;
  }

  // Then push
  const pushResult = await pushRepo(owner, repo, 'Sync from LifeDB', onProgress);
  if (!pushResult.success) {
    return pushResult;
  }

  return { success: true, message: 'Synced successfully' };
};

/**
 * Get list of files in the repo
 */
export const listRepoFiles = async (
  owner: string,
  repo: string,
  path: string = ''
): Promise<string[]> => {
  const repoPath = getRepoPath(owner, repo);
  const targetPath = path ? `${repoPath}/${path}` : repoPath;

  try {
    const files = await FileSystem.readDirectoryAsync(targetPath);
    return files.filter(f => !f.startsWith('.git'));
  } catch {
    return [];
  }
};
