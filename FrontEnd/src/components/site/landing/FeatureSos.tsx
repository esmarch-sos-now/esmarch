'use client'

import { Check } from 'lucide-react'
import useInView from '@/hooks/useInView'
import { inter } from './inter'

const mapImage = '/site/features/map.webp'

type SosFeature = { title: string; subtitle: string; points: string[] }
type Heading = { brand: string; rest: string }

// Tính năng "SOS khẩn cấp" theo mẫu thiết kế (khung 1440x810): tiêu đề "SOS NOW" trong khung xanh như hero + "cung cấp gì?",
// khung bản đồ tối ở bên trái với nút SOS đỏ viền trắng (giữ sóng lan như nút SOS ở hero), bên phải là tiêu đề + dòng đỏ, danh sách tính năng trong thẻ kính mờ.
export default function FeatureSos({ id, label, heading, item }: { id: string; label: string; heading: Heading; item: SosFeature }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <section id={id} className={`lp-feat ${inter.className}`} aria-labelledby={`${id}-title`}>
      <div ref={ref} className={`lp-feat-stage ${inView ? 'in-view' : ''}`}>
        <div className="lp-feat-head">
          <span className="lp-feat-pill">{label}</span>
          <h2 id={`${id}-title`} className="lp-feat-title">
            <span className="lp-feat-brand">
              <span className="lp-feat-brand-text">{heading.brand}</span>
              <i className="lp-handle lp-handle-tl" aria-hidden="true" />
              <i className="lp-handle lp-handle-tr" aria-hidden="true" />
              <i className="lp-handle lp-handle-bl" aria-hidden="true" />
              <i className="lp-handle lp-handle-br" aria-hidden="true" />
            </span>
            <span className="lp-feat-title-rest">{heading.rest}</span>
          </h2>
        </div>

        <div className="lp-feat-map" aria-hidden="true">
          <img src={mapImage} alt="" loading="lazy" />
          <div className="lp-feat-sos">
            <span className="lp-feat-ring" />
            <span className="lp-feat-ring lp-feat-ring-2" />
            <span className="lp-feat-sos-button">SOS</span>
          </div>
        </div>

        <div className="lp-feat-info">
          <h3 className="lp-feat-sub">{item.title}</h3>
          <p className="lp-feat-lead">{item.subtitle}</p>
          {/* Chỉ danh sách có dấu tích nằm trong thẻ kính mờ (liquid glass), dùng chung lớp .lp-glass với hero */}
          <ul className="lp-feat-points lp-glass">
            {item.points.map((point) => (
              <li key={point}><span className="lp-feat-check"><Check aria-hidden="true" /></span><span>{point}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
