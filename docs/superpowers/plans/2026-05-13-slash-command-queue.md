# Slash Command Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Queue non-`isSafeConcurrent` slash commands typed during streaming and
drain them one-at-a-time once streaming is idle.

**Architecture:** New `useSlashCommandQueue` hook owns FIFO `string[]` state.
`InputPrompt` enqueues instead of erroring. `AppContainer` drains via
`useEffect` on `streamingState`. Footer reads queue for hint display. Mirrors
the existing `useMessageQueue` pattern.

**Tech Stack:** TypeScript, React (Ink), existing `StreamingState` enum,
existing `handleSlashCommand` function.

---

## File Map

| File                                                | Change                                                          |
| --------------------------------------------------- | --------------------------------------------------------------- |
| `packages/cli/src/ui/hooks/useSlashCommandQueue.ts` | **New** — queue state hook                                      |
| `packages/cli/src/ui/contexts/UIActionsContext.tsx` | Add `enqueueSlashCommand` to actions interface                  |
| `packages/cli/src/ui/contexts/UIStateContext.tsx`   | Add `queuedSlashCommands: string[]` to UIState interface        |
| `packages/cli/src/ui/AppContainer.tsx`              | Use hook, wire UIActions, wire drain effect, wire UIState       |
| `packages/cli/src/ui/components/InputPrompt.tsx`    | Add `onQueueSlashCommand` prop; replace error with enqueue      |
| `packages/cli/src/ui/components/Composer.tsx`       | Pass `uiActions.enqueueSlashCommand` as `onQueueSlashCommand`   |
| `packages/cli/src/ui/components/Footer.tsx`         | Read `queuedSlashCommands` from UIState; add queued hint column |

---

## Task 1: Create `useSlashCommandQueue` hook

**Files:**

- Create: `packages/cli/src/ui/hooks/useSlashCommandQueue.ts`
- Test (manual — no test framework issue in this dir; verify in Task 4
  integration)

- [ ] **Step 1: Create the hook file**

Create `packages/cli/src/ui/hooks/useSlashCommandQueue.ts`:

```typescript
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useState } from 'react';

export interface UseSlashCommandQueueReturn {
  queuedSlashCommands: readonly string[];
  enqueueSlashCommand: (rawInput: string) => void;
  dequeueSlashCommand: () => string | undefined;
}

/**
 * Hook for queuing slash commands entered while streaming is active.
 * Commands are drained one-at-a-time when the app returns to Idle state.
 */
export function useSlashCommandQueue(): UseSlashCommandQueueReturn {
  const [queue, setQueue] = useState<string[]>([]);

  const enqueueSlashCommand = useCallback((rawInput: string) => {
    const trimmed = rawInput.trim();
    if (trimmed.length > 0) {
      setQueue((prev) => [...prev, trimmed]);
    }
  }, []);

  const dequeueSlashCommand = useCallback((): string | undefined => {
    let head: string | undefined;
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      head = prev[0];
      return prev.slice(1);
    });
    return head;
  }, []);

  return {
    queuedSlashCommands: queue,
    enqueueSlashCommand,
    dequeueSlashCommand,
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli/packages/cli && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: clean (no output).

- [ ] **Step 3: Commit**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli
git add packages/cli/src/ui/hooks/useSlashCommandQueue.ts
git commit --author="rushikeshsakharleofficial <rishiananya123@gmail.com>" \
  -m "feat(cli): add useSlashCommandQueue hook"
```

---

## Task 2: Wire `enqueueSlashCommand` into UIActionsContext and AppContainer

**Files:**

- Modify: `packages/cli/src/ui/contexts/UIActionsContext.tsx`
- Modify: `packages/cli/src/ui/AppContainer.tsx`

- [ ] **Step 1: Add `enqueueSlashCommand` to UIActionsContext interface**

Open `packages/cli/src/ui/contexts/UIActionsContext.tsx`. Find the interface
(around line 74–75 where `addMessage` is). Add the new action after
`addMessage`:

