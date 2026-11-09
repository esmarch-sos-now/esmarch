import { useEffect, useRef, useState, type RefObject } from "react";

// Trả về true một lần duy nhất khi phần tử cuộn vào màn hình (dùng cho hiệu ứng hiện dần)
export default function useInView<T extends Element = HTMLElement>({ threshold = 0.15 } = {}): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || !("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}
