import { FleetHailScreen } from '@/components/error/FleetHailScreen'

export default function NotFound() {
  return (
    <FleetHailScreen
      variant="missing"
      homeHref="/me"
      homeLabel="Private"
    />
  )
}
