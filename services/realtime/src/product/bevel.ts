/** Keep in sync with packages/realtime-client/src/product/bevel.ts */

export const BEVEL_WORD = 'BEVEL' as const
export const BEVEL_TM = '™' as const
export const BEVEL_NAME = `${BEVEL_WORD}${BEVEL_TM}` as const
export const BEVEL_POWERED_BY_LABEL = `Powered by ${BEVEL_NAME}` as const
export const BEVEL_TRADEMARK_NOTICE = `${BEVEL_NAME} · Trademark by use` as const
