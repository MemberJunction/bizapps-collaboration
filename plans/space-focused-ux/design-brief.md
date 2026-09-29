# Design Brief: Space-Focused Workspace & Multi-Conversation UX Refactor

## 1. Context & Business Intent
MemberJunction Collaboration unites team members, outside clients, and autonomous AI agents in purposeful **Spaces**.
In the initial implementation, the left navigation rail was dominated by top-level global items (Active Spaces list, global Inbox, Tasks, Files counters) that remained static once a user entered a space. 
This refactor shifts the mental model to a **Space-Centric Workspace**:
- When the user is outside a space (Collab Home), they get a comprehensive **Space Explorer / Directory** to discover, filter, and open spaces.
- Once inside a space, the left navigation transforms to be **100% focused on that specific space**—allowing effortless switching between the space's core modules (Overview, Conversations, Documents, Tasks, People, Settings, Extensions).
- Navigation between spaces is facilitated by clear breadcrumbs and a fast space-switcher.
- Inside each space, the chat experience is upgraded from a single hardcoded scratch chat to **full multi-conversation support** powered by `@memberjunction/ng-conversations` (`mj-conversation-chat-area` and `mj-conversation-list`).

**Outcome:** this is built. Inside a space, the rail holds its tabs and conversations, resizes and collapses, and saves that per person as `mjc.spaceNav.state`. The chat is `mj-conversation-chat-area`; the rail lists the space's conversations itself, so `mj-conversation-list` isn't used.

---

## 2. Core Personas
1. **Engagement Lead / Project Manager (Internal Team)**: Runs client delivery or internal initiatives across multiple parallel workstreams (e.g. strategic discussions, deliverable reviews, client support threads, and automated agent analyses). Needs fast switching between channels and tasks without losing context.
2. **Client Partner / External Stakeholder (Shared Band)**: Invited into a specific space with access bounded to the Shared band. Needs a clean, distraction-free environment to participate in discussions, review documents, and interact with the AI assistant.
3. **Board / Committee Member (Governance Extension)**: Interacts with custom space tabs (Meetings, Papers, Motions) alongside governance discussions.

---

## 3. Key Jobs to Be Done (JTBD)
- **JTBD 1: Space Discovery & Entry (Home View)**: "As a user with multiple projects, I want an intuitive Spaces Directory so I can quickly find my active spaces, see unread updates, and jump directly into the right space or sub-space."
- **JTBD 2: Deep In-Space Focus (Contextual Left Nav)**: "When I am working inside 'Acme Rebrand', I want my navigation to show me the rooms, docs, and tasks for *Acme Rebrand*, maximizing my main screen area for the active work."
- **JTBD 3: Multi-Conversation Channels**: "Within a space, I want to create and participate in multiple distinct conversations (e.g., `#general`, `#deliverables`, `Agent Brainstorm`, `Client Q&A`) instead of one cramped message stream, with full MJ chat capabilities (mentions, attachments, ratings, agent execution)."
- **JTBD 4: Ergonomic Navigation & State Memory**: "I want the left navigation to be resizable and collapsible, and I want the system to remember my exact preference (width/collapsed) across browser sessions via `UserInfoEngine`."

---

## 4. Architectural & UI Constraints
- **Substrate Reuse**:
  - Re-use `@memberjunction/ng-conversations` (`mj-conversation-chat-area` with slot projection and `mj-conversation-list` / conversation selector) rather than maintaining custom chat forks.
  - Re-use MJ Design Tokens (zero hardcoded hex colors, seamless light/dark mode support).
  - Persist user UI layout preferences via `UserInfoEngine.Instance.SetSettingDebounced('mjc.spaceNav.state', ...)`.
- **Breadcrumb Navigation**:
  - Persistent, prominent breadcrumbs (`Home / Acme Rebrand / Q3 Strategy / #deliverables-chat`) with quick dropdown jump.
- **Maximized Stage**:
  - The right-hand work surface must be wide, expansive, and high-performance, whether rendering rich multi-turn chat, task boards, or document libraries.

---

## 5. Three Divergent Design Directions Explored

1. **Option A: The Contextual Workspace Rail (Channel & Tree Architecture)**
   - *Philosophy*: Dual-stage focused hierarchy (inspired by Slack/Discord/Linear).
   - *Left Nav*: Dedicated Space Sidebar containing Space Header, Quick Switcher, Core Tools, and an inline collapsible **Conversations** tree with unread badges and `+ New Conversation`.
   - *Resizing*: Smooth drag-resize border + collapse toggle with persistent width.
   - *Right Stage*: 100% full-width canvas for the active item. Clicking any conversation opens full `mj-conversation-chat-area`.

2. **Option B: The Hub & Deep Inspector (3-Column Fluid Pane Architecture)**
   - *Philosophy*: Modular 3-pane workstation (inspired by Notion / Apple Mail / Teams).
   - *Column 1*: Slim Space Section Rail (Overview, Conversations, Library, Tasks, People, Settings).
   - *Column 2 (Collapsible)*: Dynamic Context Stream. When "Conversations" is active, Column 2 renders the full `mj-conversation-list` (search, unread filters, pinned chats, timestamped previews).
   - *Column 3*: Broad reading/chat canvas. Middle column can be collapsed via toggle/hotkey (`Cmd+B`) to expand the stage.

3. **Option C: The Unified Cockpit (Modern App Bar & Segmented Channel Studio)**
   - *Philosophy*: Elegant, clean executive studio with floating/split panel flexibility (inspired by Figma/Raycast/Modern SaaS).
   - *Left Nav*: Minimalist high-density Space Nav with quick space switcher at top and direct module links.
   - *Conversations Header*: Multi-channel pill bar / switcher in the Chat module header, with instant audience indicators (`Client & Team` vs `Internal Team Only`), participant avatars, and split-view capability to review documents side-by-side with conversation.
