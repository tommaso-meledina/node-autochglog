import { describe, it, expect } from 'vitest';
import {
  organizeCommitsByCategory,
  organizeCommitsByTags,
  organizeCommitsByTagsAndCategories,
  buildChangelogMetadata
} from '../util';
import { Commit } from '../../model/Commit';
import { GitLogInfo } from '../../model/GitLogInfo';
import { Tag } from '../../model/Tag';
import { NodeAutoChglogConfig } from '../../config/NodeAutochglogConfig';

const makeCommit = (
  overrides: Partial<Commit> & { message: string; category: string }
): Commit => ({
  id: 'abc1234',
  date: new Date('2025-01-15'),
  ...overrides
});

const makeConfig = (
  overrides?: Partial<NodeAutoChglogConfig>
): NodeAutoChglogConfig => ({
  tagFilter: '^\\d+\\.\\d+\\.\\d+$',
  initialTag: 'Unreleased',
  templateLocation: '',
  targetBranch: 'main',
  outputFilepath: 'CHANGELOG.md',
  allowedCategories: [
    { key: 'feat', label: 'Features' },
    { key: 'fix', label: 'Fixes' },
    { key: 'refactor', label: 'Refactoring' }
  ],
  stripPRNumbers: false,
  ...overrides
});

describe('organizeCommitsByCategory', () => {
  it('returns an empty record for an empty array', () => {
    expect(organizeCommitsByCategory([])).toEqual({});
  });

  it('groups a single commit under its category', () => {
    const commit = makeCommit({ category: 'feat', message: 'add button' });
    const result = organizeCommitsByCategory([commit]);
    expect(Object.keys(result)).toEqual(['feat']);
    expect(result['feat']).toEqual([commit]);
  });

  it('groups multiple commits of the same category together', () => {
    const c1 = makeCommit({ category: 'fix', message: 'fix typo' });
    const c2 = makeCommit({ category: 'fix', message: 'fix crash' });
    const result = organizeCommitsByCategory([c1, c2]);
    expect(result['fix']).toEqual([c1, c2]);
  });

  it('separates commits of different categories', () => {
    const c1 = makeCommit({ category: 'feat', message: 'add button' });
    const c2 = makeCommit({ category: 'fix', message: 'fix crash' });
    const c3 = makeCommit({ category: 'feat', message: 'add modal' });
    const result = organizeCommitsByCategory([c1, c2, c3]);
    expect(Object.keys(result).sort()).toEqual(['feat', 'fix']);
    expect(result['feat']).toEqual([c1, c3]);
    expect(result['fix']).toEqual([c2]);
  });
});

describe('organizeCommitsByTags', () => {
  it('assigns all commits to initialTag when there are no tags', () => {
    const commits = [
      makeCommit({
        category: 'feat',
        message: 'first',
        date: new Date('2025-01-10')
      })
    ];
    const gitLogInfo: GitLogInfo = { commits, tags: [] };
    const config = makeConfig();
    const result = organizeCommitsByTags(gitLogInfo, config);
    expect(Object.keys(result)).toEqual(['Unreleased']);
    expect(result['Unreleased']).toHaveLength(1);
  });

  it('assigns commits before a tag to that tag', () => {
    const commits = [
      makeCommit({
        category: 'feat',
        message: 'a',
        date: new Date('2025-01-05')
      }),
      makeCommit({
        category: 'fix',
        message: 'b',
        date: new Date('2025-01-08')
      })
    ];
    const tags: Tag[] = [{ name: '1.0.0', date: new Date('2025-01-10') }];
    const gitLogInfo: GitLogInfo = { commits, tags };
    const config = makeConfig();
    const result = organizeCommitsByTags(gitLogInfo, config);
    expect(Object.keys(result)).toEqual(['1.0.0']);
    expect(result['1.0.0']).toHaveLength(2);
  });

  it('distributes commits across multiple tags', () => {
    const commits = [
      makeCommit({
        category: 'feat',
        message: 'a',
        date: new Date('2025-01-03')
      }),
      makeCommit({
        category: 'fix',
        message: 'b',
        date: new Date('2025-01-07')
      }),
      makeCommit({
        category: 'feat',
        message: 'c',
        date: new Date('2025-01-12')
      })
    ];
    const tags: Tag[] = [
      { name: '1.0.0', date: new Date('2025-01-05') },
      { name: '2.0.0', date: new Date('2025-01-10') }
    ];
    const gitLogInfo: GitLogInfo = { commits, tags };
    const config = makeConfig();
    const result = organizeCommitsByTags(gitLogInfo, config);
    expect(result['1.0.0']).toHaveLength(1);
    expect(result['2.0.0']).toHaveLength(1);
    expect(result['Unreleased']).toHaveLength(1);
  });

  it('assigns commits newer than all tags to initialTag', () => {
    const commits = [
      makeCommit({
        category: 'feat',
        message: 'new',
        date: new Date('2025-02-01')
      })
    ];
    const tags: Tag[] = [{ name: '1.0.0', date: new Date('2025-01-10') }];
    const gitLogInfo: GitLogInfo = { commits, tags };
    const config = makeConfig();
    const result = organizeCommitsByTags(gitLogInfo, config);
    expect(result['Unreleased']).toHaveLength(1);
    expect(result['1.0.0']).toBeUndefined();
  });
});

