export interface JwtPayload {
  id: string;
  jti?: string; // Session ID único - opcional para backwards compatibility
}
