'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { strokePractice } from '@/content/stroke-practice'
import { PoseOutline, PoseThumb, type GuideId } from './pose-frames'
import {
  FACE_MIN_SAMPLES,
  FACE_UNEVEN_RATIO,
  armSample,
  mouthCornerRatio,
  scoreArms,
  scoreDeltas,
  scoreSpeech,
  summarizeDrill,
  buildReport,
  type ArmSample,
  type DrillSummary,
  type GestureVerdict,
  type SpeechVerdict
} from './score'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm'
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
const COUNTDOWN = [3, 2, 1] as const
const SAMPLE_MS = 4000

type Phase = 'idle' | 'preparing' | 'countdown' | 'face' | 'arms' | 'speech' | 'done' | 'error'
type SpeechStep = SpeechVerdict | 'skipped'

type DrillResult = {
  face: GestureVerdict
  arms: GestureVerdict
  speech: SpeechStep
  summary: DrillSummary
}

class DrillError extends Error {
  constructor(readonly kind: 'denied' | 'model') {
    super(kind)
  }
}

type BrowserSpeech = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

function speechCtor(): (new () => BrowserSpeech) | null {
  const host = window as Window & {
    SpeechRecognition?: new () => BrowserSpeech
    webkitSpeechRecognition?: new () => BrowserSpeech
  }
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new DrillError('denied')
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    })
  } catch {
    throw new DrillError('denied')
  }
}

const MODEL_NOISE = /XNNPACK|TensorFlow Lite|inference_feedback_manager|OpenGL error checking|FaceBlendshapesGraph|NORM_RECT|gl_context/

function isModelNoise(args: unknown[]) {
  return MODEL_NOISE.test(args.map((item) => (typeof item === 'string' ? item : '')).join(' '))
}

function quietModelLogs() {
  const error = console.error
  const warn = console.warn
  console.error = (...args: unknown[]) => {
    if (!isModelNoise(args)) error(...args)
  }
  console.warn = (...args: unknown[]) => {
    if (!isModelNoise(args)) warn(...args)
  }
  return () => {
    console.error = error
    console.warn = warn
  }
}

async function loadModels() {
  try {
    const { FaceLandmarker, FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
    const fileset = await FilesetResolver.forVisionTasks(WASM)
    const face = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 1
    })
    try {
      const pose = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1
      })
      return { face, pose }
    } catch (error) {
      face.close()
      throw error
    }
  } catch (error) {
    if (error instanceof DrillError) throw error
    throw new DrillError('model')
  }
}

function failureCopy(error: unknown) {
  const { camera } = strokePractice
  if (error instanceof DrillError) return error.kind === 'denied' ? camera.denied : camera.modelError
  return camera.genericError
}

function verdictTone(value: string) {
  if (value === 'even' || value === 'heard') return 'text-[#1f7a4d]'
  if (value === 'uneven') return 'text-brand'
  return 'text-[#8a5a00]'
}