```typescript
  addMessage: (message: string) => void;
  popAllMessages: () => string | undefined;
  enqueueSlashCommand: (rawInput: string) => void;  // ← add this line
```

- [ ] **Step 2: Use the hook in AppContainer**

Open `packages/cli/src/ui/AppContainer.tsx`.

**2a.** Add the import near the top, alongside `useMessageQueue`:

```typescript
import { useSlashCommandQueue } from './hooks/useSlashCommandQueue.js';
```

**2b.** Call the hook after `useMessageQueue` (around line 1334):

```typescript
const {
  messageQueue,
  addMessage,
  clearQueue,
  getQueuedMessagesText,
  popAllMessages,
} = useMessageQueue({
  isConfigInitialized,
  streamingState,
  submitQuery,
  isMcpReady,
  isCompressing,
});

const { queuedSlashCommands, enqueueSlashCommand, dequeueSlashCommand } =
  useSlashCommandQueue(); // ← add after useMessageQueue block
```

**2c.** Add `enqueueSlashCommand` to the UIActions value object. There are two
large UIActions objects in AppContainer (around lines 2740 and 2846). In both,
find the `addMessage,` line and add `enqueueSlashCommand,` right after it:

```typescript
      addMessage,
      popAllMessages,
      enqueueSlashCommand,    // ← add this line after addMessage in BOTH objects
```

- [ ] **Step 3: Type-check**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli/packages/cli && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli
git add packages/cli/src/ui/contexts/UIActionsContext.tsx \
        packages/cli/src/ui/AppContainer.tsx
git commit --author="rushikeshsakharleofficial <rishiananya123@gmail.com>" \
  -m "feat(cli): wire useSlashCommandQueue into UIActions"
```

---

## Task 3: Replace error with enqueue in InputPrompt + Composer

**Files:**

- Modify: `packages/cli/src/ui/components/InputPrompt.tsx`
- Modify: `packages/cli/src/ui/components/Composer.tsx`

- [ ] **Step 1: Add `onQueueSlashCommand` prop to InputPrompt**

Open `packages/cli/src/ui/components/InputPrompt.tsx`. Find the props interface
(around line 128–134):

```typescript
  setQueueErrorMessage: (message: string | null) => void;
  streamingState: StreamingState;
  popAllMessages?: () => string | undefined;
  onQueueMessage?: (message: string) => void;
```

Add the new optional prop:

```typescript
  setQueueErrorMessage: (message: string | null) => void;
  streamingState: StreamingState;
  popAllMessages?: () => string | undefined;
  onQueueMessage?: (message: string) => void;
  onQueueSlashCommand?: (rawInput: string) => void;  // ← add
```

- [ ] **Step 2: Destructure the new prop**

In the same file, find the destructuring of props (around line 219 where
`onQueueMessage` is destructured). Add `onQueueSlashCommand`:

```typescript
  onQueueMessage,
  onQueueSlashCommand,     // ← add
```

- [ ] **Step 3: Replace the error with enqueue**

Find the block around line 460–479:

```typescript
if ((isSlash || isShell) && streamingState === StreamingState.Responding) {
  if (isSlash) {
    const { commandToExecute } = parseSlashCommand(
      trimmedMessage,
      slashCommands,
    );
    if (commandToExecute?.isSafeConcurrent) {
      handleSubmitAndClear(trimmedMessage);
      return;
    }
  }

  setQueueErrorMessage(
    `${isShell ? 'Shell' : 'Slash'} commands cannot be queued`,
  );
  return;
}
```

Change to:

```typescript
if ((isSlash || isShell) && streamingState === StreamingState.Responding) {
  if (isSlash) {
    const { commandToExecute } = parseSlashCommand(
      trimmedMessage,
      slashCommands,
    );
    if (commandToExecute?.isSafeConcurrent) {
      handleSubmitAndClear(trimmedMessage);
      return;
    }
    if (onQueueSlashCommand) {
      onQueueSlashCommand(trimmedMessage);
      buffer.setText('');
      return;
    }
  }

  setQueueErrorMessage(
    `${isShell ? 'Shell' : 'Slash'} commands cannot be queued`,
  );
  return;
}
```

- [ ] **Step 4: Add `onQueueSlashCommand` to the deps array**

In the same file, find the `useCallback` deps array that includes
`onQueueMessage` (around line 1385). Add `onQueueSlashCommand` to it:

```typescript
      onQueueMessage,
      onQueueSlashCommand,    // ← add
