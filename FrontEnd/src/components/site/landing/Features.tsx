'use client'

import FeatureSos from './FeatureSos'
import FeatureVoice from './FeatureVoice'
import { features } from '@/content/landing'

// Phần "Tính năng": SOS khẩn cấp (bản đồ + nút SOS), AI Voice (quả cầu hạt), Tìm kiếm người hỗ trợ (mạng lưới điểm)
export default function Features({ id }: { id: string }) {
  const { label, title, items } = features
  const [sos, voice, network] = items
  return (
    <>
      <FeatureSos id={id} label={label} heading={title} item={sos} />
      <FeatureVoice item={voice} />
      <FeatureVoice item={network} titleId="nguoi-ho-tro-title" visual="network" />
    </>
  )
}
