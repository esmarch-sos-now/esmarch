import Navbar from "@/components/site/landing/Navbar";
import { Page } from "@/components/site/primitives";
import { appNav, type AppPageDef } from "@/content/app";
import { cn } from "@/lib/utils";

// Trang rỗng dùng chung: tiêu đề kèm mô tả chức năng, hoặc dòng Coming Soon với tính năng chưa làm
export default function AppPage({ title, description, comingSoon = false }: Pick<AppPageDef, "title" | "description" | "comingSoon">) {
  return (
    <Page>
      <Navbar appLinks={appNav} />
      <main
        className={cn(
          "mx-auto min-h-[calc(100vh-68px)] w-full max-w-205 px-4 pt-10 pb-16 max-lg:min-h-[calc(100vh-56px)]",
          comingSoon && "flex flex-col items-center justify-center text-center",
        )}
      >
        <h1 className="text-[clamp(30px,4vw,44px)] leading-[1.15] font-black tracking-[-.01em] text-ink">{title}</h1>
        {comingSoon ? (
          <p className="mt-3.5 rounded-full bg-brand-soft px-4.5 py-1.5 text-[15px] font-bold tracking-[.08em] text-brand uppercase">Coming Soon</p>
        ) : (
          <p className="mt-3 max-w-160 text-[17px] leading-[1.6] text-muted-foreground">{description}</p>
        )}
        <p className={cn("mt-10 pt-4 text-sm text-muted-foreground", !comingSoon && "border-t border-line")}>
          Trong nguy hiểm tính mạng, hãy gọi ngay <a className="font-bold text-brand" href="tel:115">115</a>.
        </p>
      </main>
    </Page>
  );
}
