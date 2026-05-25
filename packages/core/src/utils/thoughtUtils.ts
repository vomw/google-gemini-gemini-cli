/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type ThoughtSummary = {
  subject: string;
  description: string;
};

const START_DELIMITER = '**';
const END_DELIMITER = '**';

/**
 * Regex matching characters from CJK (Chinese, Japanese, Korean) scripts,
 * including punctuation and fullwidth forms. Uses Unicode Property Escapes
 * for robust coverage across all Unicode planes (including Plane 2+ extensions).
 *
 * Note: This is an intentional trade-off. Stripping CJK characters may affect
 * CJK-speaking users, but model thoughts are typically internal/auxiliary text
 * shown alongside primary output, and CJK fragments in an otherwise English
 * thought cause visual noise. Code snippets containing CJK are unaffected
 * because they are not rendered via parseThought.
 */
const CJK_CHARS_REGEX =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303F\uFF00-\uFFEF]/gu;

/**
 * Parses a raw thought string into a structured ThoughtSummary object.
 *
 * Thoughts are expected to have a bold "subject" part enclosed in double
 * asterisks (e.g., **Subject**). The rest of the string is considered
 * the description. This function only parses the first valid subject found.
 *
 * @param rawText The raw text of the thought.
 * @returns A ThoughtSummary object. If no valid subject is found, the entire
 * string is treated as the description.
 */
export function parseThought(rawText: string): ThoughtSummary {
  const text = rawText.replace(CJK_CHARS_REGEX, '').trim();
  const startIndex = text.indexOf(START_DELIMITER);
  if (startIndex === -1) {
    return { subject: '', description: text };
  }

  const endIndex = text.indexOf(
    END_DELIMITER,
    startIndex + START_DELIMITER.length,
  );
  if (endIndex === -1) {
    return { subject: '', description: text };
  }

  const subject = text
    .substring(startIndex + START_DELIMITER.length, endIndex)
    .trim();

  const description = (
    text.substring(0, startIndex) +
    text.substring(endIndex + END_DELIMITER.length)
  ).trim();

  return { subject, description };
}
