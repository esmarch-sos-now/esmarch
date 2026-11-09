import { notFound } from "next/navigation";
import AppPage from "@/components/site/app-page";
import { appPages } from "@/content/app";

// Pages that already have a real screen live in their own folders (sos, co-so-y-te, tro-ly).
const BUILT = new Set(["/app/sos", "/app/co-so-y-te", "/app/tro-ly"]);
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
