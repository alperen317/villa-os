/**
 * Same-origin paths, not absolute URLs. In Docker nginx proxies /api and
 * /uploads to the API container; during `nx serve` the dev-server does the
 * same via apps/web/proxy.conf.json. Keeping these relative means host ports
 * can change without rebuilding the bundle, and no CORS is involved.
 */
export const API_BASE_URL = '/api/v1';

/** Origin the API serves static uploads from (logo, etc.) — empty, since uploads are same-origin. */
export const API_ORIGIN = '';
