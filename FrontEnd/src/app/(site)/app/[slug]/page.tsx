import { notFound } from "next/navigation";
import AppPage from "@/components/site/app-page";
import { appPages } from "@/content/app";

// Pages that already have a real screen live in their own folders (sos, co-so-y-te, tro-ly, luyen-tap, nguoi-ho-tro, san-sang-ho-tro).
const BUILT = new Set(["/app/sos", "/app/co-so-y-te", "/app/tro-ly", "/app/luyen-tap", "/app/nguoi-ho-tro", "/app/san-sang-ho-tro", "/app/khoa-hoc"]);
const placeholders = appPages.filter((page) => !BUILT.has(page.path));
const slug = (path: string) => path.replace("/app/", "");

export const dynamicParams = false;

export function generateStaticParams() {
  return placeholders.map((page) => ({ slug: slug(page.path) }));
}

export default async function Page({ params }: PageProps<"/app/[slug]">) {
  const { slug: current } = await params;
  const page = placeholders.find((item) => slug(item.path) === current);
  if (!page) notFound();
  return <AppPage {...page} />;
}
