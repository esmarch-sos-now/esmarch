"use client";

import { useState } from "react";
import { CheckCircle2, Hourglass, Layers, MoreHorizontal, PauseCircle, PlayCircle, Radio, Search, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormAlert } from "@/components/auth/form-fields";
import { adminCopy } from "@/content/admin";
import { formatCourseDate } from "@/content/app";
import { useAdminResponders, type AdminResponder } from "@/hooks/use-admin";
import { formatPhone } from "@/lib/auth/phone";
import { cn } from "@/lib/utils";
import { adminErrorMessage } from "./admin-error";
import ConfirmAction from "./confirm-action";
import { BulkBar, Chip, Mark, ViewTabs, headCell, type Tone } from "./table-kit";

const copy = adminCopy.responders;

type View = "all" | "pending" | "online" | "suspended";
type Pending =
  | { kind: "suspend"; responder: AdminResponder }
  | { kind: "remove"; responder: AdminResponder }
  | { kind: "reject"; responder: AdminResponder }
  | { kind: "bulk-suspend"; ids: string[] }
  | null;

const views: { value: View; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: copy.views.all, icon: <Layers /> },
  { value: "pending", label: copy.views.pending, icon: <Hourglass /> },
  { value: "online", label: copy.views.online, icon: <Radio /> },
  { value: "suspended", label: copy.views.suspended, icon: <PauseCircle /> },
];

const skillTones: Record<string, Tone> = { FIRST_AID: "emerald", CPR: "rose", AED: "amber", PEDIATRIC: "sky" };

function matches(responder: AdminResponder, view: View, query: string): boolean {
  if (view === "online" && !responder.online) return false;
  if (view === "pending" && responder.status !== "pending") return false;
  if (view === "suspended" && responder.status !== "suspended") return false;
  if (!query) return true;
  const q = query.toLowerCase();
  const digits = q.replace(/[\s.()-]/g, "");
  const phones = [responder.contactPhone, responder.account?.phone ?? "", responder.account?.phone ? formatPhone(responder.account.phone) : ""];
  return (
    responder.displayName.toLowerCase().includes(q) ||
    (responder.account?.email ?? "").toLowerCase().includes(q) ||
    (digits.length > 0 && phones.some((phone) => phone.replace(/[\s.()-]/g, "").includes(digits.replace(/^0/, ""))))
  );
}

