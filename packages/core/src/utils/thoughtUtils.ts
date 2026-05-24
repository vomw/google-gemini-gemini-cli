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
 * including punctuation and fullwidth forms. These are non-Latin scripts
 * that can sometimes appear in model thoughts even when the user's language
 * is English, causing display issues.
 *
 * Note: This is an intentional trade-off. Stripping CJK characters may affect
 * CJK-speaking users, but model thoughts are typically internal/auxiliary text
 * shown alongside primary output, and CJK fragments in an otherwise English
 * thought cause visual noise. Code snippets containing CJK are unaffected
 * because they are not rendered via parseThought.
 *
 * Matches the following Unicode ranges:
 * - U+3000–U+303F: CJK Symbols and Punctuation
 * - U+3400–U+4DBF: CJK Unified Ideographs Extension A
 * - U+4E00–U+9FFF: CJK Unified Ideographs
 * - U+F900–U+FAFF: CJK Compatibility Ideographs
 * - U+3040–U+309F: Hiragana (Japanese)
 * - U+30A0–U+30FF: Katakana (Japanese)
 * - U+AC00–U+D7AF: Hangul Syllables (Korean)
 * - U+FF00–U+FFEF: Halfwidth and Fullwidth Forms
 */
const CJK_CHARS_REGEX =
  /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\uFF00-\uFFEF]/gu;

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
