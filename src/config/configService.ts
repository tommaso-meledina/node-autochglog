import { join } from 'path';
import {
  CustomNodeAutoChglogConfig,
  NodeAutoChglogConfig
} from './NodeAutochglogConfig';
import { readFileSync } from 'fs';

const getCustomConfig: () => CustomNodeAutoChglogConfig | null = () => {
  try {
    return JSON.parse(
      readFileSync(join(process.cwd(), 'node-autochglog.config.json'), 'utf-8')
    );
  } catch (e) {
    console.info(`Custom config was not loaded (${e})`);
    return null;
  }
};

const processConfig: (
  inputConfig: NodeAutoChglogConfig
) => NodeAutoChglogConfig = (inputConfig: NodeAutoChglogConfig) => {
  return {
    ...inputConfig,
    outputFilepath: join(process.cwd(), inputConfig.outputFilepath),
    templateLocation: inputConfig.templateLocation
      ? join(process.cwd(), inputConfig.templateLocation)
      : join(__dirname, 'DEFAULT_TEMPLATE.mustache')
  };
};

export const getRuntimeConfig: () => NodeAutoChglogConfig = () => {
  const customConfig = getCustomConfig();
  return processConfig({
    ...defaultConfig,
    ...customConfig
  });
};

const defaultConfig: NodeAutoChglogConfig = {
  tagFilter:
    '^\\d+\\.\\d+\\.\\d+(?:-[\\da-zA-Z\\-\\.]+)?(?:\\+[\\da-zA-Z\\-\\.]+)?$',
  initialTag: 'Unreleased',
  templateLocation: '',
  targetBranch: 'develop',
  outputFilepath: join('CHANGELOG.md'),
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
