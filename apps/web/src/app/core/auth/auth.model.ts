export type UserRole = 'Administrator' | 'Operations' | 'Accounting' | 'Housekeeping';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface CurrentUser {
  sub: string;
  username: string;
  role: UserRole;
}
