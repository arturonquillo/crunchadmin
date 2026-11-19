const DEFAULT_GRAPH = "v22.0";

export const META_SCOPES = ["ads_read", "ads_management"] as const;

export function getMetaAppId(): string | null {
  const v = process.env.META_APP_ID?.trim();
  return v || null;
}

export function getMetaAppSecret(): string | null {
  const v = process.env.META_APP_SECRET?.trim();
  return v || null;
}

export function getGraphApiVersion(): string {
  return process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH;
}

export function getAppBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function getMetaRedirectUri(): string {
  return `${getAppBaseUrl()}/api/ads/oauth/callback`;
}

export function getOAuthStateSecret(): string {
  return (
    process.env.META_OAUTH_STATE_SECRET?.trim() ||
    getMetaAppSecret() ||
    "crunchadmin-dev-oauth-state"
  );
}

/** Real OAuth only when both App ID and Secret are present. Never invent them. */
export function isMetaConfigured(): boolean {
  return Boolean(getMetaAppId() && getMetaAppSecret());
}

export function metaSetupHints(): string[] {
  const hints: string[] = [];
  if (!getMetaAppId()) hints.push("Falta META_APP_ID (Cursor Secrets / Hostinger .env).");
  if (!getMetaAppSecret())
    hints.push("Falta META_APP_SECRET (Cursor Secrets / Hostinger .env — nunca en git).");
  hints.push(
    `Redirect OAuth en Meta App: ${getMetaRedirectUri()}`
  );
  hints.push(
    "Scopes: ads_read, ads_management. En Development Mode el usuario debe ser rol del app y tener acceso a la cuenta publicitaria."
  );
  hints.push(
    "Hostinger: /opt/crunchadmin/.env → systemctl restart crunchadmin. Ver docs/ads-hostinger-deploy.md."
  );
  return hints;
}
