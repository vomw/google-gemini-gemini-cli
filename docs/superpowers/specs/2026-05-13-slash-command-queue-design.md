# Slash Command Queue Design

## Problem

Non-`isSafeConcurrent` slash commands typed while Gemini is streaming (e.g.
`/compress`, `/clear`, `/model flash`) currently show the error "Slash commands
cannot be queued" and are dropped. Users lose their command and must retype it
after streaming ends.

## Goal

Queue non-safe slash commands entered during streaming and execute them
automatically once streaming completes and any pending async command finishes.

## Approach

Separate slash command queue (Approach B) — parallel to the existing text
message queue, no changes to text queue consumers.

`isSafeConcurrent` commands (`/stats`, `/about`, `/vim`, `/gemma`) continue to
execute immediately. Only non-safe commands are affected.

---

## Architecture

### New hook: `useSlashCommandQueue`

**File:** `packages/cli/src/ui/hooks/useSlashCommandQueue.ts`

Manages a FIFO `string[]` of raw slash command inputs (e.g. `"/compress"`,
`"/clear"`, `"/model gemini-2.5-flash"`).

Exports:

- `queuedSlashCommands: readonly string[]` — current queue contents (for footer
  read)
- `enqueueSlashCommand(rawInput: string): void` — appends to tail
- `dequeueSlashCommand(): string | undefined` — pops and returns head

State is local (`useState`). No persistence across sessions needed.

---

### Enqueue path — `InputPrompt.tsx`

**File:** `packages/cli/src/ui/components/InputPrompt.tsx` (~line 476)

**Current:** Non-safe slash commands during streaming → show error
`"Slash commands cannot be queued"`.

**New:** Call `enqueueSlashCommand(rawInput)` instead. Clear the input buffer.
No error shown — the footer hint tells the user the command is queued.

`isSafeConcurrent` commands are unchanged (still execute immediately).

---

### Drain path — `AppContainer.tsx`

**File:** `packages/cli/src/ui/AppContainer.tsx`

A `useEffect` watching `[streamingState, pendingItem, queuedSlashCommands]`:

```
if (
  streamingState === StreamingState.Idle &&
  pendingItem === null &&
  queuedSlashCommands.length > 0
) {
  const cmd = dequeueSlashCommand();
  handleSlashCommand(cmd);
}
```

One item drained per effect cycle. Async commands like `/compress` set
`pendingItem` — the `pendingItem === null` guard prevents the next item from
firing until that clears. Synchronous commands (most) complete within the same
cycle; the next item fires on the following render.

`handleSlashCommand` is the existing function from `useSlashCommandProcessor` —
no new execution path.

---

### Footer hint — `Footer.tsx`

**File:** `packages/cli/src/ui/components/Footer.tsx`

When `queuedSlashCommands.length > 0`, render a footer column showing:

```
⚡ /compress queued
```

Displays the first item in queue. Disappears when queue empties. Uses existing
`addCol` footer column mechanism — no new component.

---

## Data Flow

```
User types /compress while streaming
  → InputPrompt detects: streaming=true, isSafeConcurrent=false
  → enqueueSlashCommand("/compress")
  → input buffer cleared
  → Footer shows "⚡ /compress queued"

Streaming ends → streamingState = Idle
  → useEffect fires: Idle + pendingItem=null + queue=["/compress"]
  → dequeueSlashCommand() → "/compress"
  → handleSlashCommand("/compress") dispatched
  → Footer hint disappears (queue empty)
```

---

## Edge Cases

| Case                           | Behavior                                                         |
| ------------------------------ | ---------------------------------------------------------------- |
| Multiple commands queued       | Drained one at a time in order                                   |
| `/compress` queued (async)     | `pendingItem` gate prevents next command until compress finishes |
| User queues same command twice | Both entries execute (no dedup — user intent preserved)          |
| Streaming cancelled mid-way    | Queue drains normally on next `Idle` transition                  |
| Command is invalid/unknown     | `handleSlashCommand` handles the error as it normally does       |

---

## Files Changed

| File                                                | Change                                        |
| --------------------------------------------------- | --------------------------------------------- |
| `packages/cli/src/ui/hooks/useSlashCommandQueue.ts` | **New** — queue state hook                    |
| `packages/cli/src/ui/components/InputPrompt.tsx`    | Replace error with `enqueueSlashCommand` call |
| `packages/cli/src/ui/AppContainer.tsx`              | Wire up hook + drain `useEffect`              |
| `packages/cli/src/ui/components/Footer.tsx`         | Add queued hint column                        |

---

## Out of Scope

- Persisting queue across sessions
- Cancelling a queued command
- Queue depth limit (unlikely to be an issue in practice)
- Visual queue list (footer hint for first item is sufficient)
