import { Check, Lock, Play, type LucideIcon } from 'lucide-react'

// Khung minh họa giao diện app cho phần "Tính năng", dựng bằng HTML để luôn sắc nét

const lessons = [
  { title: 'Đánh giá hiện trường an toàn', meta: '5 phút', state: 'done' },
  { title: 'Ép tim ngoài lồng ngực (CPR)', meta: '8 phút', state: 'done' },
  { title: 'Xử trí hóc dị vật', meta: '6 phút', state: 'current' },
  { title: 'Nhận biết đột quỵ FAST', meta: '7 phút', state: 'locked' }
]
const lessonIcon: Record<string, LucideIcon> = { done: Check, current: Play, locked: Lock }

export function CourseMock() {
  return (
    <div className="mock mock-course">
      <div className="course-head">
        <p className="mock-caption">Khóa học sơ cứu cơ bản</p>
        <span className="course-badge">Online</span>
      </div>
      <div className="course-progress">
        <span>Tiến độ 2/4 bài</span>
        <strong>50%</strong>
      </div>
      <span className="course-bar" aria-hidden="true"><span /></span>
      <ul className="course-lessons">
        {lessons.map(({ title, meta, state }) => {
          const Icon = lessonIcon[state]
          return (
            <li key={title} className={`lesson lesson-${state}`}>
              <span className="lesson-icon"><Icon aria-hidden="true" /></span>
              <span className="lesson-title">{title}</span>
              <small>{meta}</small>
            </li>
          )
        })}
      </ul>
      <div className="course-quiz">
        <span><strong>Quiz nhanh</strong><small>5 câu · khoảng 3 phút</small></span>
        <span className="course-quiz-button">Làm quiz</span>
      </div>
    </div>
  )
}

