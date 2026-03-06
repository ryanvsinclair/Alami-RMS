"use client";

import { useEffect, useState } from "react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
} from "@/app/actions/core/contacts";

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
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

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
  const setField =
    (field: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-3">
      <Input label="Name *" placeholder="e.g. John Smith" value={form.name} onChange={setField("name")} />
      <Input label="Company" placeholder="e.g. Metro Foods Ltd." value={form.company} onChange={setField("company")} />
      <Input label="Role / Type" placeholder="e.g. Produce Distributor" value={form.role} onChange={setField("role")} />
      <div className="grid gap-2 md:grid-cols-2">
        <Input label="Phone" placeholder="+1 (555) 000-0000" value={form.phone} onChange={setField("phone")} />
        <Input label="Email" type="email" placeholder="email@example.com" value={form.email} onChange={setField("email")} />
      </div>
      <Input label="Website" placeholder="https://..." value={form.website} onChange={setField("website")} />
      <div className="space-y-1.5">
        <p className="text-xs font-semibold normal-case tracking-normal text-muted">Notes</p>
        <textarea
          placeholder="Delivery days, minimum order, etc."
          value={form.notes}
          onChange={setField("notes")}
          rows={3}
          className="w-full resize-none rounded-[10px] border border-border bg-[var(--fill-tertiary)] px-4 py-3 text-sm text-foreground placeholder:text-muted/70 focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(form)} loading={saving} disabled={!form.name.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
}

export default function ContactsPageClient() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

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
      const created = (await createContact(data)) as Contact;
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
          .map((contact) =>
            contact.id === id
              ? {
                  ...contact,
                  ...data,
                  company: data.company || null,
                  role: data.role || null,
                  phone: data.phone || null,
                  email: data.email || null,
                  website: data.website || null,
                  notes: data.notes || null,
                }
              : contact,
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
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
      setContacts((prev) => prev.filter((contact) => contact.id !== id));
      if (editId === id) setEditId(null);
    } catch {
      setError("Failed to delete contact");
    } finally {
      setDeletingId(null);
    }
  }

  const selectedContact = editId ? contacts.find((contact) => contact.id === editId) ?? null : null;
  const showEditor = showAdd || Boolean(selectedContact);

  return (
    <div className="space-y-3 p-4 md:p-5 xl:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Contacts</p>
        <div className="flex items-center gap-2">
          {showEditor && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setShowAdd(false);
                setEditId(null);
              }}
            >
              Close
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setShowAdd(true);
              setEditId(null);
            }}
          >
            + Add
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] xl:items-start">
        <section className="space-y-2">
          {loading && (
            <div className="space-y-2">
              {[0, 1, 2].map((index) => (
                <div key={index} className="animate-pulse rounded-3xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-foreground/[0.06]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-28 rounded-lg bg-foreground/[0.06]" />
                      <div className="h-3 w-20 rounded-lg bg-foreground/[0.04]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && contacts.length === 0 && !showAdd && (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-foreground/[0.04]">
                <svg className="h-8 w-8 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
              <p className="font-semibold text-muted">No contacts yet</p>
              <p className="mt-1 text-sm text-muted">Tap + Add to save a distributor or contact</p>
            </div>
          )}

          {!loading && contacts.length > 0 && (
            <div className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0 xl:grid-cols-1">
              {contacts.map((contact) => (
                <Card key={contact.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <span className="text-sm font-bold text-primary">{initials(contact.name)}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{contact.name}</p>
                      {(contact.company || contact.role) && (
                        <p className="truncate text-xs text-muted">
                          {[contact.role, contact.company].filter(Boolean).join(" | ")}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() => {
                          setEditId(contact.id);
                          setShowAdd(false);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground/[0.04] text-muted transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        disabled={deletingId === contact.id}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground/[0.04] text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        {deletingId === contact.id ? (
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {(contact.phone || contact.email || contact.website) && (
                    <div className="mt-3 space-y-1.5 pl-[52px]">
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                          {contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
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
                          {contact.website.replace(/^https?:\/\//, "")}
                        </a>
                      )}
                    </div>
                  )}

                  {contact.notes && (
                    <p className="mt-2 pl-[52px] text-xs leading-relaxed text-muted">
                      {contact.notes}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        <aside className={`${showEditor ? "block" : "hidden xl:block"} xl:sticky xl:top-6 xl:self-start`}>
          {showAdd && (
            <Card className="p-5">
              <p className="mb-4 text-sm font-semibold">New Contact</p>
              <ContactForm
                initial={EMPTY_FORM}
                saving={addSaving}
                onSave={handleAdd}
                onCancel={() => setShowAdd(false)}
              />
            </Card>
          )}

          {!showAdd && selectedContact && (
            <Card className="p-5">
              <p className="mb-4 text-sm font-semibold">Edit Contact</p>
              <ContactForm
                initial={{
                  name: selectedContact.name,
                  company: selectedContact.company ?? "",
                  role: selectedContact.role ?? "",
                  phone: selectedContact.phone ?? "",
                  email: selectedContact.email ?? "",
                  website: selectedContact.website ?? "",
                  notes: selectedContact.notes ?? "",
                }}
                saving={editSaving}
                onSave={(data) => handleUpdate(selectedContact.id, data)}
                onCancel={() => setEditId(null)}
              />
            </Card>
          )}

          {!showEditor && (
            <Card className="p-5">
              <p className="text-sm font-semibold text-foreground">Contact Details</p>
              <p className="mt-1 text-sm text-muted">
                Select a contact to edit details, or add a new supplier/contact.
              </p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
