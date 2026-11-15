import { Inter, Noto_Serif } from 'next/font/google'

// Font Inter dùng chung cho toàn site: landing (inter.className) và các trang tính năng
// (biến --font-inter gắn ở <html> trong app/layout.tsx, các font-* của Tailwind trong globals.css trỏ về đây)
export const inter = Inter({ subsets: ['latin', 'vietnamese'], display: 'swap', variable: '--font-inter' })

// Chữ có chân cho trích dẫn ở mục Chuyên gia; font hệ thống (Georgia...) thiếu dấu tiếng Việt nên tải Noto Serif
export const serif = Noto_Serif({ subsets: ['latin', 'vietnamese'], display: 'swap' })
