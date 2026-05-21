/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { ToolCallStatus, mapCoreStatusToDisplayStatus } from '../../types.js';
import {
  SHELL_COMMAND_NAME,
  SHELL_NAME,
  TOOL_STATUS,
  TOOL_OUTPUT_CONNECTOR,
  SHELL_FOCUS_HINT_DELAY_MS,
} from '../../constants.js';
import { theme } from '../../semantic-colors.js';
import {
  type Config,
  SHELL_TOOL_NAME,
  isCompletedAskUserTool,
  type ToolResultDisplay,
  CoreToolCallStatus,
} from '@google/gemini-cli-core';
import { useInactivityTimer } from '../../hooks/useInactivityTimer.js';
import { formatCommand } from '../../key/keybindingUtils.js';
import { Command } from '../../key/keyBindings.js';

export const STATUS_INDICATOR_WIDTH = 3;

/**
 * Returns true if the tool name corresponds to a shell tool.
 */
export function isShellTool(name: string): boolean {
  const normalized = name.toLowerCase();
  return (
    name === SHELL_COMMAND_NAME ||
    name === SHELL_NAME ||
    name === SHELL_TOOL_NAME ||
    normalized === 'shell'
  );
}

/**
 * Returns true if the shell tool call is currently focusable.
 */
export function isThisShellFocusable(
  name: string,
  status: CoreToolCallStatus,
  config?: Config,
): boolean {
  return !!(
    isShellTool(name) &&
    status === CoreToolCallStatus.Executing &&
    config?.getEnableInteractiveShell()
  );
}

/**
 * Returns true if this specific shell tool call is currently focused.
 */
export function isThisShellFocused(
  name: string,
  status: CoreToolCallStatus,
  ptyId?: number,
  activeShellPtyId?: number | null,
  embeddedShellFocused?: boolean,
): boolean {
  return !!(
    isShellTool(name) &&
    status === CoreToolCallStatus.Executing &&
    ptyId === activeShellPtyId &&
    embeddedShellFocused
  );
}

/**
 * Hook to manage focus hint state.
 */
export function useFocusHint(
  isThisShellFocusable: boolean,
  isThisShellFocused: boolean,
  resultDisplay: ToolResultDisplay | undefined,
) {
  const [userHasFocused, setUserHasFocused] = useState(false);

  // Derive a stable reset key for the inactivity timer. For strings and arrays
  // (shell output), we use the length to capture updates without referential
  // identity issues or expensive deep comparisons.
  const resetKey =
    typeof resultDisplay === 'string'
      ? resultDisplay.length
      : Array.isArray(resultDisplay)
        ? resultDisplay.length
        : !!resultDisplay;

  const showFocusHint = useInactivityTimer(
    isThisShellFocusable,
    resetKey,
    SHELL_FOCUS_HINT_DELAY_MS,
  );

  useEffect(() => {
    if (isThisShellFocused) {
      setUserHasFocused(true);
    }
  }, [isThisShellFocused]);

  const shouldShowFocusHint =
    isThisShellFocusable && (showFocusHint || userHasFocused);

  return { shouldShowFocusHint };
}

/**
 * Component to render the focus hint.
 */
export const FocusHint: React.FC<{
  shouldShowFocusHint: boolean;
  isThisShellFocused: boolean;
}> = ({ shouldShowFocusHint, isThisShellFocused }) => {
  if (!shouldShowFocusHint) {
    return null;
  }

  return (
    <Box marginLeft={1} flexShrink={0}>
      <Text color={isThisShellFocused ? theme.ui.focus : theme.ui.active}>
        {isThisShellFocused
          ? `(${formatCommand(Command.UNFOCUS_SHELL_INPUT)} to unfocus)`
          : `(${formatCommand(Command.FOCUS_SHELL_INPUT)} to focus)`}
      </Text>
    </Box>
  );
};

export type TextEmphasis = 'high' | 'medium' | 'low';

type ToolStatusIndicatorProps = {
  status: CoreToolCallStatus;
  name: string;
  isFocused?: boolean;
};

