'use client'

import { useEffect, useRef } from 'react'

// Mạng lưới điểm nối nhau như mẫu "Tìm kiếm người hỗ trợ": mỗi điểm là chấm trắng có vòng tròn mảnh, nối bằng nét mờ.
// Chuyển động: các điểm trôi nhẹ quanh chỗ cũ, tín hiệu sáng chạy dọc các nét nối, thỉnh thoảng một điểm "phát sóng" tìm người.
type Node = { x: number; y: number; r: number; phase: number; speed: number }

// Toạ độ trong khung 0..1, rải thành cụm giống mẫu (nhiều điểm ở giữa, vài điểm lẻ bên ngoài)
const BASE: [number, number][] = [
  [0.22, 0.38], [0.28, 0.3], [0.37, 0.26], [0.46, 0.29], [0.54, 0.29], [0.54, 0.31], [0.46, 0.37], [0.56, 0.37],
  [0.63, 0.37], [0.71, 0.29], [0.79, 0.37], [0.71, 0.44], [0.69, 0.46], [0.62, 0.46], [0.37, 0.44], [0.39, 0.46],
  [0.46, 0.45], [0.37, 0.54], [0.46, 0.6], [0.47, 0.62], [0.54, 0.62], [0.62, 0.62], [0.71, 0.59], [0.71, 0.47],
  [0.2, 0.53], [0.37, 0.72], [0.54, 0.79]
]

function buildEdges(nodes: { x: number; y: number }[]) {
  // Mỗi điểm nối với 2 điểm gần nhất (bỏ trùng), điểm quá xa thì để lẻ như mẫu
  const edges = new Set<string>()
  nodes.forEach((a, i) => {
    nodes
      .map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter(({ j, d }) => j !== i && d < 0.17)
      .sort((p, q) => p.d - q.d)
      .slice(0, 3)
      .forEach(({ j }) => edges.add(i < j ? `${i}-${j}` : `${j}-${i}`))
  })
  return [...edges].map((key) => key.split('-').map(Number) as [number, number])
}

export default function NetworkGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // Giãn cụm điểm ra quanh tâm khung để mạng lưới lấp gần hết khung vuông như mẫu
    const nodes: Node[] = BASE.map(([x, y], i) => ({
      x: 0.5 + (x - 0.5) * 1.3,
      y: 0.5 + (y - 0.52) * 1.3,
      r: i % 5 === 0 ? 1.4 : 1,
      phase: (i * 2.399) % (Math.PI * 2),
      speed: 0.35 + ((i * 7) % 10) / 25
    }))
    const edges = buildEdges(nodes)
    // Tín hiệu chạy trên nét nối: mỗi tín hiệu đi một cạnh rồi chuyển sang cạnh khác
    const signals = Array.from({ length: 6 }, (_, k) => ({ edge: (k * 5) % edges.length, t: k / 6, forward: k % 2 === 0 }))
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

    const position = (node: Node, t: number) => {
      const drift = 0.008
      return {
        x: (node.x + Math.sin(t * node.speed + node.phase) * drift) * width,
        y: (node.y + Math.cos(t * node.speed * 0.8 + node.phase) * drift) * width
      }
    }

    let last = started
    const draw = (now: number) => {
      const t = reduced ? 0 : (now - started) / 1000
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const points = nodes.map((node) => position(node, t))
      const unit = width / 600
      ctx.clearRect(0, 0, width, width)

      // Nét nối mờ
      ctx.lineWidth = Math.max(0.6, 0.8 * unit)
      ctx.strokeStyle = 'rgba(255, 255, 255, .28)'
      ctx.beginPath()
      for (const [a, b] of edges) {
        ctx.moveTo(points[a].x, points[a].y)
        ctx.lineTo(points[b].x, points[b].y)
      }
      ctx.stroke()

      // Tín hiệu sáng chạy dọc nét nối
      for (const signal of signals) {
        if (!reduced) {
          signal.t += dt * 0.45
          if (signal.t >= 1) {
            const [, end] = signal.forward ? edges[signal.edge] : [...edges[signal.edge]].reverse()
            const next = edges.map((edge, index) => ({ edge, index })).filter(({ edge }) => edge.includes(end))
            const pick = next[Math.floor(Math.random() * next.length)]
            signal.edge = pick.index
            signal.forward = pick.edge[0] === end
            signal.t = 0
          }
        }
        const [a, b] = signal.forward ? edges[signal.edge] : [...edges[signal.edge]].reverse()
        const x = points[a].x + (points[b].x - points[a].x) * signal.t
        const y = points[a].y + (points[b].y - points[a].y) * signal.t
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 6 * unit)
        glow.addColorStop(0, 'rgba(255, 255, 255, .9)')
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(x, y, 6 * unit, 0, Math.PI * 2)
        ctx.fill()
      }

      // Điểm: chấm trắng + vòng tròn mảnh; vài điểm phát sóng lan ra theo chu kỳ (đang "tìm người hỗ trợ")
      points.forEach((p, i) => {
        const node = nodes[i]
        if (!reduced && i % 6 === 0) {
          const wave = ((t * 0.5 + node.phase / (Math.PI * 2)) % 1)
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * (1 - wave)})`
          ctx.lineWidth = Math.max(0.6, 0.8 * unit)
          ctx.beginPath()
          ctx.arc(p.x, p.y, (5 + wave * 22) * unit, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, .85)'
        ctx.lineWidth = Math.max(0.8, 1.1 * unit)
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3.6 * node.r * unit, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 1.3 * node.r * unit, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    const loop = (now: number) => {
      if (visible) draw(now)
      else last = now
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
