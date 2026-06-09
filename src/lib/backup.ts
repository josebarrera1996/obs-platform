// ── Backup Utility ──
// Creates automatic backups of critical data files (credentials.json).
// Backups are stored in .data/backups/ with timestamped filenames.

import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const MAX_BACKUPS = 30; // Keep last 30 backups

// Files to back up (relative to DATA_DIR)
const BACKUP_TARGETS = ["credentials.json"];

/**
 * Create a timestamped backup of all target files.
 * Returns the backup path or null if no files existed.
 */
export async function createBackup(): Promise<string | null> {
  await ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);

  let hasFiles = false;

  for (const filename of BACKUP_TARGETS) {
    const sourcePath = path.join(DATA_DIR, filename);
    try {
      await fs.access(sourcePath);
      const content = await fs.readFile(sourcePath, "utf-8");
      const destPath = path.join(backupPath, filename);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, content, "utf-8");
      hasFiles = true;
    } catch {
      // File doesn't exist yet — skip silently
    }
  }

  if (!hasFiles) {
    // Remove empty backup directory
    await fs.rm(backupPath, { recursive: true, force: true }).catch(() => {});
    return null;
  }

  // Rotate old backups
  await rotateBackups();

  return backupPath;
}

/**
 * List all available backups sorted by date (newest first).
 */
export async function listBackups(): Promise<
  { path: string; date: string; size: number }[]
> {
  try {
    await fs.access(BACKUP_DIR);
  } catch {
    return [];
  }

  const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
  const backups = await Promise.all(
    entries
      .filter((e) => e.isDirectory())
      .map(async (dir) => {
        const fullPath = path.join(BACKUP_DIR, dir.name);
        let size = 0;
        try {
          const files = await fs.readdir(fullPath);
          for (const file of files) {
            const stat = await fs.stat(path.join(fullPath, file));
            size += stat.size;
          }
        } catch {
          // ignore
        }
        return {
          path: fullPath,
          date: dir.name.replace("backup-", "").replace(/-/g, ":").replace(/T/, " ").replace(/.\d+Z/, ""),
          size,
        };
      })
  );

  return backups.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Restore from a specific backup directory.
 */
export async function restoreBackup(backupPath: string): Promise<boolean> {
  try {
    await fs.access(backupPath);
  } catch {
    return false;
  }

  const files = await fs.readdir(backupPath);
  for (const file of files) {
    const content = await fs.readFile(path.join(backupPath, file), "utf-8");
    await fs.writeFile(path.join(DATA_DIR, file), content, "utf-8");
  }

  return true;
}

// ── Internal helpers ──

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

async function rotateBackups() {
  try {
    const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => ({ name: e.name, path: path.join(BACKUP_DIR, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name)); // oldest first

    // Remove oldest if over limit
    const toRemove = dirs.length - MAX_BACKUPS;
    for (let i = 0; i < toRemove; i++) {
      await fs.rm(dirs[i].path, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
}