"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/nav/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
} from "@/app/actions/contacts";

interface Contact {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
}

const EMPTY_FORM = {
  name: "",
  company: "",
  role: "",
  phone: "",
  email: "",
  website: "",
  notes: "",
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Contact Form ─────────────────────────────────────────────────────────────

function ContactForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: typeof EMPTY_FORM;
  saving: boolean;
  onSave: (data: typeof EMPTY_FORM) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const set = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="space-y-3">
      <Input label="Name *" placeholder="e.g. John Smith" value={form.name} onChange={set("name")} />
      <Input label="Company" placeholder="e.g. Metro Foods Ltd." value={form.company} onChange={set("company")} />
      <Input label="Role / Type" placeholder="e.g. Produce Distributor" value={form.role} onChange={set("role")} />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Phone" placeholder="+1 (555) 000-0000" value={form.phone} onChange={set("phone")} />
        <Input label="Email" type="email" placeholder="email@example.com" value={form.email} onChange={set("email")} />
      </div>
      <Input label="Website" placeholder="https://..." value={form.website} onChange={set("website")} />
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Notes</p>
        <textarea
          placeholder="Delivery days, minimum order, etc."
          value={form.notes}
          onChange={set("notes")}
          rows={3}
          className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} loading={saving} disabled={!form.name.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    getContacts()
      .then((rows) => setContacts(rows as Contact[]))
      .catch(() => setError("Failed to load contacts"))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(data: typeof EMPTY_FORM) {
    setAddSaving(true);
    setError("");
    try {
      const created = await createContact(data) as Contact;
      setContacts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAdd(false);
    } catch {
      setError("Failed to save contact");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleUpdate(id: string, data: typeof EMPTY_FORM) {
    setEditSaving(true);
    setError("");
    try {
      await updateContact(id, data);
      setContacts((prev) =>
        prev
          .map((c) => (c.id === id ? { ...c, ...data, company: data.company || null, role: data.role || null, phone: data.phone || null, email: data.email || null, website: data.website || null, notes: data.notes || null } : c))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditId(null);
    } catch {
      setError("Failed to update contact");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError("");
    try {
      await deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Failed to delete contact");
    } finally {
      setDeletingId(null);
    }
  }

  const editContact = contacts.find((c) => c.id === editId);

  return (
    <>
      <PageHeader
        title="Contacts"
        action={
          !showAdd && (
            <Button size="sm" onClick={() => { setShowAdd(true); setEditId(null); }}>
              + Add
            </Button>
          )
        }
      />

      <div className="p-4 space-y-3">
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <Card className="p-5">
            <p className="text-sm font-semibold mb-4">New Contact</p>
            <ContactForm
              initial={EMPTY_FORM}
              saving={addSaving}
              onSave={handleAdd}
              onCancel={() => setShowAdd(false)}
            />
          </Card>
        )}

        {loading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-3xl border border-border bg-card p-4 animate-pulse">
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-2xl bg-black/[0.06]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-28 rounded-lg bg-black/[0.06]" />
                    <div className="h-3 w-20 rounded-lg bg-black/[0.04]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && contacts.length === 0 && !showAdd && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-black/[0.04] flex items-center justify-center">
              <svg className="w-8 h-8 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <p className="font-semibold text-muted">No contacts yet</p>
            <p className="text-sm text-muted mt-1">Tap + Add to save a distributor or contact</p>
          </div>
        )}

        {/* Contact list */}
        {contacts.map((contact) => (
          <Card key={contact.id} className="p-4">
            {editId === contact.id ? (
              <>
                <p className="text-sm font-semibold mb-4">Edit Contact</p>
                <ContactForm
                  initial={{
                    name: contact.name,
                    company: contact.company ?? "",
                    role: contact.role ?? "",
                    phone: contact.phone ?? "",
                    email: contact.email ?? "",
                    website: contact.website ?? "",
                    notes: contact.notes ?? "",
                  }}
                  saving={editSaving}
                  onSave={(data) => handleUpdate(contact.id, data)}
                  onCancel={() => setEditId(null)}
                />
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">{initials(contact.name)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{contact.name}</p>
                    {(contact.company || contact.role) && (
                      <p className="text-xs text-muted truncate">
                        {[contact.role, contact.company].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => { setEditId(contact.id); setShowAdd(false); }}
                      className="w-8 h-8 rounded-xl bg-black/[0.04] flex items-center justify-center text-muted hover:text-foreground transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      disabled={deletingId === contact.id}
                      className="w-8 h-8 rounded-xl bg-black/[0.04] flex items-center justify-center text-muted hover:text-danger transition-colors"
                    >
                      {deletingId === contact.id ? (
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Contact details */}
                {(contact.phone || contact.email || contact.website) && (
                  <div className="mt-3 space-y-1.5 pl-[52px]">
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                        </svg>
                        {contact.phone}
                      </a>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                        </svg>
                        {contact.email}
                      </a>
                    )}
                    {contact.website && (
                      <a
                        href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                        </svg>
                        {contact.website.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                  </div>
                )}

                {contact.notes && (
                  <p className="mt-2 text-xs text-muted pl-[52px] leading-relaxed">
                    {contact.notes}
                  </p>
                )}
              </>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
