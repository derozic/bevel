import { redirect } from 'next/navigation'

/** Legacy /settings → DECLI-style console settings shell. */
export default function SettingsRedirectPage() {
  redirect('/console/settings')
}
