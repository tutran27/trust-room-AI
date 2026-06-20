export interface AuthenticatedUser {
  userId: string;
  wallet: string;
}

export interface AuthenticatedRequest {
  user: AuthenticatedUser;
}
