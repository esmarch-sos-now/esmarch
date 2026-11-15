export type GuideId = 'face' | 'arms' | 'speech'

const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

function Portrait({ speaking }: { speaking?: boolean }) {
  return (
    <g {...line}>
      <path d="M108 168c2-70 28-108 62-108s60 38 62 108" />
      <path d="M108 168c4 58 30 96 62 96s58-38 62-96" />
      <path d="M124 156c8-12 20-12 28 0" />
      <path d="M188 156c8-12 20-12 28 0" />
      <path d="M170 174v16" />
      {speaking
        ? <ellipse cx="170" cy="208" rx="12" ry="8" />
        : <path d="M140 206c12 18 24 24 30 24s18-6 30-24" />}
      <path d="M154 262C148 304 108 328 62 356" />
      <path d="M186 262C192 304 232 328 278 356" />
    </g>
  )
}

function ArmsPose() {
  return (
    <g {...line}>
      <circle cx="160" cy="62" r="26" />
      <path d="M148 86c-2 16-6 24-14 28" />
      <path d="M172 86c2 16 6 24 14 28" />
      <path d="M134 116c-28-6-62 2-86 22" />
      <path d="M48 138c6 10 16 12 24 4" />
      <path d="M186 116c28-6 62 2 86 22" />
      <path d="M272 138c-6 10-16 12-24 4" />
      <path d="M134 118c-4 36-8 78-2 112 4 22 16 32 28 32s24-10 28-32c6-34 2-76-2-112" />
      <path d="M148 258c-6 36-16 78-24 112" />
      <path d="M172 258c6 36 16 78 24 112" />
      <path d="M116 366c8 8 16 8 22-2" />
      <path d="M204 366c-8 8-16 8-22-2" />
    </g>
  )
}

function SpeechWaves() {
  return (
    <g {...line}>
      <path d="M250 138c14 12 14 46 0 58" />
      <path d="M266 120c20 18 20 76 0 94" />
      <path d="M282 102c26 24 26 104 0 128" />
    </g>
  )
}

export function PoseOutline({ id }: { id: GuideId }) {
  return (
    <svg className="practice-silhouette" viewBox="0 0 320 420" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {id === 'arms' ? <ArmsPose /> : <Portrait speaking={id === 'speech'} />}
      {id === 'speech' ? <SpeechWaves /> : null}
    </svg>
  )
}

export function PoseThumb({ id }: { id: GuideId }) {
  return (
    <svg className="practice-thumb-art" viewBox="0 0 320 420" aria-hidden="true">
      {id === 'arms' ? <ArmsPose /> : <Portrait speaking={id === 'speech'} />}
      {id === 'speech' ? <SpeechWaves /> : null}
    </svg>
  )
}
