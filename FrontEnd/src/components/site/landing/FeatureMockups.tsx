import { Check, Lock, Mic, Play, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Khung minh họa giao diện app cho phần "Tính năng", dựng bằng HTML để luôn sắc nét

const mock =
  'flex size-full flex-col rounded-[28px] border border-[#d9dde8] bg-white px-7 py-6 text-[#222] shadow-[0_14px_30px_rgba(20,30,80,.1)] max-[899px]:h-auto max-[899px]:min-h-85 max-[899px]:rounded-3xl max-[899px]:p-5 max-xs:min-h-80 max-xs:px-4 max-xs:py-4.5'
const caption = 'text-center text-sm font-medium text-[#333]'

export function VoiceMock() {
  return (
    <div className={mock}>
      <p className={caption}>Hướng dẫn bằng giọng nói</p>
      <p className="mt-5.5 text-[17px] leading-[1.3] max-xs:text-[15px]">Tôi đang lắng nghe. Hãy mô tả điều bạn thấy, tôi sẽ hướng dẫn bạn từng bước.</p>
      <div className="my-auto grid justify-items-center gap-1">
        <span className="flex h-5.5 items-center gap-1" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{ animationDelay: `${i * 0.12}s` }} className="h-full w-1 animate-voice-wave motion-reduce:scale-y-35 rounded-xs bg-brand motion-reduce:animate-none" />
          ))}
        </span>
        <strong className="text-3xl font-normal max-xs:text-2xl">
          Đang nghe<span className="inline-block animate-voice-dots [clip-path:inset(0_100%_0_0)] motion-reduce:animate-none motion-reduce:[clip-path:none]" aria-hidden="true">...</span>
        </strong>
        <small className="text-sm">Tiếng Việt</small>
      </div>
      <div className="-mx-4 -mb-3 flex flex-wrap items-center gap-2.5 rounded-[20px] bg-[#f6f6f8] px-3.5 pt-3.5 pb-3">
        <span className="size-5.5 rounded-full bg-[radial-gradient(circle_at_30%_30%,#e7ddff,#b9c4ff)]" aria-hidden="true" />
        <span className="flex-1 text-base text-[#b5b8c2]">Trò chuyện với trợ lý</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm text-[#555] shadow-[0_1px_3px_rgba(0,0,0,.08)] [&_svg]:size-3.5"><Mic aria-hidden="true" /> Nói</span>
      </div>
    </div>
  )
}

const lessons = [
  { title: 'Đánh giá hiện trường an toàn', meta: '5 phút', state: 'done' },
  { title: 'Ép tim ngoài lồng ngực (CPR)', meta: '8 phút', state: 'done' },
  { title: 'Xử trí hóc dị vật', meta: '6 phút', state: 'current' },
  { title: 'Nhận biết đột quỵ FAST', meta: '7 phút', state: 'locked' }
]
const lessonIcon: Record<string, LucideIcon> = { done: Check, current: Play, locked: Lock }

export function CourseMock() {
  return (
    <div className={mock}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-bold text-[#333]">Khóa học sơ cứu cơ bản</p>
        <span className="rounded-full bg-[#fde08f] px-2.5 py-0.5 text-xs font-medium">Online</span>
      </div>
      <div className="mt-4 mb-1.5 flex justify-between text-[13px] text-[#666]">
        <span>Tiến độ 2/4 bài</span>
        <strong className="text-brand">50%</strong>
      </div>
      {/* Thanh tiến độ chạy tới 50% khi hàng tính năng cuộn vào màn hình (group = FeatureRow) */}
      <span className="block h-1.5 overflow-hidden rounded-[3px] bg-[#f0f1f5]" aria-hidden="true">
        <span className="block h-full w-0 rounded-[inherit] bg-brand transition-[width] delay-300 duration-1200 ease-in-out group-data-[in-view=true]:w-1/2 motion-reduce:transition-none" />
      </span>
      <ul className="mt-3.5 grid gap-1.5">
        {lessons.map(({ title, meta, state }) => {
          const Icon = lessonIcon[state]
          return (
            <li key={title} className={cn('flex items-center gap-2.5 rounded-xl px-2.5 py-1.75 text-sm', state === 'current' && 'bg-brand-soft font-medium', state === 'locked' && 'text-[#aaa]')}>
              <span
                className={cn(
                  'grid size-6 flex-none place-items-center rounded-full bg-[#e6e9fb] text-[#4f5fd6] [&_svg]:size-3.25 [&_svg]:stroke-[2.5]',
                  state === 'current' && 'bg-brand text-white',
                  state === 'locked' && 'bg-[#f0f1f5] text-[#aaa]',
                )}
              >
                <Icon aria-hidden="true" />
              </span>
              <span className="truncate">{title}</span>
              <small className="ml-auto text-xs whitespace-nowrap text-[#999]">{meta}</small>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto flex items-center justify-between gap-2 rounded-[14px] bg-[#f6f6f8] px-3 py-2.5 max-[899px]:mt-3.5">
        <span className="grid text-sm"><strong>Quiz nhanh</strong><small className="text-xs text-[#888]">5 câu · khoảng 3 phút</small></span>
        <span className="rounded-full bg-brand px-3.5 py-1.5 text-[13px] font-medium text-white">Làm quiz</span>
      </div>
    </div>
  )
}

export function SosMock() {
  return (
    <div className={cn(mock, 'items-center text-center')}>
      <p className="text-[19px] font-bold">Bạn đang gặp nguy hiểm?</p>
      <p className="mt-2 max-w-55 text-xs leading-normal text-[#999]">Nhấn nút bên dưới, trợ giúp sẽ sớm tìm đến bạn.</p>
      <div className="relative mt-3 grid w-full flex-1 place-items-center">
        <span className="absolute size-50 animate-sos-pulse rounded-full bg-[rgba(234,84,85,.1)] motion-reduce:animate-none" aria-hidden="true" />
        <span className="absolute size-40 animate-sos-pulse rounded-full bg-[rgba(234,84,85,.14)] [animation-delay:.6s] motion-reduce:animate-none" aria-hidden="true" />
        <span className="relative grid size-33 place-items-center rounded-full bg-[linear-gradient(160deg,#e5484d,#f07b7b)] text-[26px] font-extrabold tracking-[.04em] text-white shadow-[0_12px_30px_rgba(229,72,77,.4)]">SOS</span>
      </div>
    </div>
  )
}
