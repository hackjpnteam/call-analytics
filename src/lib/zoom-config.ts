import type { ZoomApiConfig } from '@/lib/zoom-phone';

export function getZoomConfigFromEnv(): ZoomApiConfig | null {
  const accountId = process.env.ZOOM_ACCOUNT_ID?.trim();
  const clientId = process.env.ZOOM_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOOM_CLIENT_SECRET?.trim();

  if (!accountId || !clientId || !clientSecret) {
    return null;
  }

  return { accountId, clientId, clientSecret };
}

export function getZoomConfigFromTenant(
  tenant?: {
    zoomPhoneConfig?: {
      accountId?: string;
      clientId?: string;
      clientSecret?: string;
    };
  } | null
): ZoomApiConfig | null {
  if (
    tenant?.zoomPhoneConfig?.accountId &&
    tenant.zoomPhoneConfig.clientId &&
    tenant.zoomPhoneConfig.clientSecret
  ) {
    return {
      accountId: tenant.zoomPhoneConfig.accountId,
      clientId: tenant.zoomPhoneConfig.clientId,
      clientSecret: tenant.zoomPhoneConfig.clientSecret,
    };
  }

  return getZoomConfigFromEnv();
}
