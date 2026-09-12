import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=%2Fonboarding')
  }
  return <OnboardingFlow />
}
