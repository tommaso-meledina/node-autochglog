import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeAutoChglogConfig } from '../../config/NodeAutochglogConfig';

const execMock = vi.hoisted(() => vi.fn());

vi.mock('node:util', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    default: {
      ...(actual.default as Record<string, unknown>),
      promisify: () => execMock
    }
  };
});

import { getGitLogInfo } from '../git-parser';

const makeConfig = (): NodeAutoChglogConfig => ({
  tagFilter: '^\\d+\\.\\d+\\.\\d+$',
  initialTag: 'Unreleased',
  templateLocation: '',
  targetBranch: 'main',
  outputFilepath: 'CHANGELOG.md',
  allowedCategories: [
    { key: 'feat', label: 'Features' },
    { key: 'fix', label: 'Fixes' }
  ],
  stripPRNumbers: false
});

const setupExecMock = (messages: string) => {
  const ids = messages
    .split('\n')
    .map((_, i) => `abc${i}`)
    .join('\n');
  const dates = messages
    .split('\n')
    .map(() => '2025-01-15 10:00:00 +0000')
    .join('\n');

  let callIndex = 0;
  const order = [ids, dates, messages, '', ''];
  execMock.mockImplementation(() => {
    const stdout = order[callIndex++] ?? '';
    return Promise.resolve({ stdout, stderr: '' });
  });
};

describe('commit message parsing with colons in description', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly parses category and message when description contains colons', async () => {
    setupExecMock('feat: add support for http: protocol');
    const result = await getGitLogInfo(makeConfig());

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0].category).toBe('feat');
    expect(result.commits[0].message).toBe('add support for http: protocol');
  });

  it('correctly parses scoped conventional commits', async () => {
    setupExecMock('fix(auth): handle edge case');
    const result = await getGitLogInfo(makeConfig());

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0].category).toBe('fix(auth)');
    expect(result.commits[0].message).toBe('handle edge case');
  });
});
