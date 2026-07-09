export {
  getTenantFromRequest,
  requireTenantFromRequest,
  getTenantFromSlug,
  TENANT_HEADER,
  TENANT_HOST_HEADER,
} from './server'
export {
  withTenantResolution,
  resolveTenantFromRequest,
  type TenantMiddlewareOptions,
} from './middleware'
export {
  lookupTenantByHost,
  lookupTenantBySlug,
  listTenants,
  isPlatformHost,
} from './registry'