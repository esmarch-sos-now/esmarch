import { notFound } from "next/navigation";
import Guide3D from "@/components/site/guide-3d";
import { guides3d } from "@/content/guides3d";

export const dynamicParams = false;

export function generateStaticParams() {
  return guides3d.map((guide) => ({ id: guide.id }));
}

export default async function Page({ params }: PageProps<"/app/huong-dan/[id]">) {
  const { id } = await params;
  const guide = guides3d.find((item) => item.id === id);
  if (!guide) notFound();
  return <Guide3D title={guide.title} file={guide.file} />;
}
