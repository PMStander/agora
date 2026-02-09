import { useState } from 'react';
import { useEmailThread, useSelectedEmail } from '../../stores/email';
import { useEmail } from '../../hooks/useEmail';
import { EMAIL_STATUS_CONFIG } from '../../types/email';

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function statusBadgeClasses(color: string): string {
  const map: Record<string, string> = {
    zinc: 'bg-zinc-500/20 text-zinc-400',
    blue: 'bg-blue-500/20 text-blue-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    indigo: 'bg-indigo-500/20 text-indigo-400',
  };
  return map[color] || map.zinc;
}

export function EmailThread() {
  const selectedEmail = useSelectedEmail();
  const threadEmails = useEmailThread(selectedEmail?.thread_id || selectedEmail?.id || null);
  const { replyToEmail } = useEmail();
  const [replyBody, setReplyBody] = useState('');
  const [replying, setReplying] = useState(false);
  const [sending, setSending] = useState(false);

  if (!selectedEmail) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-zinc-500">Select an email to view</p>
      </div>
    );
  }

  const emails = threadEmails.length > 0 ? threadEmails : [selectedEmail];
  const statusConfig = EMAIL_STATUS_CONFIG[selectedEmail.status];

  const handleReply = async () => {
    if (!replyBody.trim() || sending) return;
    setSending(true);
    await replyToEmail(selectedEmail.id, replyBody);
    setReplyBody('');
    setReplying(false);
    setSending(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Thread Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-lg font-medium text-zinc-100">
          {selectedEmail.subject || '(no subject)'}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`px-2 py-0.5 text-[10px] rounded-full ${statusBadgeClasses(statusConfig.color)}`}
          >
            {statusConfig.label}
          </span>
          <span className="text-xs text-zinc-500">
            {selectedEmail.direction === 'inbound' ? 'From' : 'To'}:{' '}
            {selectedEmail.direction === 'inbound'
              ? selectedEmail.from_address
              : selectedEmail.to_addresses.join(', ')}
          </span>
        </div>
      </div>

      {/* Email Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {emails.map((email) => (
          <div
            key={email.id}
            className={`border rounded-lg p-4 ${
              email.direction === 'inbound'
                ? 'border-zinc-700 bg-zinc-800/30'
                : 'border-amber-500/20 bg-amber-500/5'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-zinc-200">
                {email.direction === 'inbound'
                  ? email.from_address || 'Unknown'
                  : 'You'}
              </span>
              <span className="text-[10px] text-zinc-500">
                {relativeTime(email.sent_at || email.received_at || email.created_at)}
              </span>
            </div>
            {email.body_html ? (
              <div
                className="text-sm text-zinc-300 prose prose-invert prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: email.body_html }}
              />
            ) : (
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                {email.body_text || '(empty)'}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Reply Section */}
      <div className="border-t border-zinc-800 p-4">
        {replying ? (
          <div className="space-y-2">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={4}
              placeholder="Type your reply..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={handleReply}
                disabled={!replyBody.trim() || sending}
                className="px-4 py-2 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
              >
                {sending ? 'Sending...' : 'Send Reply'}
              </button>
              <button
                onClick={() => {
                  setReplying(false);
                  setReplyBody('');
                }}
                className="px-4 py-2 text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg hover:border-zinc-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setReplying(true)}
            className="w-full px-4 py-2 text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-500 hover:text-zinc-100 transition-colors"
          >
            Reply
          </button>
        )}
      </div>
    </div>
  );
}
