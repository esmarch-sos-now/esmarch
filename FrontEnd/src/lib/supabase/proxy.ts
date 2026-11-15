// Supabase session refresh for src/proxy.ts, from the official Supabase Next.js SSR guide
// (https://supabase.com/docs/guides/auth/server-side/nextjs, installed via `shadcn add @supabase/supabase-client-nextjs`).
// Changes from the stock helper: only SOS NOW's protected pages redirect to its own login page, and the cache headers
// @supabase/ssr hands to setAll are applied so no CDN caches a response that sets session cookies.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isProtected, loginUrl } from '@/lib/auth/paths'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })
  let cacheHeaders: Record<string, string> = {}

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          cacheHeaders = { ...cacheHeaders, ...headers }
          Object.entries(cacheHeaders).forEach(([key, value]) => supabaseResponse.headers.set(key, value))
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user && isProtected(request.nextUrl.pathname)) {
    // no user: send them to the login page and back here afterwards. The redirect carries over any cookies
    // (e.g. a cleared session) and cache headers set above, as the guide requires for a new response object.
    const url = new URL(loginUrl(request.nextUrl.pathname + request.nextUrl.search), request.url)
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    Object.entries(cacheHeaders).forEach(([key, value]) => redirect.headers.set(key, value))
    return redirect
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