export default function RespondersPanel() {
  const { data, error: loadError, isLoading, update, remove } = useAdminResponders();
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
      setSelected(new Set());
    } catch (e) {
      setError(adminErrorMessage(e));
    }
  }

  const rows = (data ?? []).filter((responder) => matches(responder, view, search.trim()));
  const chosen = rows.filter((responder) => selected.has(responder.id));
  const allSelected = rows.length > 0 && rows.every((responder) => selected.has(responder.id));

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
          {chosen.some((r) => r.status === "pending") && (
            <Button variant="outline" size="sm" onClick={() => run(() => update(chosen.filter((r) => r.status === "pending").map((r) => r.id), { verified: true }))}>
              <CheckCircle2 data-icon="inline-start" />
              {adminCopy.bulk.approve}
            </Button>
          )}
          {chosen.some((r) => r.verified) && (
            <Button variant="outline" size="sm" onClick={() => setPending({ kind: "bulk-suspend", ids: chosen.filter((r) => r.verified).map((r) => r.id) })}>
              <PauseCircle data-icon="inline-start" />
              {adminCopy.bulk.suspend}
            </Button>
          )}
          {chosen.some((r) => r.status === "suspended") && (
            <Button variant="outline" size="sm" onClick={() => run(() => update(chosen.filter((r) => r.status === "suspended").map((r) => r.id), { verified: true }))}>
              <PlayCircle data-icon="inline-start" />
              {adminCopy.bulk.reinstate}
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
                onCheckedChange={(on) => setSelected(on === true ? new Set(rows.map((r) => r.id)) : new Set())}
                aria-label={adminCopy.bulk.selectAll}
              />
            </TableHead>
            <TableHead className={headCell}>{copy.columns.name(rows.length)}</TableHead>
            <TableHead className={headCell}>{copy.columns.phone}</TableHead>
            <TableHead className={headCell}>{copy.columns.account}</TableHead>
            <TableHead className={headCell}>{copy.columns.skills}</TableHead>
            <TableHead className={headCell}>{copy.columns.status}</TableHead>
            <TableHead className={headCell}>{copy.columns.source}</TableHead>
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
              <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                {data.length === 0 ? copy.empty : copy.noMatch}
              </TableCell>
            </TableRow>
          )}
          {rows.map((responder) => (
            <TableRow key={responder.id} data-state={selected.has(responder.id) ? "selected" : undefined} data-testid="admin-responder-row">
              <TableCell className="pl-4">
                <Checkbox
                  checked={selected.has(responder.id)}
                  onCheckedChange={(on) => toggle(responder.id, on === true)}
                  aria-label={adminCopy.bulk.selectRow(responder.displayName)}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Mark id={responder.id} name={responder.displayName} />
                  <span className="font-medium">{responder.displayName}</span>
                  <ResponderMenu
                    responder={responder}
                    onSuspend={() => setPending({ kind: "suspend", responder })}
                    onReinstate={() => run(() => update([responder.id], { verified: true }))}
                    onReject={() => setPending({ kind: "reject", responder })}
                    onRemove={() => setPending({ kind: "remove", responder })}
                  />
                </div>
              </TableCell>
              <TableCell>{responder.contactPhone}</TableCell>
              <TableCell className="text-sky-700">
                {responder.account ? (
                  <>
                    {responder.account.phone ? formatPhone(responder.account.phone) : responder.account.email}
                    {responder.notifyEmail && <span className="block text-xs text-muted-foreground">{responder.notifyEmail}</span>}
                  </>
                ) : (
                  <span className="text-muted-foreground">{copy.noAccount}</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {responder.skills.map((skill) => (
                    <Chip key={skill} tone={skillTones[skill] ?? "gray"}>{adminCopy.skills[skill] ?? skill}</Chip>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {responder.status === "verified" && <Chip tone="emerald">{copy.verified}</Chip>}
                  {responder.status === "suspended" && <Chip tone="rose">{copy.suspended}</Chip>}
                  {responder.status === "pending" ? (
                    <Chip tone="amber">{copy.pending}</Chip>
                  ) : responder.online ? (
                    <Chip tone="sky">{copy.online}</Chip>
                  ) : (
                    <Chip tone="gray">{copy.offline}</Chip>
                  )}
                </div>
                {responder.appliedAt && <span className="mt-1 block text-xs text-muted-foreground">{copy.appliedOn(formatCourseDate(responder.appliedAt))}</span>}
                {responder.status === "verified" && responder.notifyEmail && (
                  <span className={cn("mt-0.5 block text-xs", responder.notifiedAt ? "text-muted-foreground" : "text-amber-700")}>
                    {responder.notifiedAt ? copy.mailed : copy.notMailed}
                  </span>
                )}
              </TableCell>
              <TableCell>
                {responder.completedCourses.length > 0 ? (
                  <ul className="grid max-w-56 gap-0.5" title={responder.verificationSource}>
                    {responder.completedCourses.map((course) => (
                      <li key={course.id} className="truncate text-muted-foreground">
                        {course.title} · {formatCourseDate(course.completedAt)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="block max-w-44 truncate text-muted-foreground" title={responder.verificationSource}>
                    {responder.account ? copy.noCourses : responder.verificationSource}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmAction
        open={pending?.kind === "suspend"}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.kind === "suspend" ? copy.confirmSuspend.title(pending.responder.displayName) : ""}
        body={copy.confirmSuspend.body}
        confirm={copy.confirmSuspend.confirm}
        onConfirm={async () => {
          if (pending?.kind === "suspend") await run(() => update([pending.responder.id], { verified: false }));
        }}
      />
      <ConfirmAction
        open={pending?.kind === "bulk-suspend"}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.kind === "bulk-suspend" ? copy.confirmBulkSuspend.title(pending.ids.length) : ""}
        body={copy.confirmBulkSuspend.body}
        confirm={copy.confirmBulkSuspend.confirm}
        onConfirm={async () => {
          if (pending?.kind === "bulk-suspend") await run(() => update(pending.ids, { verified: false }));
        }}
      />
      <ConfirmAction
        open={pending?.kind === "reject"}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.kind === "reject" ? copy.confirmReject.title(pending.responder.displayName) : ""}
        body={copy.confirmReject.body}
        confirm={copy.confirmReject.confirm}
        destructive
        onConfirm={async () => {
          if (pending?.kind === "reject") await run(() => remove(pending.responder.id));
        }}
      />
      <ConfirmAction
        open={pending?.kind === "remove"}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.kind === "remove" ? copy.confirmRemove.title(pending.responder.displayName) : ""}
        body={copy.confirmRemove.body}
        confirm={copy.confirmRemove.confirm}
        destructive
        onConfirm={async () => {
          if (pending?.kind === "remove") await run(() => remove(pending.responder.id));
        }}
      />
    </div>
  );
}

function ResponderMenu({
  responder,
  onSuspend,
  onReinstate,
  onReject,
  onRemove,
}: {
  responder: AdminResponder;
  onSuspend: () => void;
  onReinstate: () => void;
  onReject: () => void;
  onRemove: () => void;
}) {
  const menu = copy.menu;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label={menu.label(responder.displayName)}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {responder.status === "pending" && (
          <>
            <DropdownMenuItem onSelect={onReinstate}>
              <CheckCircle2 />
              {menu.approve}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onReject}>
              <XCircle />
              {menu.reject}
            </DropdownMenuItem>
          </>
        )}
        {responder.status === "verified" && (
          <DropdownMenuItem onSelect={onSuspend}>
            <PauseCircle />
            {menu.suspend}
          </DropdownMenuItem>
        )}
        {responder.status === "suspended" && (
          <DropdownMenuItem onSelect={onReinstate}>
            <PlayCircle />
            {menu.reinstate}
          </DropdownMenuItem>
        )}
        {responder.status !== "pending" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onRemove}>
              <Trash2 />
              {menu.remove}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
