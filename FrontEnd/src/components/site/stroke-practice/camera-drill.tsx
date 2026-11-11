'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Phone } from 'lucide-react'
import { strokePractice } from '@/content/stroke-practice'
import {
  FACE_MIN_SAMPLES,
  FACE_UNEVEN_RATIO,
  armSample,
  mouthCornerRatio,
  scoreArms,
  scoreDeltas,
  scoreSpeech,
  summarizeDrill,
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

export default function CameraDrill() {
  const { camera, fast } = strokePractice
  const videoRef = useRef<HTMLVideoElement>(null)
  const runId = useRef(0)
  const recognitionRef = useRef<BrowserSpeech | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(3)
  const [remain, setRemain] = useState(0)
  const [prompt, setPrompt] = useState(camera.facePrompt)
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

  const countdown = async (id: number, nextPrompt: string) => {
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
    setPhase('preparing')
    setStatus(camera.preparing)
    let models: Awaited<ReturnType<typeof loadModels>> | null = null
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
      if (!(await countdown(id, camera.facePrompt))) return
      setPhase('face')
      const faceDone = await sample(id, camera.facePrompt, (timestamp) => {
        const landmarks = models?.face.detectForVideo(video, timestamp).faceLandmarks[0]
        if (!landmarks) return
        const ratio = mouthCornerRatio(landmarks)
        if (ratio !== null) faceDeltas.push(ratio)
      })
      if (!faceDone) return

      const armReadings: ArmSample[] = []
      if (!(await countdown(id, camera.armsPrompt))) return
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
        if (!(await countdown(id, camera.speechPrompt))) return
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
      if (!alive(id)) return
      setResult({ face, arms, speech, summary })
      setStatus(camera.summaries[summary])
      setPhase('done')
    } catch (error) {
      if (!alive(id)) return
      setStatus(failureCopy(error))
      setPhase('error')
    } finally {
      models?.face.close()
      models?.pose.close()
      if (alive(id)) stopStream()
    }
  }

  const live = phase === 'preparing' || phase === 'countdown' || phase === 'face' || phase === 'arms' || phase === 'speech'
  const showStage = phase === 'idle' || live

  return (
    <section className="practice-section" aria-labelledby="practice-camera" aria-busy={live}>
      <p className="practice-kicker">{camera.label}</p>
      <h2 id="practice-camera">{camera.title}</h2>
      <p className="practice-copy">{camera.intro}</p>

      {showStage ? (
        <div className="practice-stage">
          <video ref={videoRef} playsInline muted autoPlay hidden={!live} />
          {phase === 'idle' ? (
            <div className="practice-stage-empty">
              <button type="button" className="button button-primary" onClick={start}>{camera.start}</button>
            </div>
          ) : null}
          {phase === 'countdown' ? <div className="practice-count" aria-hidden="true">{count}</div> : null}
          {live && phase !== 'preparing' ? (
            <div className="practice-overlay">
              <strong>{prompt}</strong>
              {phase !== 'countdown' ? <span>{camera.remain(remain)}</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <p className={`practice-status${phase === 'error' ? ' is-error' : ''}`} aria-live="polite">{status}</p>

      {result && phase === 'done' ? (
        <div className={`practice-result${result.summary === 'attention' ? ' is-attention' : ''}`}>
          <h3>{camera.summaries[result.summary]}</h3>
          <ul>
            <li>{camera.steps.face}<span>{camera.verdicts[result.face]}</span></li>
            <li>{camera.steps.arms}<span>{camera.verdicts[result.arms]}</span></li>
            <li>{camera.steps.speech}<span>{camera.speech[result.speech]}</span></li>
          </ul>
          <div className="practice-actions">
            <button type="button" className="button button-outline" onClick={start}>{camera.again}</button>
            <a className="button button-primary" href="tel:115"><Phone aria-hidden="true" /> {fast.call}</a>
            <Link className="button button-outline" href="/app/sos">{fast.sos}</Link>
          </div>
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="practice-actions">
          <button type="button" className="button button-primary" onClick={start}>{camera.again}</button>
          <a className="button button-outline" href="tel:115"><Phone aria-hidden="true" /> {fast.call}</a>
        </div>
      ) : null}
    </section>
  )
}
