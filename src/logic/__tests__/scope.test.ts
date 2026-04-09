import { describe, it, expect } from 'vitest';
import {
  organizeCommitsByScope,
  organizeCommitsByTagsScopesAndCategories,
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
  allowedScopes: [],
  stripPRNumbers: false,
  ignoreScope: false,
  unscopedLabel: 'not scoped',
  excludeCommitMessagePattern: '',
  ...overrides
});

describe('organizeCommitsByScope', () => {
  it('groups all unscoped commits under empty string key', () => {
    const commits = [
      makeCommit({ category: 'feat', message: 'a' }),
      makeCommit({ category: 'fix', message: 'b' })
    ];
    const result = organizeCommitsByScope(commits);
    expect(Object.keys(result)).toEqual(['']);
    expect(result['']).toHaveLength(2);
  });

  it('groups scoped commits under their scope key', () => {
    const commits = [
      makeCommit({ category: 'feat', message: 'a', scope: 'api' }),
      makeCommit({ category: 'fix', message: 'b', scope: 'ui' }),
      makeCommit({ category: 'feat', message: 'c', scope: 'api' })
    ];
    const result = organizeCommitsByScope(commits);
    expect(result['api']).toHaveLength(2);
    expect(result['ui']).toHaveLength(1);
  });

  it('separates scoped and unscoped commits', () => {
    const commits = [
      makeCommit({ category: 'feat', message: 'a', scope: 'api' }),
      makeCommit({ category: 'fix', message: 'b' })
    ];
    const result = organizeCommitsByScope(commits);
    expect(result['api']).toHaveLength(1);
    expect(result['']).toHaveLength(1);
  });
});

describe('organizeCommitsByTagsScopesAndCategories with scope', () => {
  it('groups scoped commits under their scope within a tag', () => {
    const commits = [
      makeCommit({
        category: 'feat',
        message: 'add endpoint',
        scope: 'api',
        date: new Date('2025-01-03')
      }),
      makeCommit({
        category: 'fix',
        message: 'fix button',
        scope: 'ui',
        date: new Date('2025-01-04')
      })
    ];
    const tags: Tag[] = [{ name: '1.0.0', date: new Date('2025-01-10') }];
    const gitLogInfo: GitLogInfo = { commits, tags };
    const config = makeConfig();
    const result = organizeCommitsByTagsScopesAndCategories(gitLogInfo, config);
    expect(result['1.0.0']['api']['feat']).toHaveLength(1);
    expect(result['1.0.0']['ui']['fix']).toHaveLength(1);
  });

  it('places unscoped commits under empty string scope key', () => {
    const commits = [
      makeCommit({
        category: 'feat',
        message: 'add readme',
        date: new Date('2025-01-03')
      })
    ];
    const tags: Tag[] = [{ name: '1.0.0', date: new Date('2025-01-10') }];
    const gitLogInfo: GitLogInfo = { commits, tags };
    const config = makeConfig();
    const result = organizeCommitsByTagsScopesAndCategories(gitLogInfo, config);
    expect(result['1.0.0']['']).toBeDefined();
    expect(result['1.0.0']['']['feat']).toHaveLength(1);
  });

  it('clears scope when ignoreScope is true', () => {
    const commits = [
      makeCommit({
        category: 'feat',
        message: 'add endpoint',
        scope: 'api',
        date: new Date('2025-01-03')
      }),
      makeCommit({
        category: 'fix',
        message: 'fix button',
        scope: 'ui',
        date: new Date('2025-01-04')
      })
    ];
    const tags: Tag[] = [{ name: '1.0.0', date: new Date('2025-01-10') }];
    const gitLogInfo: GitLogInfo = { commits, tags };
    const config = makeConfig({ ignoreScope: true });
    const result = organizeCommitsByTagsScopesAndCategories(gitLogInfo, config);
    expect(Object.keys(result['1.0.0'])).toEqual(['']);
    expect(result['1.0.0']['']['feat']).toHaveLength(1);
    expect(result['1.0.0']['']['fix']).toHaveLength(1);
  });
});

