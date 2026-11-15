import { redirect } from "next/navigation";

// There is no public course page: the courses are step 1 of becoming a supporter, on the "Sẵn sàng hỗ trợ" page.
// Old links (and bookmarks) to /app/khoa-hoc land there.
export default function Page() {
  redirect("/app/san-sang-ho-tro");
}