```

- [ ] **Step 5: Pass the prop from Composer**

Open `packages/cli/src/ui/components/Composer.tsx`. Find where `InputPrompt` is
rendered with `onQueueMessage={uiActions.addMessage}` (around line 159). Add the
new prop right after:

```typescript
          onQueueMessage={uiActions.addMessage}
          onQueueSlashCommand={uiActions.enqueueSlashCommand}  // ← add
```

- [ ] **Step 6: Type-check**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli/packages/cli && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli
git add packages/cli/src/ui/components/InputPrompt.tsx \
        packages/cli/src/ui/components/Composer.tsx
git commit --author="rushikeshsakharleofficial <rishiananya123@gmail.com>" \
  -m "feat(cli): enqueue slash commands during streaming instead of erroring"
```

---

## Task 4: Wire drain effect in AppContainer + add to UIState

**Files:**

- Modify: `packages/cli/src/ui/AppContainer.tsx`
- Modify: `packages/cli/src/ui/contexts/UIStateContext.tsx`

- [ ] **Step 1: Add `queuedSlashCommands` to UIState interface**

Open `packages/cli/src/ui/contexts/UIStateContext.tsx`. Find line 160 where
`messageQueue: string[]` is:

```typescript
  messageQueue: string[];
  queueErrorMessage: string | null;
```

Add right after `messageQueue`:

```typescript
  messageQueue: string[];
  queuedSlashCommands: string[];    // ← add
  queueErrorMessage: string | null;
```

- [ ] **Step 2: Add drain useEffect in AppContainer**

Open `packages/cli/src/ui/AppContainer.tsx`. Find where the `useMessageQueue`
block ends (around line 1334). Add the drain effect after it:

```typescript
// Drain queued slash commands one-at-a-time when idle with no pending async command.
useEffect(() => {
  if (
    streamingState === StreamingState.Idle &&
    !isCompressing &&
    queuedSlashCommands.length > 0
  ) {
    const cmd = dequeueSlashCommand();
    if (cmd) {
      void handleSlashCommand(cmd);
    }
  }
}, [
  streamingState,
  isCompressing,
  queuedSlashCommands,
  dequeueSlashCommand,
  handleSlashCommand,
]);
```

- [ ] **Step 3: Pass `queuedSlashCommands` into the UIState value object**

In AppContainer, find the two large UIState value objects (around lines 2535 and
2648). In both, find `messageQueue,` and add `queuedSlashCommands,` right after
it:

```typescript
      messageQueue,
      queuedSlashCommands,    // ← add after messageQueue in BOTH objects
      queueErrorMessage,
```

- [ ] **Step 4: Type-check**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli/packages/cli && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli
git add packages/cli/src/ui/AppContainer.tsx \
        packages/cli/src/ui/contexts/UIStateContext.tsx
git commit --author="rushikeshsakharleofficial <rishiananya123@gmail.com>" \
  -m "feat(cli): drain queued slash commands on idle in AppContainer"
