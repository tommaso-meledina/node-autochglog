import { Category } from './Category';
import { Scope } from './Scope';

export interface Release {
  name: string;
  scopes: Scope[];
  categories: Category[];
  date: Date;
  actualTag: boolean;
}