export default function CameraDrill({ onComplete }: { onComplete?: (result: DrillResult) => void }) {
  const { camera } = strokePractice
  const videoRef = useRef<HTMLVideoElement>(null)
  const runId = useRef(0)
  const recognitionRef = useRef<BrowserSpeech | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(3)
  const [remain, setRemain] = useState(0)
  const [prompt, setPrompt] = useState(camera.facePrompt)
  const [guide, setGuide] = useState<GuideId | null>(null)
  const [preview, setPreview] = useState<GuideId>('face')
  const [status, setStatus] = useState('')
  const [result, setResult] = useState<DrillResult | null>(null)

  const stopStream = () => {
    const video = videoRef.current
    const stream = video?.srcObject
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop())
    if (video) video.srcObject = null
  }

  const stopRecognition = () => {
    try {
      recognitionRef.current?.stop()
    } catch {
      // The recognizer may already be stopped.
    }
    recognitionRef.current = null
  }

  useEffect(() => () => {
    runId.current += 1
    stopStream()
    stopRecognition()
  }, [])

  const alive = (id: number) => runId.current === id

  const countdown = async (id: number, step: GuideId, nextPrompt: string) => {
    setGuide(step)
    setPrompt(nextPrompt)
    setPhase('countdown')
    for (const value of COUNTDOWN) {
      if (!alive(id)) return false
      setCount(value)
      setStatus(`${nextPrompt} ${value}`)
      await sleep(1000)
    }
    return alive(id)
  }

  const sample = async (id: number, stepPrompt: string, onFrame: (timestamp: number) => void) => {
    const start = performance.now()
    let shown = -1
    let lastDetect = 0
    let stamp = Math.round(start)
    while (performance.now() - start < SAMPLE_MS) {
      if (!alive(id)) return false
      const left = Math.max(1, Math.ceil((SAMPLE_MS - (performance.now() - start)) / 1000))
      if (left !== shown) {
        shown = left
        setRemain(left)
        setStatus(`${stepPrompt} ${camera.remain(left)}`)
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const now = performance.now()
      if (now - lastDetect >= 100 && videoRef.current && videoRef.current.readyState >= 2) {
        lastDetect = now
        stamp = Math.max(stamp + 1, Math.round(now))
        try {
          onFrame(stamp)
        } catch {
          // Bỏ qua khung hình model không đọc được.
        }
      }
    }
    return alive(id)
  }

  const listen = (id: number, expected: string) => new Promise<SpeechVerdict>((resolve) => {
    const Ctor = speechCtor()
    if (!Ctor) {
      resolve('unclear')
      return
    }
    const rec = new Ctor()
    recognitionRef.current = rec
    rec.lang = 'vi-VN'
    rec.continuous = true
    rec.interimResults = true
    let text = ''
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      try {
        rec.stop()
      } catch {
        // Already stopped when the phrase ended early.
      }
      recognitionRef.current = null
      resolve(alive(id) ? scoreSpeech(text, expected) : 'unclear')
    }
    rec.onresult = (event) => {
      text = Array.from(event.results).map((item) => item[0]?.transcript ?? '').join(' ')
    }
    rec.onerror = () => undefined
    try {
      rec.start()
    } catch {
      finish()
      return
    }
    window.setTimeout(finish, SAMPLE_MS)
  })

  const start = async () => {
    const id = runId.current + 1
    runId.current = id
    stopStream()
    stopRecognition()
    setResult(null)
    setGuide(null)
    setPhase('preparing')
    setStatus(camera.preparing)
    let models: Awaited<ReturnType<typeof loadModels>> | null = null
    const releaseLogs = quietModelLogs()
    try {
      const video = videoRef.current
      if (!video) throw new Error('missing video')
      const [stream, loaded] = await Promise.all([openCamera(), loadModels()])
      if (!alive(id)) {
        loaded.face.close()
        loaded.pose.close()
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      models = loaded
      video.srcObject = stream
      await video.play()

      const faceDeltas: number[] = []
      if (!(await countdown(id, 'face', camera.facePrompt))) return
      setPhase('face')
      const faceDone = await sample(id, camera.facePrompt, (timestamp) => {
        const landmarks = models?.face.detectForVideo(video, timestamp).faceLandmarks[0]
        if (!landmarks) return
        const ratio = mouthCornerRatio(landmarks)
        if (ratio !== null) faceDeltas.push(ratio)
      })
      if (!faceDone) return

      const armReadings: ArmSample[] = []
      if (!(await countdown(id, 'arms', camera.armsPrompt))) return
      setPhase('arms')
      const armsDone = await sample(id, camera.armsPrompt, (timestamp) => {
        const landmarks = models?.pose.detectForVideo(video, timestamp).landmarks[0]
        if (!landmarks) return
        const reading = armSample(landmarks)
        if (reading) armReadings.push(reading)
      })
      if (!armsDone) return

      let speech: SpeechStep = 'skipped'
      if (speechCtor()) {
        if (!(await countdown(id, 'speech', camera.speechPrompt))) return
        setPhase('speech')
        const spokenAt = performance.now()
        const ticker = window.setInterval(() => {
          if (!alive(id)) return
          const left = Math.max(1, Math.ceil((SAMPLE_MS - (performance.now() - spokenAt)) / 1000))
          setRemain(left)
          setStatus(`${camera.speechPrompt} ${camera.remain(left)}`)
        }, 250)
        try {
          speech = await listen(id, camera.phrase)
        } finally {
          window.clearInterval(ticker)
        }
        if (!alive(id)) return
      }

      const face = scoreDeltas(faceDeltas, FACE_MIN_SAMPLES, FACE_UNEVEN_RATIO)
      const arms = scoreArms(armReadings)
      const summary = summarizeDrill(face, arms)
      const outcome = { face, arms, speech, summary }
      if (!alive(id)) return
      setResult(outcome)
      setStatus(buildReport(face, arms, speech).title)
      setPhase('done')
      onComplete?.(outcome)
    } catch (error) {
      if (!alive(id)) return
      setStatus(failureCopy(error))
      setPhase('error')
    } finally {
      releaseLogs()
      models?.face.close()
      models?.pose.close()
      if (alive(id)) stopStream()
    }
  }

  const live = phase === 'preparing' || phase === 'countdown' || phase === 'face' || phase === 'arms' || phase === 'speech'
  const posing = phase === 'countdown' || phase === 'face' || phase === 'arms' || phase === 'speech'
  const outline = posing && guide ? guide : preview
  const canPick = phase === 'idle' || phase === 'done' || phase === 'error'
  const frameIndex = camera.frames.findIndex((frame) => frame.id === outline)
  const report = result && phase === 'done' ? buildReport(result.face, result.arms, result.speech) : null

  return (
    <section className="mt-10" aria-labelledby="practice-camera" aria-busy={live}>
      <h2 id="practice-camera" className="text-[clamp(22px,3vw,28px)] leading-tight font-extrabold text-ink">{camera.title}</h2>
      <p className="mt-2 max-w-160 text-base leading-[1.6] text-muted-foreground">{camera.intro}</p>

      <div className={`practice-stage${live ? ' is-live' : ''}`}>
        <video ref={videoRef} playsInline muted autoPlay hidden={!live} />
        <div className="practice-canvas">
          <PoseOutline id={outline} />
          {posing ? (
            <div className="practice-thumb">
              <PoseThumb id={outline} />
            </div>
          ) : null}
          <p className="practice-step">{frameIndex + 1}/{camera.frames.length} · {camera.frames[frameIndex]?.title}</p>
          {phase === 'countdown' ? <div className="practice-count" aria-hidden="true">{count}</div> : null}
          {posing ? (
            <div className="practice-caption">
              <strong>{prompt}</strong>
              {phase !== 'countdown' ? <span>{camera.remain(remain)}</span> : null}
            </div>
          ) : null}
          {phase === 'preparing' ? <p className="practice-wait">{status}</p> : null}
        </div>
        <div className="practice-deck">
          {canPick ? (
            <button type="button" className="practice-shutter" onClick={start} aria-label={phase === 'idle' ? camera.start : camera.again}>
              <i aria-hidden="true" />
              <em>{phase === 'idle' ? 'Bắt đầu' : camera.again}</em>
            </button>
          ) : null}
          <div className="practice-strip">
            {camera.frames.map((frame) => (
              <button
                key={frame.id}
                type="button"
                className={outline === frame.id ? 'is-active' : undefined}
                aria-pressed={outline === frame.id}
                disabled={!canPick}
                onClick={() => setPreview(frame.id)}
              >
                <PoseThumb id={frame.id} />
                <span>{frame.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className={phase === 'error' ? 'mx-auto mt-3 max-w-105 text-[15px] leading-normal font-semibold text-brand' : 'sr-only'} aria-live="polite">{phase === 'done' ? '' : status}</p>

      {report && result ? (
        <div className={cn(
          'mx-auto mt-4 max-w-160 rounded-2xl border border-line bg-paper p-4.5',
          report.tone === 'attention' && 'border-brand bg-brand-soft',
          report.tone === 'incomplete' && 'border-[#e6d3a1] bg-[#fffdf8]',
          report.tone === 'clear' && 'border-[#1f7a4d] bg-[#f3faf6]',
        )}>
          <p className="text-[13px] font-bold tracking-[.08em] text-brand uppercase">Kết quả 3 động tác</p>
          <h3 className="mt-1.5 text-[22px] leading-snug font-extrabold text-ink" aria-live="polite">{report.title}</h3>
          <p className="mt-2 text-[15px] leading-normal text-ink">{report.body}</p>
          <ul className="mt-3.5 grid list-none gap-2 p-0">
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 rounded-xl bg-paper px-3.5 py-3">
              <strong className="text-[15px] font-extrabold text-ink">{camera.steps.face}</strong>
              <em className={cn('text-[13px] font-bold not-italic', verdictTone(result.face))}>{camera.verdicts[result.face]}</em>
              <p className="col-span-full text-sm leading-normal text-muted-foreground">{camera.details.face[result.face]}</p>
            </li>
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 rounded-xl bg-paper px-3.5 py-3">
              <strong className="text-[15px] font-extrabold text-ink">{camera.steps.arms}</strong>
              <em className={cn('text-[13px] font-bold not-italic', verdictTone(result.arms))}>{camera.verdicts[result.arms]}</em>
              <p className="col-span-full text-sm leading-normal text-muted-foreground">{camera.details.arms[result.arms]}</p>
            </li>
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 rounded-xl bg-paper px-3.5 py-3">
              <strong className="text-[15px] font-extrabold text-ink">{camera.steps.speech}</strong>
              <em className={cn('text-[13px] font-bold not-italic', verdictTone(result.speech))}>{camera.speech[result.speech]}</em>
              <p className="col-span-full text-sm leading-normal text-muted-foreground">{camera.speechDetail[result.speech]}</p>
            </li>
          </ul>
          <p className="mt-3 text-[13px] leading-normal font-semibold text-muted-foreground">{camera.note}</p>
        </div>
      ) : null}
    </section>
  )
}
