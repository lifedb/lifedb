/**
 * GitHub Service
 * 
 * Handles OAuth authentication and GitHub API operations.
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { Octokit } from '@octokit/rest';
import Constants from 'expo-constants';

// Ensure browser is ready for OAuth
WebBrowser.maybeCompleteAuthSession();

// GitHub OAuth configuration from environment variables
const GITHUB_CLIENT_ID = Constants.expoConfig?.extra?.githubClientId || '';
const GITHUB_CLIENT_SECRET = Constants.expoConfig?.extra?.githubClientSecret || '';

const discovery = {
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  revocationEndpoint: `https://github.com/settings/connections/applications/${GITHUB_CLIENT_ID}`,
};

const SECURE_STORE_KEY = 'github_access_token';
const GITHUB_USER_KEY = 'github_username';

let octokitInstance: Octokit | null = null;

// Base64 helpers for React Native (no Buffer available)
const base64Decode = (str: string): string => {
  try {
    return decodeURIComponent(
      atob(str)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return atob(str);
  }
};

const base64Encode = (str: string): string => {
  try {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );
  } catch {
    return btoa(str);
  }
};

/**
 * Get the OAuth redirect URI
 * Uses Expo proxy for development (matches GitHub OAuth App callback URL)
 */
export const getRedirectUri = (): string => {
  return AuthSession.makeRedirectUri({
    scheme: 'lifedb',
    path: 'github-oauth',
    // Use Expo proxy for Expo Go development
    preferLocalhost: false,
  });
};

/**
 * Check if user is authenticated with GitHub
 */
export const isGitHubAuthenticated = async (): Promise<boolean> => {
  const token = await SecureStore.getItemAsync(SECURE_STORE_KEY);
  return !!token;
};

/**
 * Get stored GitHub username
 */
export const getGitHubUsername = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(GITHUB_USER_KEY);
};

/**
 * Get or create Octokit instance
 */
const getOctokit = async (): Promise<Octokit | null> => {
  if (octokitInstance) return octokitInstance;
  
  const token = await SecureStore.getItemAsync(SECURE_STORE_KEY);
  if (!token) return null;
  
  octokitInstance = new Octokit({ auth: token });
  return octokitInstance;
};

/**
 * Start GitHub OAuth flow
 */
export const loginWithGitHub = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const redirectUri = getRedirectUri();
    console.log('OAuth redirect URI:', redirectUri);
    
    const request = new AuthSession.AuthRequest({
      clientId: GITHUB_CLIENT_ID,
      scopes: ['repo', 'user'],
      redirectUri,
      usePKCE: false, // GitHub OAuth Apps don't support PKCE
    });

    // Use useProxy for Expo Go development
    const result = await request.promptAsync(discovery);

    if (result.type === 'success' && result.params.code) {
      // Exchange code for token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code: result.params.code,
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json();
      
      if (tokenData.access_token) {
        await SecureStore.setItemAsync(SECURE_STORE_KEY, tokenData.access_token);
        
        // Create Octokit and get user info
        octokitInstance = new Octokit({ auth: tokenData.access_token });
        const { data: user } = await octokitInstance.users.getAuthenticated();
        await SecureStore.setItemAsync(GITHUB_USER_KEY, user.login);
        
        return { success: true };
      } else {
        return { success: false, error: tokenData.error_description || 'Failed to get access token' };
      }
    } else if (result.type === 'cancel') {
      return { success: false, error: 'Login cancelled' };
    } else {
      return { success: false, error: 'Login failed' };
    }
  } catch (error) {
    console.error('GitHub login error:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Logout from GitHub
 */
export const logoutFromGitHub = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
  await SecureStore.deleteItemAsync(GITHUB_USER_KEY);
  octokitInstance = null;
};

/**
 * List user's repositories
 */
export const listRepositories = async (): Promise<Array<{ name: string; fullName: string; private: boolean }>> => {
  const octokit = await getOctokit();
  if (!octokit) return [];

  try {
    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
    });

    return data.map(repo => ({
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
    }));
  } catch (error) {
    console.error('Failed to list repositories:', error);
    return [];
  }
};

/**
 * Get file content from a repository
 */
export const getFileContent = async (
  owner: string,
  repo: string,
  path: string
): Promise<{ content: string; sha: string } | null> => {
  const octokit = await getOctokit();
  if (!octokit) return null;

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    if ('content' in data && data.type === 'file') {
      const content = base64Decode(data.content.replace(/\n/g, ''));
      return { content, sha: data.sha };
    }
    return null;
  } catch (error) {
    console.error('Failed to get file content:', error);
    return null;
  }
};

/**
 * Create or update a file in a repository
 */
export const updateFile = async (
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<boolean> => {
  const octokit = await getOctokit();
  if (!octokit) return false;

  try {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: base64Encode(content),
      sha,
    });
    return true;
  } catch (error) {
    console.error('Failed to update file:', error);
    return false;
  }
};

/**
 * List files in a directory of a repository
 */
export const listRepoFiles = async (
  owner: string,
  repo: string,
  path: string = ''
): Promise<Array<{ name: string; path: string; type: 'file' | 'dir' }>> => {
  const octokit = await getOctokit();
  if (!octokit) return [];

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    if (Array.isArray(data)) {
      return data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type as 'file' | 'dir',
      }));
    }
    return [];
  } catch (error) {
    console.error('Failed to list repo files:', error);
    return [];
  }
};
