import { useState, useCallback } from 'react';
import type { AgentFull } from '../../../types/supabase';
import { useAgentWorkspace, type FileEntry, type SessionEntry, type SessionLogMessage } from '../../../hooks/useAgentWorkspace';

interface Props {
  agent: AgentFull;
}

export default function AgentWsFiles({ agent }: Props) {
  const {
    workspaceFiles,
    sessions,
    cronJobs,
    loading,
    readFile,
    readSessionLog,
    workspacePath,
  } = useAgentWorkspace(agent.id);

  const [activeSection, setActiveSection] = useState<'files' | 'sessions' | 'cron'>('files');
  const [viewingFile, setViewingFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [viewingSession, setViewingSession] = useState<{ id: string; messages: SessionLogMessage[] } | null>(null);
  const [subDir, setSubDir] = useState<FileEntry[] | null>(null);
  const [subDirPath, setSubDirPath] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  const handleOpenFile = useCallback(async (entry: FileEntry) => {
    if (entry.isDirectory) {
      setLoadingFile(true);
      try {
        const { readDir } = await import('@tauri-apps/plugin-fs');
        const entries = await readDir(entry.path);
        setSubDir(
          entries
            .map((e: { name: string; isDirectory: boolean }) => ({
              name: e.name,
              path: `${entry.path}/${e.name}`,
              isDirectory: e.isDirectory,
            }))
            .sort((a: FileEntry, b: FileEntry) => {
              if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
        );
        setSubDirPath(entry.path);
      } catch {
        setSubDir([]);
        setSubDirPath(entry.path);
      } finally {
        setLoadingFile(false);
      }
      return;
    }

    setLoadingFile(true);
    try {
      const content = await readFile(entry.path);
      setViewingFile({ path: entry.path, name: entry.name, content });
    } catch {
      setViewingFile({ path: entry.path, name: entry.name, content: '(could not read file)' });
    } finally {
      setLoadingFile(false);
    }
  }, [readFile]);

  const handleOpenSession = useCallback(async (session: SessionEntry) => {
    setLoadingFile(true);
    try {
      const messages = await readSessionLog(session.filePath);
      setViewingSession({ id: session.id, messages });
    } catch {
      setViewingSession({ id: session.id, messages: [] });
    } finally {
      setLoadingFile(false);
    }
  }, [readSessionLog]);

  const displayFiles = subDir ?? workspaceFiles;

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Section switcher */}
      <div className="flex gap-2">
        {(['files', 'sessions', 'cron'] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setActiveSection(s); setViewingFile(null); setViewingSession(null); setSubDir(null); setSubDirPath(null); }}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeSection === s
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {s === 'files' ? `Files (${workspaceFiles.length})` : s === 'sessions' ? `Sessions (${sessions.length})` : `Cron (${cronJobs.length})`}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading...</p>}

      {/* File Browser */}
      {activeSection === 'files' && !loading && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 px-4 py-2 bg-zinc-900/50 border-b border-zinc-800 text-xs text-zinc-500">
            <button
              onClick={() => { setSubDir(null); setSubDirPath(null); setViewingFile(null); }}
              className="hover:text-zinc-300"
            >
              {workspacePath?.split('/').pop() ?? 'workspace'}
            </button>
            {subDirPath && (
              <>
                <span>/</span>
                <span className="text-zinc-400">{subDirPath.split('/').pop()}</span>
              </>
            )}
          </div>

          {displayFiles.length === 0 ? (
            <p className="p-4 text-sm text-zinc-600 italic">No files found.</p>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {displayFiles.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => handleOpenFile(entry)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-800/50 transition-colors"
                >
                  <span className="text-sm">
                    {entry.isDirectory ? '📁' : entry.name.endsWith('.md') ? '📄' : '📃'}
                  </span>
                  <span className="text-sm text-zinc-300 truncate">{entry.name}</span>
                  {entry.isDirectory && (
                    <span className="ml-auto text-xs text-zinc-600">&rarr;</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* File Viewer */}
      {viewingFile && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-zinc-300">{viewingFile.name}</h4>
            <button
              onClick={() => setViewingFile(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Close
            </button>
          </div>
          <pre className="text-sm text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed max-h-[500px] overflow-y-auto bg-zinc-950/50 rounded-lg p-3">
            {viewingFile.content || '(empty file)'}
          </pre>
        </div>
      )}

      {/* Sessions */}
      {activeSection === 'sessions' && !loading && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          {sessions.length === 0 ? (
            <p className="p-4 text-sm text-zinc-600 italic">No sessions found.</p>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleOpenSession(session)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
                >
                  <span className="text-sm">💬</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate font-mono">{session.id.slice(0, 8)}...</p>
                    <p className="text-xs text-zinc-500">
                      {session.updatedAt ? new Date(session.updatedAt).toLocaleString() : 'Unknown date'}
                      {session.chatType && ` · ${session.chatType}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Session Viewer */}
      {viewingSession && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-zinc-300">
              Session {viewingSession.id.slice(0, 8)}...
            </h4>
            <button
              onClick={() => setViewingSession(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Close
            </button>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {viewingSession.messages
              .filter((m) => m.type === 'message' && m.role && m.content)
              .map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-500/10 border border-blue-500/20'
                      : msg.role === 'assistant'
                      ? 'bg-zinc-800/50 border border-zinc-700/50'
                      : 'bg-zinc-900 border border-zinc-800'
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                    {msg.role}
                  </p>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                    {msg.content
                      ?.filter((c) => c.type === 'text' && c.text)
                      .map((c) => c.text)
                      .join('\n')
                      ?.slice(0, 2000) || '(no text content)'}
                  </p>
                </div>
              ))}
            {viewingSession.messages.filter((m) => m.type === 'message').length === 0 && (
              <p className="text-sm text-zinc-600 italic">No messages in this session.</p>
            )}
          </div>
        </div>
      )}

      {/* Cron Jobs */}
      {activeSection === 'cron' && !loading && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          {cronJobs.length === 0 ? (
            <p className="p-4 text-sm text-zinc-600 italic">No cron jobs for this agent.</p>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {cronJobs.map((job) => (
                <div key={job.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${job.enabled ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
                    <span className="text-sm text-zinc-300">{job.name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                    <span>{job.schedule.kind === 'at' ? `At: ${job.schedule.at}` : `Cron: ${job.schedule.cron}`}</span>
                    {job.state?.lastStatus && <span>Last: {job.state.lastStatus}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loadingFile && (
        <p className="text-sm text-zinc-500">Loading...</p>
      )}
    </div>
  );
}