export const ToolStatusIndicator: React.FC<ToolStatusIndicatorProps> = ({
  status: coreStatus,
  name,
  isFocused,
}) => {
  const status = mapCoreStatusToDisplayStatus(coreStatus);
  const isShell = isShellTool(name);

  const color = React.useMemo(() => {
    if (status === ToolCallStatus.Error) return theme.status.error;
    if (status === ToolCallStatus.Canceled) return theme.text.secondary;
    if (status === ToolCallStatus.Executing) {
      return isFocused
        ? theme.ui.focus
        : isShell
          ? theme.ui.active
          : theme.status.warning;
    }
    if (status === ToolCallStatus.Confirming) {
      return isFocused ? theme.ui.focus : theme.status.warning;
    }
    return theme.status.success;
  }, [status, isFocused, isShell]);

  const ariaLabel = React.useMemo(() => {
    switch (status) {
      case ToolCallStatus.Success:
        return 'Success:';
      case ToolCallStatus.Error:
        return 'Error:';
      case ToolCallStatus.Canceled:
        return 'Canceled:';
      case ToolCallStatus.Confirming:
        return 'Confirming:';
      default:
        return undefined;
    }
  }, [status]);

  return (
    <Box minWidth={STATUS_INDICATOR_WIDTH}>
      <Text color={color} aria-label={ariaLabel}>
        {TOOL_STATUS.SUCCESS}
      </Text>
    </Box>
  );
};

type ToolInfoProps = {
  name: string;
  description: string;
  status: CoreToolCallStatus;
  emphasis: TextEmphasis;
  progressMessage?: string;
  originalRequestName?: string;
  isExpanded?: boolean;
};

export const ToolInfo: React.FC<ToolInfoProps> = ({
  name,
  description,
  status: coreStatus,
  emphasis,
  progressMessage: _progressMessage,
  originalRequestName,
  isExpanded = false,
}) => {
  const status = mapCoreStatusToDisplayStatus(coreStatus);
  const nameColor = React.useMemo<string>(() => {
    switch (emphasis) {
      case 'high':
        return theme.text.primary;
      case 'medium':
        return theme.text.primary;
      case 'low':
        return theme.text.secondary;
      default: {
        const exhaustiveCheck: never = emphasis;
        return exhaustiveCheck;
      }
    }
  }, [emphasis]);

  // Hide description for completed Ask User tools (the result display speaks for itself)
  const isCompletedAskUser = isCompletedAskUserTool(name, status);

  return (
    <Box
      overflow="hidden"
      height={isExpanded ? undefined : 1}
      flexGrow={1}
      flexShrink={1}
    >
      <Text
        strikethrough={status === ToolCallStatus.Canceled}
        wrap={isExpanded ? 'wrap' : 'truncate'}
      >
        <Text color={nameColor} bold>
          {name}
        </Text>
        {originalRequestName && originalRequestName !== name && (
          <Text color={theme.text.secondary} italic>
            {' '}
            (redirection from {originalRequestName})
          </Text>
        )}
        {!isCompletedAskUser && description && (
          <Text color={theme.text.secondary}>
            {'('}
            {description}
            {')'}
          </Text>
        )}
      </Text>
    </Box>
  );
};

export interface McpProgressIndicatorProps {
  progress: number;
  total?: number;
  message?: string;
  barWidth: number;
}

export const McpProgressIndicator: React.FC<McpProgressIndicatorProps> = ({
  progress,
  total,
  message,
  barWidth,
}) => {
  const percentage =
    total && total > 0
      ? Math.min(100, Math.round((progress / total) * 100))
      : null;

  let rawFilled: number;
  if (total && total > 0) {
    rawFilled = Math.round((progress / total) * barWidth);
  } else {
    rawFilled = Math.floor(progress) % (barWidth + 1);
  }

  const filled = Math.max(
    0,
    Math.min(Number.isFinite(rawFilled) ? rawFilled : 0, barWidth),
  );
  const empty = Math.max(0, barWidth - filled);
  const progressBar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={theme.text.accent}>
          {progressBar} {percentage !== null ? `${percentage}%` : `${progress}`}
        </Text>
      </Box>
      {message && (
        <Text color={theme.text.secondary} wrap="truncate">
          {message}
        </Text>
      )}
    </Box>
  );
};

export const TrailingIndicator: React.FC = () => (
  <Text color={theme.text.primary} wrap="truncate">
    {' '}
    ←
  </Text>
);

interface ToolOutputConnectorProps {
  children: React.ReactNode;
  color?: string;
}

export const ToolOutputConnector: React.FC<ToolOutputConnectorProps> = ({
  children,
  color,
}) => (
  <Box flexDirection="row" paddingLeft={STATUS_INDICATOR_WIDTH}>
    <Text color={color ?? theme.text.secondary}>{TOOL_OUTPUT_CONNECTOR} </Text>
    {children}
  </Box>
);
