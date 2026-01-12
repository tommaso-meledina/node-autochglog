#!/usr/bin/env node

import 'source-map-support/register';

import { getGitLogInfo } from './logic/git-parser';
import {
  buildChangelogMetadata,
  organizeCommitsByTagsAndCategories
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
          organizeCommitsByTagsAndCategories(gitLogInfo, config),
          gitLogInfo.tags,
          config
        )
      )
    );
    console.info(`DONE! Output written to ${config.outputFilepath}`);
  } catch (error) {
    try {
      const parsedError = error as { message: string };
      console.warn(parsedError.message || FALLBACK_ERROR_MESSAGE);
    } catch (parsingError) {
      console.warn(`Could not parse error: ${parsingError}`);
      console.error(JSON.stringify(error) || FALLBACK_ERROR_MESSAGE);
    }
    throw error;
  }
};

main();
