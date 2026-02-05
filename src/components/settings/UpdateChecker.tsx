import { useUpdater } from '../../hooks/useUpdater';

export function UpdateChecker() {
  const {
    checking,
    available,
    downloading,
    progress,
    error,
    update,
    checkForUpdates,
    downloadAndInstall,
  } = useUpdater();

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={() => checkForUpdates()}
          className="mt-2 text-xs text-red-400 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (downloading) {
    return (
      <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
        <p className="text-sm font-medium text-foreground mb-2">
          Downloading update...
        </p>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.min(progress / 10000, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {Math.round(progress / 1024)} KB downloaded
        </p>
      </div>
    );
  }

  if (available && update) {
    return (
      <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
        <p className="text-sm font-medium text-foreground">
          Update available: v{update.version}
        </p>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          {update.body || 'New version available'}
        </p>
        <button
          onClick={downloadAndInstall}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Download & Install
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-foreground">Check for Updates</p>
        <p className="text-sm text-muted-foreground">
          {checking ? 'Checking...' : 'You\'re on the latest version'}
        </p>
      </div>
      <button
        onClick={() => checkForUpdates()}
        disabled={checking}
        className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
      >
        {checking ? 'Checking...' : 'Check Now'}
      </button>
    </div>
  );
}
