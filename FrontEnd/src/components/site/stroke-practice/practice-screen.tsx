'use client'

import { useState } from 'react'
import AppNav from '@/components/site/app-nav'
import { Page } from '@/components/site/primitives'
import { strokePractice } from '@/content/stroke-practice'
import CameraDrill from './camera-drill'
import DailyPractice from './daily-practice'
import type { SavedDrill } from './day-log'

export default function PracticeScreen() {
  const { fast } = strokePractice
  const [drill, setDrill] = useState<SavedDrill | null>(null)

  return (
    <Page>
      <AppNav />
      <main className="mx-auto min-h-[calc(100svh-152px)] w-full max-w-205 px-4 pt-10 pb-16 max-lg:min-h-[calc(100svh-140px)]">
        <h1 className="text-[clamp(30px,4vw,44px)] leading-[1.15] font-black tracking-[-.01em] text-ink">{strokePractice.title}</h1>
        <p className="mt-3 max-w-160 text-[17px] leading-[1.6] text-muted-foreground">{strokePractice.lede}</p>

        <DailyPractice drill={drill} />
        <CameraDrill onComplete={setDrill} />

        <section className="mt-10" aria-labelledby="practice-fast">
          <h2 id="practice-fast" className="text-[clamp(22px,3vw,28px)] leading-tight font-extrabold text-ink">{fast.title}</h2>
          <p className="mt-2 max-w-160 text-base leading-[1.6] text-muted-foreground">{fast.intro}</p>
          <ol className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">
            {fast.steps.map((step) => (
              <li key={step.letter} className="grid grid-cols-[42px_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-line bg-paper p-4">
                <strong aria-hidden="true" className="grid size-10.5 place-items-center rounded-full bg-brand-soft text-base font-extrabold text-brand">{step.letter}</strong>
                <div>
                  <h3 className="text-base leading-snug font-extrabold text-ink">{step.title}</h3>
                  <p className="mt-1 text-sm leading-normal text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3.5 rounded-xl bg-[#fff8e8] px-3.5 py-3 text-sm leading-normal font-semibold text-[#6d4a00]">{fast.avoid}</p>
        </section>

        <p className="mt-10 border-t border-line pt-4 text-sm text-muted-foreground">
          Trong nguy hiểm tính mạng, hãy gọi ngay <a className="font-bold text-brand" href="tel:115">115</a>.
        </p>
      </main>
    </Page>
  )
}
