#!/usr/bin/env node

import 'source-map-support/register';

import { getGitLogInfo } from './logic/git-parser';
import {
  buildChangelogMetadata,
  organizeCommitsByTagsScopesAndCategories
} from './logic/util';
import { FALLBACK_ERROR_MESSAGE } from './messages';

import fs from 'fs';
import Mustache from 'mustache';
import { getRuntimeConfig } from './config/configService';

const main = async () => {
  const config = getRuntimeConfig();

  try {
    const gitLogInfo = await getGitLogInfo(config);
    fs.writeFileSync(
      config.outputFilepath,
      Mustache.render(
        fs.readFileSync(config.templateLocation, 'utf-8'),
        buildChangelogMetadata(
          organizeCommitsByTagsScopesAndCategories(gitLogInfo, config),
          gitLogInfo.tags,
          config
        )
      )
    );
    console.info(`DONE! Output written to ${config.outputFilepath}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : FALLBACK_ERROR_MESSAGE;
    console.error(message);
    throw error;
  }
};

main();
