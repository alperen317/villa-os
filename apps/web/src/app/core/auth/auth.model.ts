export type UserRole = 'Administrator' | 'Operations' | 'Accounting' | 'Housekeeping';

// No TokenPair: tokens are never sent to the browser as data any more — they
// arrive as httpOnly cookies the app cannot read.

export interface CurrentUser {
  sub: string;
  username: string;
  role: UserRole;
}
