import { Commit } from './Commit';
import { Tag } from './Tag';

export interface GitLogInfo {
  commits: Commit[];
  tags: Tag[];
}
