export interface NodeAutoChglogConfig {
  tagFilter: string;
  initialTag: string;
  templateLocation: string;
  targetBranch: string;
  outputFilepath: string;
  allowedCategories: { key: string; label?: string }[];
  allowedScopes: { key: string; label?: string }[];
  stripPRNumbers: boolean;
  ignoreScope: boolean;
  unscopedLabel: string;
  excludeCommitMessagePattern: string;
}

export interface CustomNodeAutoChglogConfig {
  tagFilter?: string;
  initialTag?: string;
  templateLocation?: string;
  targetBranch?: string;
  outputFilepath?: string;
  allowedCategories?: { key: string; label?: string }[];
  allowedScopes?: { key: string; label?: string }[];
  stripPRNumbers?: boolean;
  ignoreScope?: boolean;
  unscopedLabel?: string;
  excludeCommitMessagePattern?: string;
}

export const defaultConfig: NodeAutoChglogConfig = {
  tagFilter:
    '^\\d+\\.\\d+\\.\\d+(?:-[\\da-zA-Z\\-\\.]+)?(?:\\+[\\da-zA-Z\\-\\.]+)?$',
  initialTag: 'Unreleased',
  templateLocation: '',
  targetBranch: 'develop',
  outputFilepath: 'CHANGELOG.md',
  allowedCategories: [
    {
      key: 'feat',
      label: 'Features'
    },
    {
      key: 'refactor',
      label: 'Refactoring'
    },
    {
      key: 'ci',
      label: 'Integration'
    },
    {
      key: 'fix',
      label: 'Fixes'
    }
  ],
  allowedScopes: [],
  stripPRNumbers: false,
  ignoreScope: false,
  unscopedLabel: 'not scoped',
  excludeCommitMessagePattern: ''
};
