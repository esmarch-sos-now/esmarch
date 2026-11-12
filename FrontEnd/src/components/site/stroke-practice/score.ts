// Chấm thao tác bài luyện. Lệch rõ mới báo cần chú ý; mẫu quá ít thì không suy ra kết quả.

export type GestureVerdict = 'even' | 'uneven' | 'missing'

export type DrillSummary = 'attention' | 'no-clear-difference' | 'incomplete'

export type SpeechVerdict = 'heard' | 'unclear'

export const FACE_MIN_SAMPLES = 8
export const ARM_MIN_SAMPLES = 8
/** |khóe miệng trái − phải| / chiều cao mặt. Chỉ mức nhìn thấy rõ mới tính là lệch. */
export const FACE_UNEVEN_RATIO = 0.06
/** |cổ tay trái − phải| / khoảng hai vai. */
export const ARM_UNEVEN_RATIO = 0.35
/** Cổ tay phải cao hơn vai một chút (tọa độ y hướng xuống) thì mới tính là đã giơ tay. */
export const ARM_RAISE_MARGIN = 0.02

export type Point = { x: number; y: number; visibility?: number }

export type ArmSample = { delta: number; bothRaised: boolean }

const MOUTH_LEFT = 61
const MOUTH_RIGHT = 291
const FOREHEAD = 10
const CHIN = 152
const SHOULDER_LEFT = 11
const SHOULDER_RIGHT = 12
const WRIST_LEFT = 15
const WRIST_RIGHT = 16

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function mouthCornerRatio(landmarks: Point[]): number | null {
  const left = landmarks[MOUTH_LEFT]
  const right = landmarks[MOUTH_RIGHT]
  const top = landmarks[FOREHEAD]
  const bottom = landmarks[CHIN]
  if (!left || !right || !top || !bottom) return null
  const height = Math.hypot(bottom.x - top.x, bottom.y - top.y)
  if (height < 0.05) return null
  return Math.abs(left.y - right.y) / height
}

export function armSample(landmarks: Point[]): ArmSample | null {
  const leftShoulder = landmarks[SHOULDER_LEFT]
  const rightShoulder = landmarks[SHOULDER_RIGHT]
  const leftWrist = landmarks[WRIST_LEFT]
  const rightWrist = landmarks[WRIST_RIGHT]
  const points = [leftShoulder, rightShoulder, leftWrist, rightWrist]
  if (points.some((point) => !point)) return null
  if (points.some((point) => (point.visibility ?? 1) < 0.5)) return null
  const width = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y)
  if (width < 0.05) return null
  return {
    delta: Math.abs(leftWrist.y - rightWrist.y) / width,
    bothRaised: leftWrist.y < leftShoulder.y - ARM_RAISE_MARGIN && rightWrist.y < rightShoulder.y - ARM_RAISE_MARGIN
  }
}

export function scoreDeltas(deltas: number[], minSamples: number, unevenAt: number): GestureVerdict {
  if (deltas.length < minSamples) return 'missing'
  const mid = median(deltas)
  if (mid === null) return 'missing'
  return mid >= unevenAt ? 'uneven' : 'even'
}

export function scoreArms(samples: ArmSample[]): GestureVerdict {
  if (samples.length < ARM_MIN_SAMPLES) return 'missing'
  const mid = median(samples.map((sample) => sample.delta))
  if (mid === null) return 'missing'
  if (mid >= ARM_UNEVEN_RATIO) return 'uneven'
  const raised = samples.filter((sample) => sample.bothRaised).length
  if (raised < ARM_MIN_SAMPLES / 2) return 'missing'
  return 'even'
}

export function summarizeDrill(face: GestureVerdict, arms: GestureVerdict): DrillSummary {
  if (face === 'uneven' || arms === 'uneven') return 'attention'
  if (face === 'missing' || arms === 'missing') return 'incomplete'
  return 'no-clear-difference'
}

export type SpeechStep = SpeechVerdict | 'skipped'

export type DrillReport = {
  tone: 'clear' | 'attention' | 'incomplete'
  title: string
  body: string
}

/** Kết quả gộp sau đủ 3 động tác. Lời nói không rõ không bị tính là nói khó, và không kết luận đột quỵ. */
export function buildReport(face: GestureVerdict, arms: GestureVerdict): DrillReport {
  const uneven = [face === 'uneven' ? 'mặt' : '', arms === 'uneven' ? 'tay' : ''].filter(Boolean)

  if (uneven.length > 0) {
    const where = uneven.length === 2 ? 'mặt và tay' : uneven[0]
    return {
      tone: 'attention',
      title: `Có lệch ở ${where}`,
      body: 'Nếu đây là triệu chứng thật, hãy gọi 115.'
    }
  }
  if (face === 'missing' || arms === 'missing') {
    return {
      tone: 'incomplete',
      title: 'Chưa đủ để kết luận',
      body: 'Làm lại ở nơi đủ sáng, nhìn thẳng camera.'
    }
  }
  return {
    tone: 'clear',
    title: 'Không thấy lệch',
    body: 'Kết quả này không loại trừ đột quỵ.'
  }
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Khớp câu nói đã nghe với câu mẫu. Không nghe rõ thì không coi là nói khó. */
export function scoreSpeech(transcript: string, expected: string): SpeechVerdict {
  const heard = fold(transcript)
  const want = fold(expected).split(' ').filter(Boolean)
  if (!heard || want.length === 0) return 'unclear'
  const hits = want.filter((token) => heard.includes(token)).length
  return hits >= Math.ceil(want.length * 0.6) ? 'heard' : 'unclear'
}
