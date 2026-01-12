import { Commit } from './Commit';

export interface Category {
  key: string;
  name: string;
  commits: Commit[];
}
