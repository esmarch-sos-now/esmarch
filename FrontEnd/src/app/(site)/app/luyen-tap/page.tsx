import type { Metadata } from 'next'
import PracticeScreen from '@/components/site/stroke-practice/practice-screen'

export const metadata: Metadata = { title: 'Luyện tập tránh đột quỵ – SOS NOW' }

export default function Page() {
  return <PracticeScreen />
}
