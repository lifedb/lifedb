/**
 * GitHub Issue Service
 * 
 * Creates issues on the lifedb/lifedb repository.
 */

import { getGitHubToken } from './githubService';
import { Octokit } from '@octokit/rest';

const REPO_OWNER = 'lifedb';
const REPO_NAME = 'lifedb';

/**
 * Create an issue on the lifedb/lifedb repository
 */
export const createIssue = async (
  title: string,
  body: string
): Promise<{ success: boolean; issueUrl?: string; error?: string }> => {
  try {
    const token = await getGitHubToken();
    
    if (!token) {
      return { success: false, error: 'Not authenticated with GitHub' };
    }

    const octokit = new Octokit({ auth: token });

    const { data } = await octokit.issues.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title,
      body,
    });

    return { success: true, issueUrl: data.html_url };
  } catch (error) {
    console.error('Failed to create issue:', error);
    return { success: false, error: String(error) };
  }
};