describe('organizeCommitsByTagsAndCategories', () => {
  it('nests categories within tags', () => {
    const commits = [
      makeCommit({
        category: 'feat',
        message: 'a',
        date: new Date('2025-01-03')
      }),
      makeCommit({
        category: 'fix',
        message: 'b',
        date: new Date('2025-01-04')
      })
    ];
    const tags: Tag[] = [{ name: '1.0.0', date: new Date('2025-01-10') }];
    const gitLogInfo: GitLogInfo = { commits, tags };
    const config = makeConfig();
    const result = organizeCommitsByTagsAndCategories(gitLogInfo, config);
    expect(result['1.0.0']).toBeDefined();
    expect(result['1.0.0']['feat']).toHaveLength(1);
    expect(result['1.0.0']['fix']).toHaveLength(1);
  });
});

describe('buildChangelogMetadata', () => {
  const tags: Tag[] = [
    { name: '1.0.0', date: new Date('2025-01-10') },
    { name: '2.0.0', date: new Date('2025-02-10') }
  ];

  it('creates releases sorted by date descending', () => {
    const data: Record<string, Record<string, Commit[]>> = {
      '1.0.0': {
        feat: [makeCommit({ category: 'feat', message: 'a' })]
      },
      '2.0.0': {
        fix: [makeCommit({ category: 'fix', message: 'b' })]
      }
    };
    const config = makeConfig();
    const result = buildChangelogMetadata(data, tags, config);
    expect(result.releases[0].name).toBe('2.0.0');
    expect(result.releases[1].name).toBe('1.0.0');
  });

  it('filters out categories not in allowedCategories', () => {
    const data: Record<string, Record<string, Commit[]>> = {
      '1.0.0': {
        feat: [makeCommit({ category: 'feat', message: 'a' })],
        chore: [makeCommit({ category: 'chore', message: 'cleanup' })]
      }
    };
    const config = makeConfig();
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.categories).toHaveLength(1);
    expect(release.categories[0].key).toBe('feat');
  });

  it('uses label from allowedCategories when available', () => {
    const data: Record<string, Record<string, Commit[]>> = {
      '1.0.0': {
        feat: [makeCommit({ category: 'feat', message: 'a' })]
      }
    };
    const config = makeConfig();
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.categories[0].name).toBe('Features');
  });

  it('falls back to key when label is absent', () => {
    const data: Record<string, Record<string, Commit[]>> = {
      '1.0.0': {
        docs: [makeCommit({ category: 'docs', message: 'update readme' })]
      }
    };
    const config = makeConfig({
      allowedCategories: [{ key: 'docs' }]
    });
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.categories[0].name).toBe('docs');
  });

  it('marks initialTag releases with actualTag=false', () => {
    const data: Record<string, Record<string, Commit[]>> = {
      Unreleased: {
        feat: [makeCommit({ category: 'feat', message: 'a' })]
      },
      '1.0.0': {
        feat: [makeCommit({ category: 'feat', message: 'b' })]
      }
    };
    const config = makeConfig();
    const result = buildChangelogMetadata(data, tags, config);
    const unreleased = result.releases.find((r) => r.name === 'Unreleased')!;
    const tagged = result.releases.find((r) => r.name === '1.0.0')!;
    expect(unreleased.actualTag).toBe(false);
    expect(tagged.actualTag).toBe(true);
  });
});
