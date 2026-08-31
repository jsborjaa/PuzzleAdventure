import type { Localized } from './messages';

export type { LocaleId, Localized } from './messages';

type DotPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Localized
    ? `${Prefix}${K}`
    : DotPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = DotPaths<typeof import('./messages').messages>;

export type MessageVars = Record<string, string | number>;
