"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { adminCopy } from "@/content/admin";
import { useLogout } from "@/hooks/use-auth";
import { LOGIN_PATH } from "@/lib/auth/paths";

const copy = adminCopy.forbidden;

/** /admin for a signed-in account without the ADMIN role (or one demoted while its token still said ADMIN). */
export default function AdminForbidden() {
  const router = useRouter();
  const logout = useLogout();
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Empty className="max-w-md border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlert />
          </EmptyMedia>
          <EmptyTitle>{copy.title}</EmptyTitle>
          <EmptyDescription>{copy.lede}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button asChild variant="outline">
            <Link href="/">{copy.home}</Link>
          </Button>
          <Button
            disabled={logout.isMutating}
            onClick={async () => {
              await logout.trigger({ everywhere: false }).catch(() => undefined);
              router.replace(LOGIN_PATH);
            }}
          >
            {copy.logout}
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
