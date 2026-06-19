import type { OAuthProvider } from '@port0/shared';

export interface OAuthProfile {
  provider: OAuthProvider;
  sub: string;
  displayHandle?: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
}

function requireConfig(provider: OAuthProvider): OAuthConfig {
  if (provider === 'github') {
    const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
    const clientSecret = process.env.OAUTH_GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('GitHub OAuth is not configured');
    }
    return { clientId, clientSecret };
  }
  const clientId = process.env.OAUTH_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth is not configured');
  }
  return { clientId, clientSecret };
}

export async function exchangeCode(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
): Promise<OAuthProfile> {
  const config = requireConfig(provider);
  if (provider === 'github') {
    return exchangeGitHub(config, code, redirectUri);
  }
  return exchangeGoogle(config, code, redirectUri);
}

async function exchangeGitHub(
  config: OAuthConfig,
  code: string,
  redirectUri: string,
): Promise<OAuthProfile> {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error ?? 'GitHub token exchange failed');
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: 'application/json',
      'User-Agent': 'Port0-Auth',
    },
  });
  const user = (await userRes.json()) as { id?: number; login?: string };
  if (!userRes.ok || user.id === undefined) {
    throw new Error('GitHub user fetch failed');
  }

  return {
    provider: 'github',
    sub: String(user.id),
    displayHandle: user.login,
  };
}

async function exchangeGoogle(
  config: OAuthConfig,
  code: string,
  redirectUri: string,
): Promise<OAuthProfile> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error ?? 'Google token exchange failed');
  }

  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const user = (await userRes.json()) as { sub?: string; name?: string; email?: string };
  if (!userRes.ok || !user.sub) {
    throw new Error('Google user fetch failed');
  }

  return {
    provider: 'google',
    sub: user.sub,
    displayHandle: user.name ?? user.email,
  };
}

export function getOAuthAuthorizeUrl(provider: OAuthProvider, redirectUri: string, state: string): string {
  const config = requireConfig(provider);
  if (provider === 'github') {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: 'read:user',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
