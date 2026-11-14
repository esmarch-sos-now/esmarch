import { BookOpen } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { adminCopy } from "@/content/admin";

/** Placeholder until the courses feature (Hữu's task) has its data model; then this lists and edits courses. */
export default function CoursesPanel() {
  return (
    <Empty className="min-h-[calc(100svh-3rem)]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BookOpen />
        </EmptyMedia>
        <EmptyTitle>{adminCopy.courses.title}</EmptyTitle>
        <EmptyDescription>{adminCopy.courses.lede}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
