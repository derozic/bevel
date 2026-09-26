'use client'

import type { ReactNode } from 'react'
import { BevelDaypartMark } from '@/components/BevelDaypartMark'

export function LoginBevelFrame({ children }: { children: ReactNode }) {
  return (
    <div className="login-bevel">
      <div className="login-bevel__orbit" aria-hidden />
      <div className="login-bevel__crease" aria-hidden />
      <div className="login-bevel__face">
        <div className="login-bevel__mark">
          <BevelDaypartMark className="h-12 w-12" title="BEVEL" />
        </div>
        {children}
      </div>
    </div>
  )
}
