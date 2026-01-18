import { NativeModule, requireNativeModule } from 'expo';

import { LifeDBGitModuleEvents } from './LifeDBGit.types';

export interface GitResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface CloneResult extends GitResult {}

export interface PullResult extends GitResult {
  filesUpdated?: number;
}

export interface PushResult extends GitResult {
  commitOid?: string;
}

export interface StatusResult extends GitResult {
  modified?: string[];
  added?: string[];
  deleted?: string[];
  total?: number;
}

declare class LifeDBGitModule extends NativeModule<LifeDBGitModuleEvents> {
  isAvailable(): boolean;
  clone(repoUrl: string, localPath: string, username: string, token: string): Promise<CloneResult>;
  pull(localPath: string, username: string, token: string): Promise<PullResult>;
  push(localPath: string, username: string, token: string, commitMessage: string): Promise<PushResult>;
  isRepository(localPath: string): Promise<boolean>;
  status(localPath: string): Promise<StatusResult>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<LifeDBGitModule>('LifeDBGit');
