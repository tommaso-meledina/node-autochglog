import { join } from 'path';

export interface NodeAutoChglogConfig {
  tagFilter: string;
  initialTag: string;
  templateLocation: string;
  targetBranch: string;
  outputFilepath: string;
  allowedCategories: { key: string; label?: string }[];
  stripPRNumbers: boolean;
}

export interface CustomNodeAutoChglogConfig {
  tagFilter?: string;
  initialTag?: string;
  templateLocation?: string;
  targetBranch?: string;
  outputFilepath?: string;
  allowedCategories?: { key: string; label?: string }[];
  stripPRNumbers?: boolean;
}

export const defaultConfig: NodeAutoChglogConfig = {
  tagFilter:
    '^\\d+\\.\\d+\\.\\d+(?:-[\\da-zA-Z\\-\\.]+)?(?:\\+[\\da-zA-Z\\-\\.]+)?$',
  initialTag: 'Unreleased',
  templateLocation: join(__dirname, 'DEFAULT_TEMPLATE.mustache'),
  targetBranch: 'develop',
  outputFilepath: join(process.cwd(), 'CHANGELOG.md'),
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
  stripPRNumbers: false
};
