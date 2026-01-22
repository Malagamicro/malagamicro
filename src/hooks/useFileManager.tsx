import { useState, useEffect, useCallback } from "react";

export interface SavedFile {
  id: string;
  name: string;
  folder: string;
  content: string;
  createdAt: string;
  itemCount: number;
}

export interface SavedFolder {
  id: string;
  name: string;
  createdAt: string;
}

const FILES_STORAGE_KEY = "crm_saved_files";
const FOLDERS_STORAGE_KEY = "crm_saved_folders";

export function useFileManager() {
  const [files, setFiles] = useState<SavedFile[]>([]);
  const [folders, setFolders] = useState<SavedFolder[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedFiles = localStorage.getItem(FILES_STORAGE_KEY);
    if (savedFiles) {
      try {
        setFiles(JSON.parse(savedFiles));
      } catch {
        setFiles([]);
      }
    }

    const savedFolders = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (savedFolders) {
      try {
        setFolders(JSON.parse(savedFolders));
      } catch {
        setFolders([]);
      }
    }
  }, []);

  // Save files to localStorage
  const saveFiles = useCallback((newFiles: SavedFile[]) => {
    setFiles(newFiles);
    localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(newFiles));
  }, []);

  // Save folders to localStorage
  const saveFolders = useCallback((newFolders: SavedFolder[]) => {
    setFolders(newFolders);
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(newFolders));
  }, []);

  // Add a new file
  const addFile = useCallback((file: Omit<SavedFile, "id" | "createdAt">) => {
    const newFile: SavedFile = {
      ...file,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...files, newFile];
    saveFiles(updated);
    return newFile;
  }, [files, saveFiles]);

  // Delete a file
  const deleteFile = useCallback((fileId: string) => {
    const updated = files.filter((f) => f.id !== fileId);
    saveFiles(updated);
  }, [files, saveFiles]);

  // Add a new folder
  const addFolder = useCallback((name: string) => {
    if (folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      return null; // Folder already exists
    }
    const newFolder: SavedFolder = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    };
    const updated = [...folders, newFolder];
    saveFolders(updated);
    return newFolder;
  }, [folders, saveFolders]);

  // Delete a folder (and optionally its files)
  const deleteFolder = useCallback((folderId: string, deleteFiles = false) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    const updatedFolders = folders.filter((f) => f.id !== folderId);
    saveFolders(updatedFolders);

    if (deleteFiles) {
      const updatedFiles = files.filter((f) => f.folder !== folder.name);
      saveFiles(updatedFiles);
    }
  }, [folders, files, saveFolders, saveFiles]);

  // Get files by folder
  const getFilesByFolder = useCallback((folderName: string | null) => {
    if (folderName === null) {
      return files;
    }
    return files.filter((f) => f.folder === folderName);
  }, [files]);

  return {
    files,
    folders,
    addFile,
    deleteFile,
    addFolder,
    deleteFolder,
    getFilesByFolder,
  };
}