```

---

## Task 5: Add footer hint

**Files:**

- Modify: `packages/cli/src/ui/components/Footer.tsx`

- [ ] **Step 1: Read the relevant Footer section**

Open `packages/cli/src/ui/components/Footer.tsx`. Check the current footer
props/state — `Footer` takes no props, reads from `useUIState()`. The `uiState`
variable holds `queuedSlashCommands` after Task 4.

Also check the existing `addCol` calls to understand the pattern (around line
337 for `context-used` as a simple example).

- [ ] **Step 2: Add the queued hint column**

In `Footer.tsx`, find where the `addCol` calls are made (around line 262
onwards). Add a new `addCol` for the queued hint before the closing
`if (corgiMode)` line (around line 468):

```typescript
  if (uiState.queuedSlashCommands.length > 0) {
    addCol(
      'slash-queued',
      '',
      () => (
        <Text color={theme.status.warning}>
          ⚡ {uiState.queuedSlashCommands[0]} queued
        </Text>
      ),
      uiState.queuedSlashCommands[0].length + 10,
      false,
    );
  }
```

Make sure `Text` is imported from `'ink'` at the top of the file — it already
is. `theme` is also already imported.

- [ ] **Step 3: Type-check**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli/packages/cli && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli
git add packages/cli/src/ui/components/Footer.tsx
git commit --author="rushikeshsakharleofficial <rishiananya123@gmail.com>" \
  -m "feat(cli): show queued slash command hint in footer"
```

---

## Task 6: Build, bundle, verify

- [ ] **Step 1: Build CLI**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli/packages/cli && ./node_modules/.bin/tsc --build 2>&1 | grep "error TS" && echo "clean"
```

Expected: `clean`

- [ ] **Step 2: Rebundle**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli && node esbuild.config.js 2>&1 | grep -i "error\|fail" || echo "bundle ok"
```

Expected: `bundle ok`

- [ ] **Step 3: Smoke test**

```bash
{ time gemini --version; } 2>&1
```

Expected: version printed in < 3 s.

Manual verify: start `gemini`, send a message (e.g. "tell me a story"),
immediately type `/compress` while streaming — footer should show
`⚡ /compress queued`. After response completes, compression should run
automatically.

- [ ] **Step 4: Push**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli && git push fork feat/compress-progress-bar 2>&1 | tail -3
```

---

## Task 7: Fix token display — show cumulative session totals

**Problem:** Footer shows `↑43.2k ↓731` where `↑` = current context window size
(`lastPromptTokenCount`) and `↓` = last single response output
(`lastOutputTokenCount`). These are different metric types — mixing them gives a
misleading "total". The correct display is cumulative session totals: how many
tokens were actually sent and received across all requests this session.

**Fix:** Add `totalOutputTokens` to `computeSessionStats`. Update
`ContextUsageDisplay` to pull cumulative totals from `useSessionStats()` instead
of using the raw last-request props.

**Files:**

- Modify: `packages/cli/src/ui/utils/computeStats.ts`
- Modify: `packages/cli/src/ui/contexts/SessionContext.tsx`
  (ComputedSessionStats interface)
- Modify: `packages/cli/src/ui/components/ContextUsageDisplay.tsx`

- [ ] **Step 1: Add `totalOutputTokens` to `computeSessionStats`**

Open `packages/cli/src/ui/utils/computeStats.ts`.

In the `ComputedSessionStats` interface (around line 164), add after
`totalPromptTokens`:

```typescript
totalInputTokens: number;
totalPromptTokens: number;
totalOutputTokens: number; // ← add: cumulative output/candidate tokens this session
```

In the `computeSessionStats` function body, add after the `totalInputTokens`
block (around line 56):

```typescript
const totalOutputTokens = Object.values(models).reduce(
  (acc, model) => acc + model.tokens.candidates,
  0,
);
```

Add `totalOutputTokens` to the return object:

```typescript
return {
  totalApiTime,
  totalToolTime,
  agentActiveTime,
  apiTimePercent,
  toolTimePercent,
  cacheEfficiency,
  totalDecisions,
  successRate,
  agreementRate,
  totalCachedTokens,
  totalInputTokens,
  totalPromptTokens,
  totalOutputTokens, // ← add
  totalLinesAdded: files.totalLinesAdded,
  totalLinesRemoved: files.totalLinesRemoved,
};
```

- [ ] **Step 2: Update `ContextUsageDisplay` to use cumulative session totals**

Open `packages/cli/src/ui/components/ContextUsageDisplay.tsx`.

Add import at top (alongside existing imports):

```typescript
import { useSessionStats } from '../contexts/SessionContext.js';
import { computeSessionStats } from '../utils/computeStats.js';
```

Inside the component function, add after the existing hooks:

```typescript
const { stats } = useSessionStats();
const computed = computeSessionStats(stats.metrics);
const sessionInputTokens = computed.totalPromptTokens;
const sessionOutputTokens = computed.totalOutputTokens;
```

Change the `showTokenCounts` condition and arrow display to use these cumulative
values instead of the raw props:

```typescript
  const showTokenCounts =
    terminalWidth >= MIN_TERMINAL_WIDTH_FOR_FULL_LABEL &&
    (sessionInputTokens > 0 || sessionOutputTokens > 0);

  return (
    <Box flexDirection="row" gap={1}>
      {showTokenCounts && (
        <Box flexDirection="row" gap={1}>
          <Text color={theme.text.secondary}>
            ↑{formatTokenCount(sessionInputTokens)}
          </Text>
          {sessionOutputTokens > 0 && (
            <Text color={theme.text.secondary}>
              ↓{formatTokenCount(sessionOutputTokens)}
            </Text>
          )}
        </Box>
      )}
      <Text color={textColor}>
        {percentageUsed}
        {label}
      </Text>
    </Box>
  );
