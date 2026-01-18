/**
 * Expo File System Wrapper for isomorphic-git
 * 
 * Provides a Node.js fs-compatible API using expo-file-system
 * for use with isomorphic-git in React Native.
 */

import * as FileSystem from 'expo-file-system';

// Get the document directory for git repos
const getBasePath = () => FileSystem.documentDirectory || '';

// Utility to join paths
const joinPath = (...parts: string[]) => {
  return parts.join('/').replace(/\/+/g, '/');
};

// Convert relative path to absolute
const toAbsolutePath = (filepath: string) => {
  if (filepath.startsWith('file://') || filepath.startsWith('/')) {
    return filepath;
  }
  return joinPath(getBasePath(), filepath);
};

export const fs = {
  promises: {
    async readFile(filepath: string, options?: { encoding?: string }): Promise<string | Uint8Array> {
      const absPath = toAbsolutePath(filepath);
      try {
        if (options?.encoding === 'utf8') {
          return await FileSystem.readAsStringAsync(absPath);
        }
        // Read as base64 and convert to Uint8Array
        const base64 = await FileSystem.readAsStringAsync(absPath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      } catch (error) {
        throw Object.assign(new Error(`ENOENT: no such file or directory, open '${filepath}'`), {
          code: 'ENOENT',
        });
      }
    },

    async writeFile(filepath: string, data: string | Uint8Array, options?: { encoding?: string; mode?: number }): Promise<void> {
      const absPath = toAbsolutePath(filepath);
      
      // Ensure parent directory exists
      const parentDir = absPath.substring(0, absPath.lastIndexOf('/'));
      await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true }).catch(() => {});
      
      if (typeof data === 'string') {
        await FileSystem.writeAsStringAsync(absPath, data);
      } else {
        // Convert Uint8Array to base64
        let binary = '';
        for (let i = 0; i < data.length; i++) {
          binary += String.fromCharCode(data[i]);
        }
        const base64 = btoa(binary);
        await FileSystem.writeAsStringAsync(absPath, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    },

    async unlink(filepath: string): Promise<void> {
      const absPath = toAbsolutePath(filepath);
      await FileSystem.deleteAsync(absPath, { idempotent: true });
    },

    async readdir(dirpath: string): Promise<string[]> {
      const absPath = toAbsolutePath(dirpath);
      try {
        return await FileSystem.readDirectoryAsync(absPath);
      } catch {
        throw Object.assign(new Error(`ENOENT: no such file or directory, scandir '${dirpath}'`), {
          code: 'ENOENT',
        });
      }
    },

    async mkdir(dirpath: string, options?: { recursive?: boolean }): Promise<void> {
      const absPath = toAbsolutePath(dirpath);
      await FileSystem.makeDirectoryAsync(absPath, { 
        intermediates: options?.recursive ?? false 
      }).catch(() => {});
    },

    async rmdir(dirpath: string): Promise<void> {
      const absPath = toAbsolutePath(dirpath);
      await FileSystem.deleteAsync(absPath, { idempotent: true });
    },

    async stat(filepath: string): Promise<{ type: 'file' | 'dir'; mode: number; size: number; mtimeMs: number; isFile: () => boolean; isDirectory: () => boolean; isSymbolicLink: () => boolean }> {
      const absPath = toAbsolutePath(filepath);
      try {
        const info = await FileSystem.getInfoAsync(absPath);
        if (!info.exists) {
          throw Object.assign(new Error(`ENOENT: no such file or directory, stat '${filepath}'`), {
            code: 'ENOENT',
          });
        }
        const isDir = info.isDirectory ?? false;
        return {
          type: isDir ? 'dir' : 'file',
          mode: 0o644,
          size: info.size ?? 0,
          mtimeMs: info.modificationTime ? info.modificationTime * 1000 : Date.now(),
          isFile: () => !isDir,
          isDirectory: () => isDir,
          isSymbolicLink: () => false,
        };
      } catch (error: any) {
        if (error.code === 'ENOENT') throw error;
        throw Object.assign(new Error(`ENOENT: no such file or directory, stat '${filepath}'`), {
          code: 'ENOENT',
        });
      }
    },

    async lstat(filepath: string) {
      return this.stat(filepath);
    },

    async readlink(filepath: string): Promise<string> {
      // Symlinks not supported - just return the path
      return filepath;
    },

    async symlink(target: string, filepath: string): Promise<void> {
      // Symlinks not supported - copy file instead
      const absTarget = toAbsolutePath(target);
      const absPath = toAbsolutePath(filepath);
      await FileSystem.copyAsync({ from: absTarget, to: absPath });
    },

    async chmod(_filepath: string, _mode: number): Promise<void> {
      // No-op: permissions not fully supported
    },

    async rm(filepath: string, options?: { recursive?: boolean }): Promise<void> {
      const absPath = toAbsolutePath(filepath);
      await FileSystem.deleteAsync(absPath, { idempotent: true });
    },

    async rename(oldPath: string, newPath: string): Promise<void> {
      const absOld = toAbsolutePath(oldPath);
      const absNew = toAbsolutePath(newPath);
      await FileSystem.moveAsync({ from: absOld, to: absNew });
    },
  },
};

export default fs;
