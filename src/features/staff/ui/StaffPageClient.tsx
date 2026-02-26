"use client";

import { useEffect, useState } from "react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import {
  createStaffInvite,
  getPendingInvites,
  getStaffMembers,
  revokeStaffInvite,
} from "@/app/actions/core/staff";

type Member = {
  user_id: string;
  role: "owner" | "manager" | "staff";
  created_at: string;
};

type Invite = {
  id: string;
  email: string;
  role: "owner" | "manager" | "staff";
  status: "pending" | "accepted" | "revoked" | "expired";
  created_at: string;
  expires_at: string;
};

export default function StaffPageClient() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "staff">("staff");
  const [inviteUrl, setInviteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [memberRows, inviteRows] = await Promise.all([getStaffMembers(), getPendingInvites()]);
      setMembers(memberRows as Member[]);
      setInvites(inviteRows as Invite[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("email", email);
      fd.set("role", role);
      const result = await createStaffInvite(fd);
      setInviteUrl(result.invite_url);
      setEmail("");
      setRole("staff");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setSaving(false);
    }
  }

  async function onRevoke(id: string) {
    try {
      await revokeStaffInvite(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invite");
    }
  }

  return (
    <div className="space-y-4 p-4 pb-28">
      <Card className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Invite Staff</p>
        <form onSubmit={onInvite} className="space-y-2">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@restaurant.com"
            required
          />
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted">
              Role
            </label>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-white/7 px-4 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              value={role}
              onChange={(e) => setRole(e.target.value as "manager" | "staff")}
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <Button type="submit" className="w-full" loading={saving}>
            Create Invite Link
          </Button>
        </form>
        {inviteUrl && (
          <div className="rounded-2xl border border-border bg-white/6 p-3">
            <p className="text-xs text-muted">Share this link with staff:</p>
            <p className="mt-1 break-all text-xs text-foreground">{inviteUrl}</p>
          </div>
        )}
        {error && (
          <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold text-foreground">Pending Invites</p>
        {loading && <p className="text-sm text-muted">Loading...</p>}
        {!loading && invites.length === 0 && <p className="text-sm text-muted">No invites yet.</p>}
        <div className="space-y-2">
          {invites.map((invite) => (
            <div key={invite.id} className="rounded-2xl border border-border/80 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{invite.email}</p>
                  <p className="text-xs text-muted">
                    Expires {new Date(invite.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={invite.role === "manager" ? "warning" : "default"}>
                    {invite.role}
                  </Badge>
                  <Badge
                    variant={
                      invite.status === "pending"
                        ? "info"
                        : invite.status === "accepted"
                          ? "success"
                          : "danger"
                    }
                  >
                    {invite.status}
                  </Badge>
                </div>
              </div>
              {invite.status === "pending" && (
                <button
                  onClick={() => onRevoke(invite.id)}
                  className="mt-2 text-xs font-semibold text-red-300"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold text-foreground">Current Team</p>
        {loading && <p className="text-sm text-muted">Loading...</p>}
        {!loading && members.length === 0 && <p className="text-sm text-muted">No members found.</p>}
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.user_id}
              className="flex items-center justify-between rounded-2xl border border-border/80 bg-white/5 p-3"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{member.user_id}</p>
                <p className="text-xs text-muted">
                  Joined {new Date(member.created_at).toLocaleDateString()}
                </p>
              </div>
              <Badge
                variant={
                  member.role === "owner"
                    ? "success"
                    : member.role === "manager"
                      ? "warning"
                      : "default"
                }
              >
                {member.role}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
