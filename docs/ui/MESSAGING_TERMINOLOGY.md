# Messaging System Terminology Standards

## Core Principle

- **UI must say "Messages"** - all user-facing text uses "Messages" / "Message"
- **Schema/internal may say "Conversations"** - database tables, API endpoints, and code identifiers use "conversations" / "conversation"

## Correct UI Copy

| Context | Correct Copy |
|---------|--------------|
| Page header | "Messages" |
| Filter dropdown | "All Messages" |
| Empty state | "No messages yet" |
| Placeholder text | "Select a message to get started" |
| New message button | "New Circle Message" |
| Success toast | "Message sent" |
| Error toast | "Failed to send message" |

## Internal Identifiers (unchanged)

These remain as "conversation" in code:
- `cc_conversations` table
- `cc_conversation_participants` table
- `/api/conversations` endpoint
- `conversationId` variables
- `ConversationList`, `ConversationView` components
- TypeScript interfaces (`Conversation`, `ConversationListProps`)

## Why This Matters

- "Conversation" is a technical/internal concept representing the container
- "Message" is the user-friendly term that matches everyday language
- Users think in terms of messages, not conversations

## QA Checklist

When reviewing messaging surfaces:
- [ ] Left panel header says "Messages"
- [ ] Filter dropdown says "All Messages"
- [ ] Empty state says "No messages yet"
- [ ] Right panel placeholder says "Select a message to get started"
- [ ] Toast notifications use "message" not "conversation"
