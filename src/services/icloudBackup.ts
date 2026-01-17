/**
 * iCloud Backup Service
 * 
 * Handles backup and restore of all app data to/from iCloud.
 * Note: Full iCloud integration requires native configuration.
 * This service provides local backup functionality that can be
 * extended with native iCloud support.
 */

import { Paths, File, Directory } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Backup directory (local for now, can be extended to iCloud with native config)
const getBackupDirectory = (): Directory => {
  return new Directory(Paths.cache, 'LifeDB-Backup');
};

// Local app data directory
const getLocalBaseDirectory = (): Directory => {
  return new Directory(Paths.document, 'lifedb');
};

const LAST_BACKUP_KEY = 'lifedb_last_backup_timestamp';
const ICLOUD_ENABLED_KEY = 'lifedb_icloud_enabled';

/**
 * Check if iCloud backup is available
 * Note: Returns true for local backup availability
 * Full iCloud requires native module configuration
 */
export const isICloudAvailable = (): boolean => {
  // Local backup is always available
  // For true iCloud, would need to check native iCloud container
  return true;
};

/**
 * Get last backup timestamp
 */
export const getLastBackupTime = async (): Promise<Date | null> => {
  const timestamp = await AsyncStorage.getItem(LAST_BACKUP_KEY);
  return timestamp ? new Date(parseInt(timestamp, 10)) : null;
};

/**
 * Recursively copy a directory
 */
const copyDirectoryRecursive = async (source: Directory, destination: Directory): Promise<void> => {
  // Create destination if it doesn't exist
  if (!destination.exists) {
    await destination.create();
  }

  // Get all items in source
  const items = await source.list();
  
  for (const item of items) {
    const itemName = item.name;
    
    if (item instanceof Directory) {
      // Recursively copy subdirectory
      const destSubdir = new Directory(destination, itemName);
      await copyDirectoryRecursive(item, destSubdir);
    } else if (item instanceof File) {
      // Copy file
      const destFile = new File(destination, itemName);
      try {
        const content = await item.text();
        await destFile.write(content);
      } catch (error) {
        // Skip files that can't be read as text (binary files)
        try {
          await item.copy(destFile);
        } catch (copyError) {
          console.warn(`Could not copy file: ${itemName}`, copyError);
        }
      }
    }
  }
};

/**
 * Backup all app data to iCloud
 */
export const backupToICloud = async (): Promise<{ success: boolean; error?: string }> => {
  const backupDir = getBackupDirectory();

  const localDir = getLocalBaseDirectory();
  if (!localDir.exists) {
    return { success: false, error: 'No local data to backup' };
  }

  try {
    // Create backup directory
    if (!backupDir.exists) {
      await backupDir.create();
    }

    // Create timestamped backup folder
    const timestamp = Date.now();
    const timestampedBackupDir = new Directory(backupDir, `backup-${timestamp}`);
    await timestampedBackupDir.create();

    // Copy all local data
    await copyDirectoryRecursive(localDir, timestampedBackupDir);

    // Update latest symlink/marker
    const latestFile = new File(backupDir, 'latest.txt');
    await latestFile.write(String(timestamp));

    // Store backup timestamp locally
    await AsyncStorage.setItem(LAST_BACKUP_KEY, String(timestamp));

    return { success: true };
  } catch (error) {
    console.error('Backup failed:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * List available backups in iCloud
 */
export const listBackups = async (): Promise<Array<{ name: string; timestamp: Date }>> => {
  const backupDir = getBackupDirectory();
  if (!backupDir.exists) {
    return [];
  }

  try {
    const items = await backupDir.list();
    const backups: Array<{ name: string; timestamp: Date }> = [];

    for (const item of items) {
      if (item instanceof Directory && item.name.startsWith('backup-')) {
        const timestampStr = item.name.replace('backup-', '');
        const timestamp = parseInt(timestampStr, 10);
        if (!isNaN(timestamp)) {
          backups.push({
            name: item.name,
            timestamp: new Date(timestamp),
          });
        }
      }
    }

    // Sort by timestamp, newest first
    backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return backups;
  } catch (error) {
    console.error('Failed to list backups:', error);
    return [];
  }
};

/**
 * Restore from an iCloud backup
 */
export const restoreFromICloud = async (backupName?: string): Promise<{ success: boolean; error?: string }> => {
  const backupDir = getBackupDirectory();
  if (!backupDir.exists) {
    return { success: false, error: 'No backups exist' };
  }

  try {
    let restoreDir: Directory;

    if (backupName) {
      // Use specified backup
      restoreDir = new Directory(backupDir, backupName);
    } else {
      // Find latest backup
      const latestFile = new File(backupDir, 'latest.txt');
      if (!latestFile.exists) {
        return { success: false, error: 'No backup found' };
      }
      const latestTimestamp = await latestFile.text();
      restoreDir = new Directory(backupDir, `backup-${latestTimestamp.trim()}`);
    }

    if (!restoreDir.exists) {
      return { success: false, error: 'Backup not found' };
    }

    // Get local directory
    const localDir = getLocalBaseDirectory();
    
    // Delete existing local data (be careful!)
    if (localDir.exists) {
      await localDir.delete();
    }

    // Copy backup to local
    await copyDirectoryRecursive(restoreDir, localDir);

    return { success: true };
  } catch (error) {
    console.error('Restore failed:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Delete a specific backup
 */
export const deleteBackup = async (backupName: string): Promise<boolean> => {
  const backupDir = getBackupDirectory();

  try {
    const targetDir = new Directory(backupDir, backupName);
    if (targetDir.exists) {
      await targetDir.delete();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to delete backup:', error);
    return false;
  }
};
