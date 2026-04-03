import { Release } from './Release';

export interface Changelog {
  scopesEnabled: boolean;
  releases: Release[];
}
