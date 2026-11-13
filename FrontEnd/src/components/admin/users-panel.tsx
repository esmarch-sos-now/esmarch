"use client";

import { useEffect, useState } from "react";
import { Layers, Lock, LockOpen, MoreHorizontal, Search, ShieldCheck, UserRound, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormAlert } from "@/components/auth/form-fields";
import { adminCopy } from "@/content/admin";
import { useSession } from "@/hooks/use-auth";
import { PAGE_SIZE, useAdminUsers, type AdminUser, type Role, type UserView } from "@/hooks/use-admin";
import { formatPhone } from "@/lib/auth/schemas";
import { adminErrorMessage } from "./admin-error";
import ConfirmAction from "./confirm-action";
import { BulkBar, Chip, Mark, ViewTabs, formatDate, headCell } from "./table-kit";

const copy = adminCopy.users;

type Pending =
  | { kind: "role"; user: AdminUser; role: Role }
  | { kind: "lock"; user: AdminUser }
  | { kind: "bulk-lock"; ids: string[] }
  | null;

const nameOf = (user: AdminUser) => user.displayName || copy.noName;

const views: { value: UserView; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: copy.views.all, icon: <Layers /> },
  { value: "admin", label: copy.views.admin, icon: <ShieldCheck /> },
  { value: "user", label: copy.views.user, icon: <UserRound /> },
  { value: "locked", label: copy.views.locked, icon: <UserX /> },
];

