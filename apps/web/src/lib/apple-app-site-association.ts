/** Apple Universal Links for the native iOS / iPad client. */

export const BEVEL_IOS_APP_ID = '8A36CUVEDS.com.derozic.bevel.bevelApp'

export const APPLE_APP_SITE_ASSOCIATION = {
  applinks: {
    apps: [] as string[],
    details: [
      {
        appID: BEVEL_IOS_APP_ID,
        paths: [
          '/~*',
          '/talk',
          '/talk/*',
          '/session/*',
          '/me',
          '/me/*',
          '/timeline',
          '/login',
          '/login/*',
          '/welcome',
        ],
      },
    ],
  },
  webcredentials: {
    apps: [BEVEL_IOS_APP_ID],
  },
} as const

export function appleAppSiteAssociationBody(): string {
  return JSON.stringify(APPLE_APP_SITE_ASSOCIATION)
}