describe('buildChangelogMetadata with scope', () => {
  const tags: Tag[] = [
    { name: '1.0.0', date: new Date('2025-01-10') },
    { name: '2.0.0', date: new Date('2025-02-10') }
  ];

  it('sets scopesEnabled=true when at least one commit has a scope', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add endpoint',
              scope: 'api'
            })
          ]
        },
        '': {
          fix: [makeCommit({ category: 'fix', message: 'fix typo' })]
        }
      }
    };
    const config = makeConfig();
    const result = buildChangelogMetadata(data, tags, config);
    expect(result.scopesEnabled).toBe(true);
  });

  it('sets scopesEnabled=false when no commits have a scope', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        '': {
          feat: [makeCommit({ category: 'feat', message: 'a' })]
        }
      }
    };
    const config = makeConfig();
    const result = buildChangelogMetadata(data, tags, config);
    expect(result.scopesEnabled).toBe(false);
  });

  it('populates scopes array when scopesEnabled is true', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add endpoint',
              scope: 'api'
            })
          ]
        },
        ui: {
          fix: [
            makeCommit({ category: 'fix', message: 'fix button', scope: 'ui' })
          ]
        }
      }
    };
    const config = makeConfig();
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.scopes).toHaveLength(2);
    expect(release.categories).toEqual([]);
  });

  it('populates categories array when scopesEnabled is false', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        '': {
          feat: [makeCommit({ category: 'feat', message: 'a' })],
          fix: [makeCommit({ category: 'fix', message: 'b' })]
        }
      }
    };
    const config = makeConfig();
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.categories).toHaveLength(2);
    expect(release.scopes).toEqual([]);
  });

  it('uses unscopedLabel for commits without a scope', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add endpoint',
              scope: 'api'
            })
          ]
        },
        '': {
          fix: [makeCommit({ category: 'fix', message: 'fix typo' })]
        }
      }
    };
    const config = makeConfig({ unscopedLabel: 'misc' });
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    const unscopedGroup = release.scopes.find((s) => s.name === 'misc');
    expect(unscopedGroup).toBeDefined();
    expect(unscopedGroup!.categories[0].key).toBe('fix');
  });

  it('sorts scopes alphabetically with unscoped last', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        ui: {
          fix: [
            makeCommit({ category: 'fix', message: 'fix button', scope: 'ui' })
          ]
        },
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add endpoint',
              scope: 'api'
            })
          ]
        },
        '': {
          feat: [makeCommit({ category: 'feat', message: 'add readme' })]
        }
      }
    };
    const config = makeConfig();
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.scopes.map((s) => s.name)).toEqual([
      'api',
      'ui',
      'not scoped'
    ]);
  });

  it('filters out scopes with no allowed categories', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add endpoint',
              scope: 'api'
            })
          ]
        },
        ci: {
          chore: [
            makeCommit({
              category: 'chore',
              message: 'update pipeline',
              scope: 'ci'
            })
          ]
        }
      }
    };
    const config = makeConfig();
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.scopes).toHaveLength(1);
    expect(release.scopes[0].name).toBe('api');
  });

  it('applies allowedCategories filter within scopes', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add endpoint',
              scope: 'api'
            })
          ],
          chore: [
            makeCommit({ category: 'chore', message: 'tidy up', scope: 'api' })
          ]
        }
      }
    };
    const config = makeConfig();
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.scopes[0].categories).toHaveLength(1);
    expect(release.scopes[0].categories[0].key).toBe('feat');
  });

  it('uses category labels within scopes', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add endpoint',
              scope: 'api'
            })
          ]
        }
      }
    };
    const config = makeConfig();
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.scopes[0].categories[0].name).toBe('Features');
  });

  it('handles scoped commits across multiple releases', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'v1 endpoint',
              scope: 'api'
            })
          ]
        }
      },
      '2.0.0': {
        ui: {
          fix: [
            makeCommit({
              category: 'fix',
              message: 'fix v2 button',
              scope: 'ui'
            })
          ]
        }
      }
    };
    const config = makeConfig();
    const result = buildChangelogMetadata(data, tags, config);
    expect(result.scopesEnabled).toBe(true);

    const v1 = result.releases.find((r) => r.name === '1.0.0')!;
    expect(v1.scopes).toHaveLength(1);
    expect(v1.scopes[0].name).toBe('api');

    const v2 = result.releases.find((r) => r.name === '2.0.0')!;
    expect(v2.scopes).toHaveLength(1);
    expect(v2.scopes[0].name).toBe('ui');
  });

  it('disables scopes across all releases when ignoreScope is used', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        '': {
          feat: [makeCommit({ category: 'feat', message: 'a' })],
          fix: [makeCommit({ category: 'fix', message: 'b' })]
        }
      }
    };
    const config = makeConfig({ ignoreScope: true });
    const result = buildChangelogMetadata(data, tags, config);
    expect(result.scopesEnabled).toBe(false);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.scopes).toEqual([]);
    expect(release.categories).toHaveLength(2);
  });

  it('uses allowedScopes labels to resolve scope display names', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add endpoint',
              scope: 'api'
            })
          ]
        },
        arch: {
          refactor: [
            makeCommit({
              category: 'refactor',
              message: 'restructure layers',
              scope: 'arch'
            })
          ]
        }
      }
    };
    const config = makeConfig({
      allowedScopes: [
        { key: 'api', label: 'API' },
        { key: 'arch', label: 'Architecture' }
      ]
    });
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.scopes.map((s) => s.name)).toEqual(['API', 'Architecture']);
  });

  it('falls back to scope key when allowedScopes entry has no label', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add endpoint',
              scope: 'api'
            })
          ]
        }
      }
    };
    const config = makeConfig({
      allowedScopes: [{ key: 'api' }]
    });
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.scopes[0].name).toBe('api');
  });

  it('does not apply allowedScopes to the unscoped group', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add endpoint',
              scope: 'api'
            })
          ]
        },
        '': {
          fix: [makeCommit({ category: 'fix', message: 'fix typo' })]
        }
      }
    };
    const config = makeConfig({
      allowedScopes: [{ key: 'api', label: 'API' }],
      unscopedLabel: 'General'
    });
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    const scopeNames = release.scopes.map((s) => s.name);
    expect(scopeNames).toContain('API');
    expect(scopeNames).toContain('General');
  });

  it('sorts labelled scopes alphabetically by resolved name', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        arch: {
          refactor: [
            makeCommit({
              category: 'refactor',
              message: 'restructure',
              scope: 'arch'
            })
          ]
        },
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add endpoint',
              scope: 'api'
            })
          ]
        },
        '': {
          fix: [makeCommit({ category: 'fix', message: 'fix typo' })]
        }
      }
    };
    const config = makeConfig({
      allowedScopes: [
        { key: 'arch', label: 'Architecture' },
        { key: 'api', label: 'API' }
      ]
    });
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.scopes.map((s) => s.name)).toEqual([
      'API',
      'Architecture',
      'not scoped'
    ]);
  });

  it('shows all scopes when allowedScopes is empty', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add endpoint',
              scope: 'api'
            })
          ]
        },
        ui: {
          fix: [
            makeCommit({
              category: 'fix',
              message: 'fix button',
              scope: 'ui'
            })
          ]
        }
      }
    };
    const config = makeConfig({ allowedScopes: [] });
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.scopes).toHaveLength(2);
    expect(release.scopes.map((s) => s.name)).toEqual(['api', 'ui']);
  });

  it('filters out scopes not listed in allowedScopes', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add endpoint',
              scope: 'api'
            })
          ]
        },
        ui: {
          fix: [
            makeCommit({
              category: 'fix',
              message: 'fix button',
              scope: 'ui'
            })
          ]
        },
        ci: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add pipeline',
              scope: 'ci'
            })
          ]
        }
      }
    };
    const config = makeConfig({
      allowedScopes: [
        { key: 'api', label: 'API' },
        { key: 'ui', label: 'User Interface' }
      ]
    });
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.scopes).toHaveLength(2);
    expect(release.scopes.map((s) => s.name)).toEqual([
      'API',
      'User Interface'
    ]);
  });

  it('preserves unscoped group when allowedScopes filters other scopes', () => {
    const data: Record<string, Record<string, Record<string, Commit[]>>> = {
      '1.0.0': {
        api: {
          feat: [
            makeCommit({
              category: 'feat',
              message: 'add endpoint',
              scope: 'api'
            })
          ]
        },
        ui: {
          fix: [
            makeCommit({
              category: 'fix',
              message: 'fix button',
              scope: 'ui'
            })
          ]
        },
        '': {
          fix: [makeCommit({ category: 'fix', message: 'fix typo' })]
        }
      }
    };
    const config = makeConfig({
      allowedScopes: [{ key: 'api', label: 'API' }]
    });
    const result = buildChangelogMetadata(data, tags, config);
    const release = result.releases.find((r) => r.name === '1.0.0')!;
    expect(release.scopes).toHaveLength(2);
    expect(release.scopes.map((s) => s.name)).toEqual(['API', 'not scoped']);
  });
});