export default function UsersPanel() {
  const { user: me } = useSession();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<UserView>("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, error: loadError, isLoading, update } = useAdminUsers(query, view, page);

  // Search as you type, a moment after the last key.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
      setSelected(new Set());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function apply(ids: string[], change: { role?: Role; isActive?: boolean }) {
    setError(null);
    try {
      await update(ids, change);
      setSelected(new Set());
    } catch (e) {
      setError(adminErrorMessage(e));
    }
  }

  const rows = data?.items ?? [];
  const selectable = rows.filter((user) => user.id !== me?.id);
  const allSelected = selectable.length > 0 && selectable.every((user) => selected.has(user.id));
  const chosen = rows.filter((user) => selected.has(user.id));
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <ViewTabs
          views={views}
          value={view}
          onChange={(next) => {
            setView(next);
            setPage(0);
            setSelected(new Set());
          }}
        />
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.search}
            aria-label={copy.search}
            className="h-8 pl-8"
            maxLength={100}
          />
        </div>
      </div>

      {(error || loadError) && (
        <div className="px-4 pt-3">
          <FormAlert error={error ?? adminCopy.errors.load} />
        </div>
      )}

      {chosen.length > 0 && (
        <BulkBar label={adminCopy.bulk.selected(chosen.length)} onClear={() => setSelected(new Set())} clearLabel={adminCopy.bulk.clear}>
          {chosen.some((user) => user.isActive) && (
            <Button variant="outline" size="sm" onClick={() => setPending({ kind: "bulk-lock", ids: chosen.filter((u) => u.isActive).map((u) => u.id) })}>
              <Lock data-icon="inline-start" />
              {adminCopy.bulk.lock}
            </Button>
          )}
          {chosen.some((user) => !user.isActive) && (
            <Button variant="outline" size="sm" onClick={() => apply(chosen.filter((u) => !u.isActive).map((u) => u.id), { isActive: true })}>
              <LockOpen data-icon="inline-start" />
              {adminCopy.bulk.unlock}
            </Button>
          )}
        </BulkBar>
      )}

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(on) => setSelected(on === true ? new Set(selectable.map((user) => user.id)) : new Set())}
                aria-label={adminCopy.bulk.selectAll}
              />
            </TableHead>
            <TableHead className={headCell}>{copy.columns.name(total)}</TableHead>
            <TableHead className={headCell}>{copy.columns.contact}</TableHead>
            <TableHead className={headCell}>{copy.columns.role}</TableHead>
            <TableHead className={headCell}>{copy.columns.status}</TableHead>
            <TableHead className={headCell}>{copy.columns.joined}</TableHead>
            <TableHead className={headCell}>{copy.columns.tags}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && !data && (
            <TableRow>
              <TableCell colSpan={7} className="py-16 text-center">
                <Spinner className="mx-auto" />
              </TableCell>
            </TableRow>
          )}
          {data && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">{copy.empty}</TableCell>
            </TableRow>
          )}
          {rows.map((user) => {
            const self = user.id === me?.id;
            const name = nameOf(user);
            return (
              <TableRow key={user.id} data-state={selected.has(user.id) ? "selected" : undefined} data-testid="admin-user-row">
                <TableCell className="pl-4">
                  <Checkbox
                    checked={selected.has(user.id)}
                    disabled={self}
                    onCheckedChange={(on) => toggle(user.id, on === true)}
                    aria-label={adminCopy.bulk.selectRow(name)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Mark id={user.id} name={name} />
                    <span className="font-medium">{name}</span>
                    <UserMenu
                      user={user}
                      self={self}
                      onRole={(role) => setPending({ kind: "role", user, role })}
                      onLock={() => setPending({ kind: "lock", user })}
                      onUnlock={() => apply([user.id], { isActive: true })}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-sky-700">{user.phone ? formatPhone(user.phone) : user.email}</TableCell>
                <TableCell>
                  <Chip tone={user.role === "ADMIN" ? "violet" : "gray"}>{adminCopy.roles[user.role]}</Chip>
                </TableCell>
                <TableCell>
                  {user.isActive ? <Chip tone="emerald">{copy.active}</Chip> : <Chip tone="rose">{copy.locked}</Chip>}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {self && <Chip tone="amber">{copy.you}</Chip>}
                    {user.isResponder && <Chip tone="sky">{copy.responder}</Chip>}
                    {!user.verified && <Chip tone="fuchsia">{copy.unverified}</Chip>}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 border-t px-4 py-2 text-sm text-muted-foreground">
          <span>{copy.page(from, to, total)}</span>
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>{copy.prev}</Button>
          <Button variant="outline" size="sm" disabled={to >= total} onClick={() => setPage(page + 1)}>{copy.next}</Button>
        </div>
      )}

      <ConfirmAction
        open={pending?.kind === "role"}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.kind === "role" ? copy.confirmRole.title(nameOf(pending.user), adminCopy.roles[pending.role]) : ""}
        body={pending?.kind === "role" && pending.role === "ADMIN" ? copy.confirmRole.toAdmin : copy.confirmRole.toUser}
        confirm={copy.confirmRole.confirm}
        onConfirm={async () => {
          if (pending?.kind === "role") await apply([pending.user.id], { role: pending.role });
        }}
      />
      <ConfirmAction
        open={pending?.kind === "lock"}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.kind === "lock" ? copy.confirmLock.title(nameOf(pending.user)) : ""}
        body={copy.confirmLock.body}
        confirm={copy.confirmLock.confirm}
        destructive
        onConfirm={async () => {
          if (pending?.kind === "lock") await apply([pending.user.id], { isActive: false });
        }}
      />
      <ConfirmAction
        open={pending?.kind === "bulk-lock"}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.kind === "bulk-lock" ? copy.confirmBulkLock.title(pending.ids.length) : ""}
        body={copy.confirmBulkLock.body}
        confirm={copy.confirmBulkLock.confirm}
        destructive
        onConfirm={async () => {
          if (pending?.kind === "bulk-lock") await apply(pending.ids, { isActive: false });
        }}
      />
    </div>
  );
}

/** The "⋯" next to a name: change role, lock or unlock. Disabled for your own account. */
function UserMenu({
  user,
  self,
  onRole,
  onLock,
  onUnlock,
}: {
  user: AdminUser;
  self: boolean;
  onRole: (role: Role) => void;
  onLock: () => void;
  onUnlock: () => void;
}) {
  const menu = copy.menu;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label={menu.label(nameOf(user))}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {self ? (
          <DropdownMenuLabel className="text-muted-foreground">{menu.self}</DropdownMenuLabel>
        ) : (
          <>
            {user.role === "ADMIN" ? (
              <DropdownMenuItem onSelect={() => onRole("USER")}>
                <UserRound />
                {menu.makeUser}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onRole("ADMIN")}>
                <ShieldCheck />
                {menu.makeAdmin}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {user.isActive ? (
              <DropdownMenuItem variant="destructive" onSelect={onLock}>
                <Lock />
                {menu.lock}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={onUnlock}>
                <LockOpen />
                {menu.unlock}
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