```

Note: `promptTokenCount` prop is still used for the `% used` calculation
(context window fill) — keep that unchanged.

The props `outputTokenCount` is now unused in display (session totals replace
it). Keep the prop signature unchanged to avoid ripple changes — it just won't
be used in the display path.

- [ ] **Step 3: Type-check**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli/packages/cli && npx tsc --noEmit 2>&1 | grep "error TS"
cd /home/rushikesh.sakharle/Projects/gemini-cli/packages/core && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: clean on both.

- [ ] **Step 4: Commit**

```bash
cd /home/rushikesh.sakharle/Projects/gemini-cli
git add packages/cli/src/ui/utils/computeStats.ts \
        packages/cli/src/ui/components/ContextUsageDisplay.tsx
git commit --author="rushikeshsakharleofficial <rishiananya123@gmail.com>" \
  -m "fix(cli): show cumulative session token totals in footer

Replace last-request prompt/output counts with session cumulative totals.
Input arrow now shows total tokens sent across all requests; output arrow
shows total candidate tokens received. Context % remains context-window based."
```

---

## Self-Review

**Spec coverage:**

- ✅ `useSlashCommandQueue` hook with enqueue/dequeue/read — Task 1
- ✅ `isSafeConcurrent` commands unchanged — Task 3 (only enqueues when not
  safe-concurrent)
- ✅ Enqueue on non-safe slash cmd during streaming — Task 3
- ✅ Drain on Idle, one-at-a-time, async guard via `isCompressing` — Task 4
- ✅ Footer `⚡ /cmd queued` hint — Task 5

**Type consistency:**

- `enqueueSlashCommand(rawInput: string)` — consistent across hook,
  UIActionsContext, AppContainer, Composer, InputPrompt
- `dequeueSlashCommand()` — used only in AppContainer drain effect
- `queuedSlashCommands: readonly string[]` (hook) /
  `queuedSlashCommands: string[]` (UIState) — both assignable ✓

**Note on drain guard:** The drain effect uses `!isCompressing` rather than
checking `pendingItem === null` directly. `isCompressing` is derived from
`pendingHistoryItems` checking for a pending COMPRESSION item, which covers the
`/compress` async case. Other async commands that set `pendingItem` (like
`/export-session`) also show in `pendingHistoryItems`. If a future async command
doesn't set a `pendingHistoryItems` entry, the drain might fire too early — but
this matches the existing `useMessageQueue` pattern and is acceptable for now.
