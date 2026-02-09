# Clear Context Feature

## Overview

The "Clear Context" feature allows users to reset the conversation context without losing the message history display. This is useful when you want to start a fresh conversation with an agent while keeping the previous messages visible for reference.

## How It Works

### User Interface

1. **Clear Context Button**: Located in the chat header (lightning bolt icon), visible when there are messages in the conversation
2. **Confirmation Dialog**: Prevents accidental context clears by asking for confirmation
3. **Context Marker**: A visual indicator (lightning bolt with text) shown in the message history where context was cleared

### Technical Implementation

#### Message Store Changes

- **Message Type Extension**: Added `'system'` role and `isContextMarker` flag to the `Message` interface
- **Session Versioning**: Each agent maintains a session version that increments when context is cleared
- **Context Marker Insertion**: System messages are inserted into the message history to mark context boundaries

#### Session Management

When context is cleared:
1. A context marker is inserted into the message history (visible to user)
2. The session version for that agent is incremented
3. A new session key is generated using the format: `agent:{agentId}:skills-v2-ctx{version}`
4. Future messages use the new session key, creating a fresh context on the OpenClaw gateway

#### Message Filtering

- **Display**: All messages are shown in the UI, including those before context markers
- **Context**: Only messages after the last context marker are sent to the AI
- **Helper**: `useMessagesForContext()` hook returns filtered messages for context

### File Changes

1. **src/stores/agents.ts**
   - Added `sessionVersionsByAgent` state
   - Added `insertContextMarker` action
   - Added `getSessionVersion` getter
   - Added `useMessagesForContext` selector
   - Extended `Message` interface

2. **src/components/chat/ChatPanel.tsx**
   - Added clear context button in header
   - Added confirmation dialog
   - Updated `ChatMessage` component to render system messages
   - Added state for confirmation dialog

3. **src/hooks/useOpenClaw.ts**
   - Updated `sessionKeyForAgent` to include version suffix
   - Modified `sendMessage` to use versioned session keys
   - Modified `spawnSubAgent` to use versioned session keys
   - Updated history loading to use versioned session keys

## User Experience

### What Happens When You Clear Context

✅ **Preserved**:
- All message history remains visible in the chat
- Previous conversations can be scrolled through and read
- Agent selection and settings remain unchanged

🔄 **Changed**:
- New messages start with a fresh context (AI doesn't see messages before the marker)
- A visual marker indicates where the context was cleared
- A new session is created on the backend

### Use Cases

1. **Topic Change**: Switch to a completely different topic without the AI being influenced by previous discussion
2. **Error Recovery**: Clear context after a confusing exchange to start fresh
3. **Testing**: Experiment with different approaches to the same problem
4. **Privacy**: Ensure sensitive information from earlier in the conversation isn't referenced
5. **Token Management**: Reset long conversations to avoid token limits

## UI/UX Details

### Button Design
- Icon: Lightning bolt (⚡) - symbolizes a "clean slate" or "fresh start"
- Location: Chat header, right side, before connection status
- States: 
  - Visible: When messages exist
  - Hidden: When no messages in chat
  - Disabled: When loading

### Confirmation Dialog
- **Title**: "Clear Conversation Context?"
- **Description**: Explains that history stays visible but won't be included in AI responses
- **Actions**:
  - Cancel (muted button)
  - Clear Context (amber/warning colored button)

### Context Marker
- Visual: Centered pill-shaped badge with lightning icon
- Text: "─── Context cleared ───"
- Style: Muted colors, subtle border, small text

## Future Enhancements

Potential improvements for future versions:

1. **Named Context Breaks**: Allow users to add notes/labels to context markers
2. **Context Jump Navigation**: Quick navigation between context markers
3. **Selective Context Reset**: Choose which parts of history to include/exclude
4. **Export/Import Context**: Save and restore specific conversation contexts
5. **Auto-Context Management**: Automatically suggest context clears based on topic changes
6. **Context Statistics**: Show how many messages are in current context
