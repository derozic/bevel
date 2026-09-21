import { describe, expect, it } from 'vitest'
import {
  APPLE_APP_SITE_ASSOCIATION,
  BEVEL_IOS_APP_ID,
  appleAppSiteAssociationBody,
} from './apple-app-site-association'

describe('apple-app-site-association', () => {
  it('points Universal Links at the signed iOS bundle', () => {
    expect(BEVEL_IOS_APP_ID).toBe('8A36CUVEDS.com.derozic.bevel.bevelApp')
    const paths = APPLE_APP_SITE_ASSOCIATION.applinks.details[0]?.paths ?? []
    expect(paths).toContain('/~*')
    expect(paths).toContain('/talk/*')
    expect(paths).toContain('/me')
    expect(JSON.parse(appleAppSiteAssociationBody()).webcredentials.apps).toEqual(
      [BEVEL_IOS_APP_ID],
    )
  })
})
