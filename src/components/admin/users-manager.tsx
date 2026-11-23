"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field, Table, TBody, TD, TH, THead, TR } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { api } from "./api";

interface U { id: string; name: string; email: string; role: string; active: boolean; lastLoginAt: string | null; lockedUntil: string | null }

export function UsersManager({ users, me }: { users: U[]; me: string }) {
  const router = useRouter();
  const patch = async (id: string, body: object, msg: string) => {
    try {
      await api(`/api/admin/users/${id}`, "PATCH", body);
      toast.success(msg);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <>
      <div className="mb-4 flex justify-end"><CreateUser /></div>
      <Table>
        <THead><TR><TH>User</TH><TH>Role</TH><TH className="hidden md:table-cell">Last login</TH><TH>Active</TH><TH /></TR></THead>
        <TBody>
          {users.map((u) => (
            <TR key={u.id}>
              <TD><p className="font-medium">{u.name} {u.id === me && <Badge variant="outline">you</Badge>}</p><p className="text-xs text-ink-muted">{u.email}</p>{u.lockedUntil && new Date(u.lockedUntil) > new Date() && <Badge variant="danger">locked</Badge>}</TD>
              <TD>
                <NativeSelect defaultValue={u.role} className="h-9 w-40" disabled={u.id === me} onChange={(e) => patch(u.id, { role: e.target.value }, "Role updated")} aria-label={`Role for ${u.name}`}>
                  <option value="SUPER_ADMIN">Super admin</option><option value="ADMIN">Admin</option><option value="VIEWER">Viewer (read-only)</option>
                </NativeSelect>
              </TD>
              <TD className="hidden text-ink-muted md:table-cell">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-GB") : "never"}</TD>
              <TD><Switch checked={u.active} disabled={u.id === me} onCheckedChange={(c) => patch(u.id, { active: c }, c ? "User activated" : "User deactivated and signed out")} aria-label={`Active ${u.name}`} /></TD>
              <TD><ResetPassword id={u.id} onDone={() => router.refresh()} /></TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </>
  );
}

function CreateUser() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/users", "POST", Object.fromEntries(new FormData(e.currentTarget)));
      toast.success("User created");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><UserPlus /> Add user</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add user</DialogTitle><DialogDescription>Share the initial password through a secure channel and ask the user to change it.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Name" htmlFor="u-name"><Input id="u-name" name="name" required /></Field>
          <Field label="E-mail" htmlFor="u-email"><Input id="u-email" name="email" type="email" required /></Field>
          <Field label="Role" htmlFor="u-role"><NativeSelect id="u-role" name="role" defaultValue="ADMIN" className="h-11"><option value="ADMIN">Admin</option><option value="VIEWER">Viewer (read-only)</option><option value="SUPER_ADMIN">Super admin</option></NativeSelect></Field>
          <Field label="Initial password" htmlFor="u-pass" hint="At least 12 characters with letters and numbers"><Input id="u-pass" name="password" type="password" autoComplete="new-password" minLength={12} required /></Field>
          <DialogFooter><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Create</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPassword({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/admin/users/${id}`, "PATCH", { password: pw });
      toast.success("Password reset — all sessions signed out");
      setOpen(false);
      setPw("");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost"><KeyRound /> Reset password</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Reset password</DialogTitle></DialogHeader>
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (min. 12 characters)" autoComplete="new-password" />
        <DialogFooter><Button onClick={save} disabled={busy || pw.length < 12}>{busy && <Loader2 className="animate-spin" />} Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
