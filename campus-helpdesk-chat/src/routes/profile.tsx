import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserRound, Save, LockKeyhole, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScreenHeading } from "@/components/screen-heading";
import { SignInPrompt, useStudentAccount } from "@/components/student-account";
import { pageHead, profileOptions } from "@/lib/student-data";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/profile")({
  head: () => pageHead("My profile", "Manage your student details and update your password."),
  component: Profile,
});

function Profile() {
  const { user, profileId, signOut } = useStudentAccount();
  const client = useQueryClient();
  const query = useQuery({ ...profileOptions(profileId ?? ""), enabled: Boolean(profileId) });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletionConfirmation, setDeletionConfirmation] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !profileId) return;
    setBusy(true);
    setMessage("");
    const form = new FormData(e.currentTarget);
    try {
      await api("/profile", {
        method: "PUT",
        body: JSON.stringify({
          full_name: String(form.get("full_name")).trim(),
          student_id: String(form.get("student_id")).trim(),
          department: String(form.get("department")).trim(),
          course: String(form.get("course")).trim(),
          year: String(form.get("year")).trim(),
          phone: String(form.get("phone")).trim(),
        }),
      });
      await client.invalidateQueries({ queryKey: ["profile", profileId] });
      setMessage("Student details saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (deletionConfirmation !== "DELETE MY ACCOUNT") {
      setMessage("Type DELETE MY ACCOUNT to confirm.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api("/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: deletionConfirmation }),
      });
      await signOut();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete your account.");
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    if (newPassword.length < 8) {
      setMessage("Use a password with at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api("/account/password", {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      });
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Your password was updated successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="student-screen">
      <ScreenHeading title="My profile" subtitle="Your own corner of campus." />
      {!user ? (
        <SignInPrompt action="view and save your student details" />
      ) : query.isPending ? (
        <p>Loading profile…</p>
      ) : query.isError ? (
        <p role="alert">
          Could not load your profile.{" "}
          <Button variant="link" onClick={() => query.refetch()}>
            Retry
          </Button>
        </p>
      ) : (
        <div className="max-w-3xl">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-accent text-primary">
              <UserRound size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{query.data?.full_name || "Student"}</h2>
              <p className="mt-1 break-all text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2" key={query.data?.id}>
            {(
              [
                { key: "full_name", label: "Full name" },
                { key: "student_id", label: "Student ID" },
                { key: "department", label: "Department" },
                { key: "course", label: "Course" },
                { key: "year", label: "Year / semester" },
                { key: "phone", label: "Phone number" },
              ] as const
            ).map((field) => (
              <label className="field-label" key={field.key}>
                {field.label}
                <input
                  className="student-input"
                  name={field.key}
                  defaultValue={query.data?.[field.key]}
                  required={field.key === "full_name"}
                  maxLength={120}
                />
              </label>
            ))}
            <div className="sm:col-span-2">
              <Button disabled={busy}>
                <Save />
                {busy ? "Please wait…" : "Save details"}
              </Button>
            </div>
          </form>
          <section className="mt-10 border-t border-border pt-7">
            <h2 className="font-bold">Update password</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Set a new password here. No email reset link is needed.
            </p>
            <form onSubmit={changePassword} className="mt-4 grid gap-5 sm:grid-cols-2">
              <label className="field-label">
                New password
                <input
                  className="student-input"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
              <label className="field-label">
                Confirm new password
                <input
                  className="student-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
              <div className="sm:col-span-2">
                <Button disabled={busy}>
                  <LockKeyhole />
                  {busy ? "Please wait…" : "Update password"}
                </Button>
              </div>
            </form>
          </section>
          <section className="mt-10 border-t border-destructive/30 pt-7">
            <h2 className="font-bold text-destructive">Delete account</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Permanently delete your sign-in, profile, tickets, reminders, and chat history.
            </p>
            <Button
              className="mt-4"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setDeletionConfirmation("");
                setDeleteOpen(true);
              }}
            >
              <Trash2 />
              Delete my account
            </Button>
          </section>
        </div>
      )}
      {message && (
        <p role="status" className="mt-5 text-sm text-primary">
          {message}
        </p>
      )}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Type <strong>DELETE MY ACCOUNT</strong> to continue.
            </DialogDescription>
          </DialogHeader>
          <label className="field-label">
            Confirmation
            <input
              className="student-input"
              value={deletionConfirmation}
              onChange={(event) => setDeletionConfirmation(event.target.value)}
              autoComplete="off"
            />
          </label>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={deleteAccount}>
              {busy ? "Deleting…" : "Permanently delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
