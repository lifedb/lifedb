/**
 * CRDT Sync Service
 * 
 * Manages Yjs documents for conflict-free collaborative editing.
 * Each file has its own Y.Doc that tracks text changes.
 */

import * as Y from 'yjs';
import { Paths, File, Directory } from 'expo-file-system';

// Store Y.Doc instances keyed by file path
const documents = new Map<string, Y.Doc>();

// Directory for storing CRDT state
const getCrdtDirectory = (): Directory => {
  const baseDir = new Directory(Paths.document, 'lifedb');
  return new Directory(baseDir, '.crdt');
};

/**
 * Initialize the CRDT storage directory
 */
export const initCrdtStorage = async (): Promise<void> => {
  const crdtDir = getCrdtDirectory();
  if (!crdtDir.exists) {
    await crdtDir.create();
  }
};

/**
 * Get the CRDT state file for a given document path
 */
const getCrdtStateFile = (filePath: string): File => {
  // Convert file path to a safe filename
  const safeName = filePath
    .replace(/\//g, '_')
    .replace(/\./g, '_') + '.crdt';
  return new File(getCrdtDirectory(), safeName);
};

/**
 * Get or create a Y.Doc for a file
 */
export const getDocument = async (filePath: string): Promise<Y.Doc> => {
  // Return cached document if exists
  if (documents.has(filePath)) {
    return documents.get(filePath)!;
  }

  // Create new document
  const doc = new Y.Doc();
  documents.set(filePath, doc);

  // Try to load existing CRDT state
  const stateFile = getCrdtStateFile(filePath);
  try {
    if (stateFile.exists) {
      const base64State = await stateFile.text();
      const binaryState = Uint8Array.from(atob(base64State), c => c.charCodeAt(0));
      Y.applyUpdate(doc, binaryState);
    }
  } catch (error) {
    console.log('No existing CRDT state for:', filePath);
  }

  return doc;
};

/**
 * Get the Y.Text instance for a document
 */
export const getText = (doc: Y.Doc): Y.Text => {
  return doc.getText('content');
};

/**
 * Initialize a document with plain text content
 * Only used when creating a new file or when CRDT state doesn't exist
 */
export const initializeWithContent = (doc: Y.Doc, content: string): void => {
  const text = getText(doc);
  if (text.length === 0 && content.length > 0) {
    text.insert(0, content);
  }
};

/**
 * Save CRDT state to disk
 */
export const saveState = async (filePath: string): Promise<void> => {
  const doc = documents.get(filePath);
  if (!doc) return;

  const state = Y.encodeStateAsUpdate(doc);
  const base64State = btoa(String.fromCharCode(...state));
  const stateFile = getCrdtStateFile(filePath);
  
  await stateFile.write(base64State);
};

/**
 * Get plain text content from a document
 */
export const getContent = (doc: Y.Doc): string => {
  return getText(doc).toString();
};

/**
 * Apply a remote update to a document
 */
export const applyRemoteUpdate = (filePath: string, update: Uint8Array): void => {
  const doc = documents.get(filePath);
  if (doc) {
    Y.applyUpdate(doc, update);
  }
};

/**
 * Subscribe to document changes
 */
export const onDocumentChange = (
  doc: Y.Doc,
  callback: (update: Uint8Array, origin: unknown) => void
): (() => void) => {
  doc.on('update', callback);
  return () => doc.off('update', callback);
};

/**
 * Clean up a document (remove from cache)
 */
export const releaseDocument = (filePath: string): void => {
  const doc = documents.get(filePath);
  if (doc) {
    doc.destroy();
    documents.delete(filePath);
  }
};

/**
 * Delete CRDT state for a file
 */
export const deleteCrdtState = async (filePath: string): Promise<void> => {
  releaseDocument(filePath);
  const stateFile = getCrdtStateFile(filePath);
  try {
    if (stateFile.exists) {
      await stateFile.delete();
    }
  } catch (error) {
    // Ignore errors if file doesn't exist
  }
};
