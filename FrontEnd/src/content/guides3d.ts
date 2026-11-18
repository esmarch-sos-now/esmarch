// Hướng dẫn 3D tương tác (file HTML độc lập trong public/guides/).
// Mỗi mục gắn với một tình huống (scenarioId) và các từ khóa gọi thẳng kỹ thuật đó.
export const guides3d = [
  {
    id: 'ep-bung',
    scenarioId: 'choking',
    path: '/app/huong-dan/ep-bung',
    file: '/guides/ep-bung-3d.html',
    title: 'Sơ cứu hóc dị vật: ép bụng',
    // Nhãn nút trên màn chọn tình huống (/app/huong-dan)
    label: 'Bị hóc dị vật',
    hint: 'Nạn nhân không ho, không nói, không thở được',
    keywords: ['ép bụng', 'ep bung', 'heimlich', 'hóc', 'nghẹn', 'dị vật', 'hoc', 'nghen', 'di vat']
  },
  {
    id: 'gay-xuong-dui',
    // Backend chưa có tình huống gãy xương, nên chỉ mở bằng từ khóa
    scenarioId: null,
    path: '/app/huong-dan/gay-xuong-dui',
    file: '/guides/gay-xuong-dui-3d.html',
    title: 'Cố định gãy xương đùi: nẹp hai bên',
    label: 'Gãy xương đùi',
    hint: 'Đùi đau, sưng, biến dạng, không cử động được',
    keywords: ['gãy xương đùi', 'gãy đùi', 'xương đùi', 'gãy chân', 'gay xuong dui', 'gay dui', 'gay chan']
  },
  {
    id: 'xuc-thia',
    // Kỹ thuật di chuyển nạn nhân, không ứng với tình huống nào của backend
    scenarioId: null,
    path: '/app/huong-dan/xuc-thia',
    file: '/guides/xuc-thia-3d.html',
    title: 'Đưa nạn nhân lên cáng: xúc thìa',
    label: 'Đưa nạn nhân lên cáng',
    hint: 'Cần di chuyển nạn nhân an toàn',
    keywords: ['xúc thìa', 'lên cáng', 'cáng', 'khiêng', 'xuc thia', 'len cang', 'khieng']
  }
]

const normalize = (text: string) => text.toLowerCase().normalize('NFC')

// Người dùng gọi thẳng tên kỹ thuật (ví dụ "ép bụng") thì mở hướng dẫn 3D ngay
export const guideForText = (text: string) => guides3d.find((guide) => guide.keywords.some((word) => normalize(text).includes(word)))

// Tình huống đã xác nhận có hướng dẫn 3D thì mở hướng dẫn đó thay cho các bước chữ
export const guideForScenario = (scenarioId: string | null | undefined) => (scenarioId ? guides3d.find((guide) => guide.scenarioId === scenarioId) : undefined)
