/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { parseThought } from './thoughtUtils.js';

describe('parseThought', () => {
  it('should strip CJK characters from subject', () => {
    const result = parseThought(
      '**Fixing Worker Environment Variable Inheritance控制** description',
    );
    expect(result.subject).toBe(
      'Fixing Worker Environment Variable Inheritance',
    );
    expect(result.description).toBe('description');
  });

  it('should strip CJK characters from description', () => {
    const result = parseThought(
      '**Subject** Fixing Worker Environment Variable Inheritance控制',
    );
    expect(result.subject).toBe('Subject');
    expect(result.description).toBe(
      'Fixing Worker Environment Variable Inheritance',
    );
  });

  it('should strip CJK characters when no subject delimiter exists', () => {
    const result = parseThought('Some text with控制 characters');
    expect(result.subject).toBe('');
    expect(result.description).toBe('Some text with characters');
  });

  it('should preserve Latin-accented characters', () => {
    const result = parseThought('**Café** déjà vu ñoño');
    expect(result.subject).toBe('Café');
    expect(result.description).toBe('déjà vu ñoño');
  });

  it.each([
    {
      name: 'a standard thought with subject and description',
      rawText: '**Subject:** This is the description.',
      expected: {
        subject: 'Subject:',
        description: 'This is the description.',
      },
    },
    {
      name: 'leading and trailing whitespace in the raw string',
      rawText: '  **Subject** description with spaces   ',
      expected: { subject: 'Subject', description: 'description with spaces' },
    },
    {
      name: 'whitespace surrounding the subject content',
      rawText: '** Subject  **',
      expected: { subject: 'Subject', description: '' },
    },
    {
      name: 'a thought with only a subject',
      rawText: '**Only Subject**',
      expected: { subject: 'Only Subject', description: '' },
    },
    {
      name: 'a thought with only a description (no subject)',
      rawText: 'This is just a description.',
      expected: { subject: '', description: 'This is just a description.' },
    },
    {
      name: 'an empty string input',
      rawText: '',
      expected: { subject: '', description: '' },
    },
    {
      name: 'newlines within the subject and description',
      rawText:
        '**Multi-line\nSubject**\nHere is a description\nspread across lines.',
      expected: {
        subject: 'Multi-line\nSubject',
        description: 'Here is a description\nspread across lines.',
      },
    },
    {
      name: 'only the first subject if multiple are present',
      rawText: '**First** some text **Second**',
      expected: { subject: 'First', description: 'some text **Second**' },
    },
    {
      name: 'text before and after the subject',
      rawText: 'Prefix text **Subject** Suffix text.',
      expected: {
        subject: 'Subject',
        description: 'Prefix text  Suffix text.',
      },
    },
    {
      name: 'an unclosed subject tag',
      rawText: 'Text with **an unclosed subject',
      expected: { subject: '', description: 'Text with **an unclosed subject' },
    },
    {
      name: 'an empty subject tag',
      rawText: 'A thought with **** in the middle.',
      expected: { subject: '', description: 'A thought with  in the middle.' },
    },
  ])('should correctly parse $name', ({ rawText, expected }) => {
    expect(parseThought(rawText)).toEqual(expected);
  });
});
