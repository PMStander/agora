import { useState, useEffect, useCallback } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

interface UpdateState {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
  update: Update | null;
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({
    checking: false,
    available: false,
    downloading: false,
    progress: 0,
    error: null,
    update: null,
  });

  const checkForUpdates = useCallback(async () => {
    setState(s => ({ ...s, checking: true, error: null }));
    
    try {
      const update = await check();
      
      if (update) {
        setState(s => ({
          ...s,
          checking: false,
          available: true,
          update,
        }));
        return true;
      } else {
        setState(s => ({ ...s, checking: false, available: false }));
        return false;
      }
    } catch (err) {
      setState(s => ({
        ...s,
        checking: false,
        error: err instanceof Error ? err.message : 'Failed to check for updates',
      }));
      return false;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!state.update) return;
    
    setState(s => ({ ...s, downloading: true, progress: 0 }));
    
    try {
      // Download with progress
      await state.update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          console.log('[Updater] Download started, size:', event.data.contentLength);
        } else if (event.event === 'Progress') {
          const progress = event.data.chunkLength;
          setState(s => ({ ...s, progress: s.progress + progress }));
        } else if (event.event === 'Finished') {
          console.log('[Updater] Download finished');
        }
      });
      
      // Relaunch the app
      await relaunch();
    } catch (err) {
      setState(s => ({
        ...s,
        downloading: false,
        error: err instanceof Error ? err.message : 'Failed to install update',
      }));
    }
  }, [state.update]);

  // Check for updates on mount (with delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates().catch(console.error);
    }, 5000); // Wait 5 seconds after app start
    
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    ...state,
    checkForUpdates,
    downloadAndInstall,
  };
}
