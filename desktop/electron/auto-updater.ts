import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow } from 'electron';

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    mainWindow.webContents.send('update:available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    mainWindow.webContents.send('update:downloaded', {
      version: info.version,
    });
  });

  autoUpdater.on('error', (err: Error) => {
    mainWindow.webContents.send('update:error', err.message);
  });

  // Check for updates on launch (non-blocking)
  autoUpdater.checkForUpdates().catch(() => {
    // Silently ignore update check failures
  });
}

export function downloadUpdate(): void {
  autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall();
}
