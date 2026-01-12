import { Category } from './Category';

export interface Release {
  name: string;
  categories: Category[];
  date: Date;
  actualTag: boolean;
}
