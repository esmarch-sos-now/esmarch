'use client'

import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import useInView from '@/hooks/useInView'
import { inter } from './inter'
import NetworkGraph from './NetworkGraph'

type VoiceFeature = { title: string; subtitle: string; points: string[] }

const COUNT = 12000

// Quả cầu hạt trắng như mẫu: hạt rải trên mặt cầu (mật độ dày ở hai cực, viền sáng do nhìn xuyên lớp vỏ), quay chậm quanh trục dọc.
// "Giọng nói" làm vỏ cầu gợn sóng: mỗi hạt dịch ra/vào theo pháp tuyến với biên độ thay đổi như nhịp nói.
function buildPoints() {
  const data = new Float32Array(COUNT * 5) // y, phi, thickness, size, brightness
  for (let i = 0; i < COUNT; i++) {
    const pole = Math.random() < 0.2
    const y = pole ? (Math.random() < 0.5 ? -1 : 1) * (0.86 + 0.14 * Math.pow(Math.random(), 2)) : Math.random() * 2 - 1
    data[i * 5] = y
    data[i * 5 + 1] = Math.random() * Math.PI * 2
    data[i * 5 + 2] = 1 + (Math.random() - 0.5) * 0.045
    data[i * 5 + 3] = 0.6 + Math.random() * 0.9
    data[i * 5 + 4] = 0.45 + Math.random() * 0.55
  }
  return data
}

function ParticleSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const points = buildPoints()
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let raf = 0
    let visible = true
    const started = performance.now()

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(width * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = (now: number) => {
      const t = reduced ? 0 : (now - started) / 1000
      ctx.clearRect(0, 0, width, width)
      const radius = width * 0.4
      const cx = width / 2
      const spin = t * 0.22
      // biên độ "nhịp nói": đổi chậm, có lúc lặng lúc mạnh
      const speech = 0.012 + 0.022 * (0.5 + 0.5 * Math.sin(t * 1.3)) * (0.55 + 0.45 * Math.sin(t * 0.47 + 1.2))
      const cos = Math.cos(spin)
      const sin = Math.sin(spin)
      for (let i = 0; i < COUNT; i++) {
        const y = points[i * 5]
        const phi = points[i * 5 + 1]
        const ring = Math.sqrt(1 - y * y)
        const swell = 1 + points[i * 5 + 2] - 1 + speech * Math.sin(y * 9 + t * 3.1 + phi * 2)
        const x0 = ring * Math.cos(phi) * swell
        const z0 = ring * Math.sin(phi) * swell
        const x = x0 * cos + z0 * sin
        const z = -x0 * sin + z0 * cos
        const depth = (z + 1) / 2
        const alpha = points[i * 5 + 4] * (0.28 + 0.72 * depth)
        const size = points[i * 5 + 3] * (0.75 + 0.45 * depth)
        ctx.globalAlpha = alpha
        ctx.fillStyle = '#fff'
        ctx.fillRect(cx + x * radius - size / 2, cx + y * swell * radius - size / 2, size, size)
      }
      ctx.globalAlpha = 1
    }

    const loop = (now: number) => {
      if (visible) draw(now)
      raf = requestAnimationFrame(loop)
    }

    resize()
    draw(performance.now())
    const observer = new ResizeObserver(() => { resize(); draw(performance.now()) })
    observer.observe(canvas)
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    io.observe(canvas)
    if (!reduced) raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      io.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="lp-voice-sphere" aria-hidden="true" />
}

// Bố cục tính năng nền đen: tiêu đề, dòng đỏ, danh sách trong thẻ kính (trái) + hình động (phải).
// Dùng cho "AI Voice" (quả cầu hạt phản ứng theo "giọng nói") và "Tìm kiếm người hỗ trợ" (mạng lưới điểm), cùng cỡ chữ.
export default function FeatureVoice({ item, titleId = 'ai-voice-title', visual = 'sphere' }: { item: VoiceFeature; titleId?: string; visual?: 'sphere' | 'network' }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    // Mạng lưới: đảo bố cục (hình bên trái, mô tả bên phải) để xen kẽ với khối AI Voice phía trên
    <section className={`lp-voice ${visual === 'network' ? 'lp-voice-reverse' : ''} ${inter.className}`} aria-labelledby={titleId}>
      <div ref={ref} className={`lp-voice-stage ${inView ? 'in-view' : ''}`}>
        <div className="lp-voice-info">
          <h3 id={titleId} className="lp-voice-title">{item.title}</h3>
          <p className="lp-voice-lead">{item.subtitle}</p>
          {/* Danh sách có dấu tích nằm trong thẻ kính mờ (liquid glass) giống khối SOS phía trên */}
          <ul className="lp-voice-points lp-glass">
            {item.points.map((point) => (
              <li key={point}><span className="lp-voice-check"><Check aria-hidden="true" /></span><span>{point}</span></li>
            ))}
          </ul>
        </div>
        <div className="lp-voice-visual">{visual === 'network' ? <NetworkGraph /> : <ParticleSphere />}</div>
      </div>
    </section>
  )
}
