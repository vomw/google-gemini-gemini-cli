/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import type { IndividualToolCallDisplay } from '../../types.js';
import { StickyHeader } from '../StickyHeader.js';
import { ToolResultDisplay } from './ToolResultDisplay.js';
import {
  ToolStatusIndicator,
  ToolInfo,
  ToolOutputConnector,
  TrailingIndicator,
  McpProgressIndicator,
  type TextEmphasis,
  STATUS_INDICATOR_WIDTH,
  isThisShellFocusable as checkIsShellFocusable,
  isThisShellFocused as checkIsShellFocused,
  useFocusHint,
  FocusHint,
} from './ToolShared.js';
import { type Config, CoreToolCallStatus, Kind } from '@google/gemini-cli-core';
import { ShellInputPrompt } from '../ShellInputPrompt.js';
import { SUBAGENT_MAX_LINES } from '../../constants.js';
import { useToolActions } from '../../contexts/ToolActionsContext.js';

export type { TextEmphasis };

export interface ToolMessageProps extends IndividualToolCallDisplay {
  availableTerminalHeight?: number;
  terminalWidth: number;
  emphasis?: TextEmphasis;
  renderOutputAsMarkdown?: boolean;
  isFirst: boolean;
  borderColor: string;
  borderDimColor: boolean;
  activeShellPtyId?: number | null;
  embeddedShellFocused?: boolean;
  ptyId?: number;
  config?: Config;
}

export const ToolMessage: React.FC<ToolMessageProps> = ({
  callId,
  name,
  description,
  resultDisplay,
  status,
  kind,
  availableTerminalHeight,
  terminalWidth,
  emphasis = 'medium',
  renderOutputAsMarkdown = true,
  isFirst,
  borderColor,
  borderDimColor,
  activeShellPtyId,
  embeddedShellFocused,
  ptyId,
  config,
  progressMessage,
  originalRequestName,
  progress,
  progressTotal,
}) => {
  const { isExpanded: isExpandedInContext } = useToolActions();

  const isExpanded =
    (isExpandedInContext ? isExpandedInContext(callId) : false) ||
    availableTerminalHeight === undefined;

  const isThisShellFocused = checkIsShellFocused(
    name,
    status,
    ptyId,
    activeShellPtyId,
    embeddedShellFocused,
  );

  const isThisShellFocusable = checkIsShellFocusable(name, status, config);

  const { shouldShowFocusHint } = useFocusHint(
    isThisShellFocusable,
    isThisShellFocused,
    resultDisplay,
  );

  return (
    // It is crucial we don't replace this <> with a Box because otherwise the
    // sticky header inside it would be sticky to that box rather than to the
    // parent component of this ToolMessage.
    <>
      <StickyHeader
        width={terminalWidth}
        isFirst={isFirst}
        borderColor={borderColor}
        borderDimColor={borderDimColor}
      >
        <ToolStatusIndicator
          status={status}
          name={name}
          isFocused={isThisShellFocused}
        />
        <ToolInfo
          name={name}
          status={status}
          description={description}
          emphasis={emphasis}
          progressMessage={progressMessage}
          originalRequestName={originalRequestName}
          isExpanded={isExpanded}
        />
        <FocusHint
          shouldShowFocusHint={shouldShowFocusHint}
          isThisShellFocused={isThisShellFocused}
        />
        {emphasis === 'high' && <TrailingIndicator />}
      </StickyHeader>
      <Box width={terminalWidth} flexDirection="column">
        {status === CoreToolCallStatus.Executing && progress !== undefined && (
          <ToolOutputConnector>
            <McpProgressIndicator
              progress={progress}
              total={progressTotal}
              message={progressMessage}
              barWidth={20}
            />
          </ToolOutputConnector>
        )}
        {status === CoreToolCallStatus.Executing &&
          !resultDisplay &&
          progress === undefined && (
            <ToolOutputConnector color={borderColor}>
              <Text
                color={borderDimColor ? undefined : borderColor}
                dimColor={borderDimColor}
              >
                Waiting…
              </Text>
            </ToolOutputConnector>
          )}
        {resultDisplay && (
          <ToolOutputConnector color={borderColor}>
            <Box flexDirection="column" flexGrow={1} flexShrink={1}>
              <ToolResultDisplay
                resultDisplay={resultDisplay}
                availableTerminalHeight={availableTerminalHeight}
                terminalWidth={terminalWidth}
                renderOutputAsMarkdown={renderOutputAsMarkdown}
                hasFocus={isThisShellFocused}
                maxLines={
                  kind === Kind.Agent && availableTerminalHeight !== undefined
                    ? SUBAGENT_MAX_LINES
                    : undefined
                }
                overflowDirection={kind === Kind.Agent ? 'bottom' : 'top'}
              />
            </Box>
          </ToolOutputConnector>
        )}
        {isThisShellFocused && config && (
          <Box paddingLeft={STATUS_INDICATOR_WIDTH} marginTop={1}>
            <ShellInputPrompt
              activeShellPtyId={activeShellPtyId ?? null}
              focus={embeddedShellFocused}
            />
          </Box>
        )}
      </Box>
    </>
  );
};
