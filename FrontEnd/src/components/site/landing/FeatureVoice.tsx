'use client'

import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import useInView from '@/hooks/useInView'
import { cn } from '@/lib/utils'
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

  return <canvas ref={canvasRef} className="block size-full" aria-hidden="true" />
}

// Chữ hiện dần khi cuộn tới
function rise(inView: boolean) {
  return cn(
    'transition-[opacity,translate] duration-700 ease-in-out motion-reduce:transition-none',
    inView ? 'translate-y-0 opacity-100' : 'translate-y-[calc(20*var(--u))] opacity-0 max-lp:motion-safe:translate-y-5 motion-reduce:translate-y-0 motion-reduce:opacity-100',
  )
}

// Bố cục tính năng nền đen: tiêu đề, dòng đỏ, danh sách trong thẻ kính (trái) + hình động (phải).
// Dùng cho "AI Voice" (quả cầu hạt phản ứng theo "giọng nói") và "Tìm kiếm người hỗ trợ" (mạng lưới điểm), cùng cỡ chữ.
// Toạ độ theo khung 1440x810 nhưng kéo cả khối lên 110 đơn vị để nối liền với khối SOS phía trên.
// Dưới breakpoint `lp`: chữ lên trên, hình động ở dưới.
export default function FeatureVoice({ item, titleId = 'ai-voice-title', visual = 'sphere' }: { item: VoiceFeature; titleId?: string; visual?: 'sphere' | 'network' }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  // Mạng lưới: đảo bố cục (hình bên trái, mô tả bên phải, chỉ trên desktop) để xen kẽ với khối AI Voice phía trên.
  // Đây cũng là khối tính năng cuối nên có thêm dải chuyển từ đen sang nền trắng của phần Bảng giá.
  const reverse = visual === 'network'
  return (
    // Chồng 2px lên khối trên để không lộ vạch mảnh do làm tròn pixel ở chỗ nối hai khối nền đen
    <section
      aria-labelledby={titleId}
      className={cn(
        inter.className,
        'relative -mt-0.5 overflow-clip bg-black text-white',
        reverse && "pb-[calc(130*var(--u))] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-[calc(130*var(--u))] after:bg-[linear-gradient(to_top,#fff_0%,#d9d9d9_14%,#9e9e9e_32%,#5a5a5a_52%,#262626_72%,#0a0a0a_88%,#000_100%)] after:content-['']",
      )}
    >
      <div ref={ref} className="relative mx-auto h-[calc(560*var(--u))] w-[calc(1440*var(--u))] max-lp:flex max-lp:h-auto max-lp:w-auto max-lp:flex-col max-lp:px-5 max-lp:pt-12 max-lp:pb-10">
        <div className="pointer-events-none absolute inset-0 *:pointer-events-auto max-lp:static max-lp:order-1 max-lp:flex max-lp:flex-col max-lp:items-start max-lp:*:static">
          <h3
            id={titleId}
            className={cn(
              'absolute top-[calc(90*var(--u))] left-[calc(81*var(--u))] text-[calc(49.9*var(--u))] leading-none font-semibold tracking-[-.025em] whitespace-nowrap max-lp:text-[clamp(26px,7.4vw,40px)] max-lp:leading-[1.15] max-lp:whitespace-normal',
              reverse && 'lp:left-[calc(755*var(--u))]',
              rise(inView),
            )}
          >
            {item.title}
          </h3>
          <p
            className={cn(
              'absolute top-[calc(157*var(--u))] left-[calc(87*var(--u))] text-[calc(20.5*var(--u))] leading-[1.2] tracking-[-.01em] whitespace-nowrap text-[#ff6b4d] delay-80 max-lp:mt-2.5 max-lp:text-base max-lp:whitespace-normal',
              reverse && 'lp:left-[calc(761*var(--u))]',
              rise(inView),
            )}
          >
            {item.subtitle}
          </p>
          {/* Danh sách có dấu tích nằm trong thẻ kính mờ (liquid glass) giống khối SOS phía trên */}
          <ul
            className={cn(
              'glass absolute top-[calc(220*var(--u))] left-[calc(81*var(--u))] flex w-[calc(620*var(--u))] flex-col gap-[calc(22*var(--u))] rounded-[calc(24*var(--u))] px-[calc(32*var(--u))] py-[calc(30*var(--u))] delay-160',
              'max-lp:mt-5.5 max-lp:w-full max-lp:gap-3.5 max-lp:rounded-[20px] max-lp:px-4.5 max-lp:py-5',
              reverse && 'lp:left-[calc(755*var(--u))]',
              rise(inView),
            )}
          >
            {item.points.map((point) => (
              <li key={point} className="flex items-center gap-[calc(17*var(--u))] text-[calc(21*var(--u))] leading-[1.3] text-[#ececec] max-lp:gap-3.5 max-lp:text-base">
                <span className="grid size-[calc(40*var(--u))] flex-none place-items-center rounded-full bg-[#e6e9fb] text-[#4f5fd6] max-lp:size-8.5 [&_svg]:size-[calc(20*var(--u))] [&_svg]:stroke-[2.6] max-lp:[&_svg]:size-4.25">
                  <Check aria-hidden="true" />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* Hình động: canvas vuông, nền trong suốt nên hoà vào nền đen */}
        <div
          className={cn(
            'absolute top-0 left-[calc(812*var(--u))] size-[calc(520*var(--u))] max-lp:relative max-lp:top-auto max-lp:left-auto max-lp:order-2 max-lp:mx-auto max-lp:mt-5 max-lp:aspect-square max-lp:h-auto max-lp:w-[min(100%,380px)]',
            reverse && 'lp:left-[calc(115*var(--u))]',
          )}
        >
          {reverse ? <NetworkGraph /> : <ParticleSphere />}
        </div>
      </div>
    </section>
  )
}
