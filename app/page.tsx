import { StudentPortal } from '@/components/portal/student-portal'
import { getProgrammes } from '@/app/actions/portal'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const programmes = await getProgrammes()
  return <StudentPortal programmes={programmes} />
}
