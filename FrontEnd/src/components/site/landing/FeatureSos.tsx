'use client'

import { Check } from 'lucide-react'
import { FramePill, SelectionFrame } from '@/components/site/primitives'
import useInView from '@/hooks/useInView'
import { cn } from '@/lib/utils'
import { inter } from './inter'

const mapImage = '/site/features/map.webp'

type SosFeature = { title: string; subtitle: string; points: string[] }
type Heading = { brand: string; rest: string }

const ring = 'absolute rounded-full animate-feat-pulse motion-reduce:animate-none motion-reduce:opacity-50'

// Hiện dần khi cuộn tới
function rise(inView: boolean) {
  return cn(
    'transition-[opacity,translate] duration-700 ease-in-out motion-reduce:transition-none',
    inView ? 'translate-y-0 opacity-100' : 'translate-y-[calc(20*var(--u))] opacity-0 max-lp:motion-safe:translate-y-5 motion-reduce:translate-y-0 motion-reduce:opacity-100',
  )
}

// Tính năng "SOS khẩn cấp" theo mẫu thiết kế (khung 1440x810, cộng 50 đơn vị phía trên cho dải chuyển nền):
// tiêu đề "SOS NOW" trong khung xanh như hero + "cung cấp gì?", khung bản đồ tối ở bên trái với nút SOS đỏ viền trắng
// (giữ sóng lan như nút SOS ở hero), bên phải là tiêu đề + dòng đỏ, danh sách tính năng trong thẻ kính mờ.
// Dưới breakpoint `lp`: tiêu đề → nội dung → khung bản đồ xếp dọc.
export default function FeatureSos({ id, label, heading, item }: { id: string; label: string; heading: Heading; item: SosFeature }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        inter.className,
        'relative overflow-clip bg-black text-white',
        // Dải chuyển mềm từ nền xám nhạt của phần HDSD phía trên sang nền đen, không có đường cắt
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[calc(130*var(--u))] before:bg-[linear-gradient(to_bottom,#f8f8f8_0%,#d9d9d9_14%,#9e9e9e_32%,#5a5a5a_52%,#262626_72%,#0a0a0a_88%,#000_100%)] before:content-[''] max-lp:before:h-22.5",
      )}
    >
      <div ref={ref} className="relative mx-auto h-[calc(920*var(--u))] w-[calc(1440*var(--u))] max-lp:flex max-lp:h-auto max-lp:w-auto max-lp:flex-col max-lp:px-5 max-lp:pt-18 max-lp:pb-10">
        <div className={cn('absolute top-[calc(133*var(--u))] left-[calc(65*var(--u))] flex flex-col items-start max-lp:static', rise(inView))}>
          <FramePill className="w-[calc(124*var(--u))] bg-[#d7d6d6] px-0 text-[#0c0e10] max-lp:w-28 max-lp:px-0">{label}</FramePill>
          <h2 id={`${id}-title`} className="mt-[calc(47*var(--u))] ml-[calc(7*var(--u))] flex items-center gap-[calc(20*var(--u))] font-bold max-lp:mt-5.5 max-lp:ml-1 max-lp:flex-wrap max-lp:gap-x-3.5 max-lp:gap-y-2.5">
            {/* Khung chọn xanh quanh "SOS NOW": cùng kiểu với tiêu đề ở hero */}
            <SelectionFrame className="inline-flex h-[calc(99*var(--u))] w-[calc(513*var(--u))] max-lp:h-auto max-lp:w-auto max-lp:px-4 max-lp:pt-1.5 max-lp:pb-1">
              <span className="bg-[linear-gradient(90deg,#c8321c,#c4672b)] bg-clip-text pr-[.06em] text-[calc(90*var(--u))] leading-none tracking-[-.025em] whitespace-nowrap text-transparent max-lp:text-[clamp(44px,13vw,72px)]">
                {heading.brand}
              </span>
            </SelectionFrame>
            <span className="text-[calc(45*var(--u))] leading-none tracking-[-.02em] whitespace-nowrap max-lp:text-[clamp(24px,7vw,38px)]">{heading.rest}</span>
          </h2>
        </div>

        {/* Khung bản đồ thẳng lề trái với nhãn "Tính năng", cao bằng thẻ mô tả bên phải.
            Mobile: rộng bằng nội dung, giữ tỉ lệ 620x460 bằng cách đặt lại --u cho riêng khung này. */}
        <div
          aria-hidden="true"
          className={cn(
            'absolute top-[calc(390*var(--u))] left-[calc(65*var(--u))] h-[calc(460*var(--u))] w-[calc(620*var(--u))] overflow-hidden rounded-[calc(28*var(--u))] bg-black delay-100',
            'max-lp:relative max-lp:top-auto max-lp:left-auto max-lp:order-2 max-lp:mt-6 max-lp:w-full max-lp:rounded-[22px] max-lp:[--u:calc((100vw-40px)/620)]',
            rise(inView),
          )}
        >
          {/* Ảnh bản đồ gốc là đường tối trên nền sáng: đảo màu thành đường trắng trên nền đen như mẫu */}
          <img src={mapImage} alt="" loading="lazy" className="size-full max-w-none object-cover object-[50%_42%] contrast-160 grayscale invert" />
          <div className="absolute top-1/2 left-1/2 grid size-[calc(280*var(--u))] -translate-1/2 place-items-center">
            <span className={cn(ring, 'size-[calc(280*var(--u))] bg-[rgba(227,38,43,.22)]')} />
            <span className={cn(ring, 'size-[calc(220*var(--u))] bg-[rgba(227,38,43,.3)] [animation-delay:.6s]')} />
            {/* vành đỏ ngoài + vòng trắng bên trong */}
            <span className="relative grid size-[calc(168*var(--u))] place-items-center rounded-full bg-[#e3262b] text-[calc(54*var(--u))] leading-none font-extrabold tracking-[.01em] text-white shadow-[inset_0_0_0_calc(8*var(--u))_#e3262b,inset_0_0_0_calc(17*var(--u))_#fff,0_calc(10*var(--u))_calc(30*var(--u))_rgba(227,38,43,.45)]">
              SOS
            </span>
          </div>
        </div>

        <div className="absolute top-[calc(390*var(--u))] left-[calc(755*var(--u))] z-1 w-[calc(620*var(--u))] max-lp:relative max-lp:top-auto max-lp:left-auto max-lp:order-1 max-lp:mt-8 max-lp:w-auto">
          <h3 className={cn('text-[calc(49.9*var(--u))] leading-none font-semibold tracking-[-.025em] whitespace-nowrap delay-160 max-lp:text-[clamp(26px,7.4vw,40px)] max-lp:leading-[1.15] max-lp:whitespace-normal', rise(inView))}>
            {item.title}
          </h3>
          <p className={cn('mt-[calc(17*var(--u))] text-[calc(20.5*var(--u))] leading-[1.2] tracking-[-.01em] whitespace-nowrap text-[#ff6b4d] delay-240 max-lp:mt-2.5 max-lp:text-base max-lp:whitespace-normal', rise(inView))}>
            {item.subtitle}
          </p>
          {/* Chỉ danh sách có dấu tích nằm trong thẻ kính mờ (liquid glass) */}
          <ul className={cn('glass relative mt-[calc(30*var(--u))] flex flex-col gap-[calc(22*var(--u))] rounded-[calc(24*var(--u))] px-[calc(32*var(--u))] py-[calc(30*var(--u))] delay-320 max-lp:mt-5.5 max-lp:w-full max-lp:gap-3.5 max-lp:rounded-[20px] max-lp:px-4.5 max-lp:py-5', rise(inView))}>
            {item.points.map((point) => (
              <li key={point} className="flex items-center gap-[calc(20*var(--u))] text-[calc(20*var(--u))] leading-[1.3] text-[#ececec] max-lp:gap-3.5 max-lp:text-base">
                <span className="grid size-[calc(36*var(--u))] flex-none place-items-center rounded-full bg-[#e6e9fb] text-[#4f5fd6] max-lp:size-8.5 [&_svg]:size-[calc(18*var(--u))] [&_svg]:stroke-[2.6] max-lp:[&_svg]:size-4.25">
                  <Check aria-hidden="true" />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
