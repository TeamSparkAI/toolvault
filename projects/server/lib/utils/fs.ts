import * as fs from 'fs/promises';

export async function directoryExists(dirPath: string): Promise<boolean> {
    try {
        const stats = await fs.stat(dirPath);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

export async function fileExists(filePath: string): Promise<boolean> {
    try {
        const stats = await fs.stat(filePath);
        return stats.isFile();
    } catch {
        return false;
    }
}

export enum PathType {
    File,
    Directory
}

export async function pathExists(path: string): Promise<PathType | null> {
    try {
        const stats = await fs.stat(path);
        return stats.isFile() ? PathType.File : stats.isDirectory() ? PathType.Directory : null;
    } catch {
        return null;
    }
}