import { Check, Lock, Play, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Khung minh họa giao diện app cho phần "Tính năng", dựng bằng HTML để luôn sắc nét

const mock =
  'flex size-full flex-col rounded-[28px] border border-[#d9dde8] bg-white px-7 py-6 text-[#222] shadow-[0_14px_30px_rgba(20,30,80,.1)] max-[899px]:h-auto max-[899px]:min-h-85 max-[899px]:rounded-3xl max-[899px]:p-5 max-xs:min-h-80 max-xs:px-4 max-xs:py-4.5'

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
