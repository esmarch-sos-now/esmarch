import type { ReactNode } from "react";
import Navbar from "@/components/site/landing/Navbar";
import { Page } from "@/components/site/primitives";
import { appNav } from "@/content/app";
import { authCopy } from "@/content/auth";
import { cn } from "@/lib/utils";

/** Page frame for the account screens: app navbar, a centred column and the 115 reminder. */
export default function AuthShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <Page>
      <Navbar appLinks={appNav} />
      <main className={cn("mx-auto flex w-full flex-col gap-6 px-4 pt-10 pb-16", wide ? "max-w-2xl" : "max-w-md")}>
        {children}
        <p className="text-center text-sm text-muted-foreground">
          {authCopy.emergency} <a className="font-bold text-brand" href="tel:115">115</a>.
        </p>
      </main>
    </Page>
  );
}
