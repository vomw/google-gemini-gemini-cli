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
