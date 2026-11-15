import type { ReactNode } from "react";
import AppNav from "@/components/site/app-nav";
import { Page } from "@/components/site/primitives";
import { authCopy } from "@/content/auth";
import { cn } from "@/lib/utils";

/** Page frame for the account screens: app navbar, a centred column and the 115 reminder. `bare` keeps only the logo
 * (no bottom icon bar) and drops the 115 reminder, for the sign-up and sign-in pages. */
export default function AuthShell({ children, wide = false, bare = false }: { children: ReactNode; wide?: boolean; bare?: boolean }) {
  return (
    <Page>
      <AppNav bar={!bare} />
      <main className={cn("mx-auto flex w-full flex-col gap-6 px-4 pt-10 pb-16", wide ? "max-w-2xl" : "max-w-md")}>
        {children}
        {!bare && (
          <p className="text-center text-sm text-muted-foreground">
            {authCopy.emergency} <a className="font-bold text-brand" href="tel:115">115</a>.
          </p>
        )}
      </main>
    </Page>
  );
}
