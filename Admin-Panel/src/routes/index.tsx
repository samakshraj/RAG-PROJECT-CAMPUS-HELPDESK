import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Ticket, FileText, Users, ArrowUpRight, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AdminSidebar";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — IIT KGP Helpdesk" },
      { name: "description", content: "Overview of notices, tickets and knowledge documents." },
      { property: "og:title", content: "Dashboard — IIT KGP Helpdesk" },
      {
        property: "og:description",
        content: "Overview of notices, tickets and knowledge documents.",
      },
    ],
  }),
  component: Dashboard,
});

type Overview = {
  active_notices: number;
  open_tickets: number;
  indexed_documents: number;
  students: number;
  recent_tickets: { id: string; subject: string; status: string; created_at: string }[];
};

function Dashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);
  useEffect(
    () =>
      onAuthStateChanged(adminAuth, (user) => {
        if (!user) {
          setOverview(null);
          return;
        }
        void api<Overview>("/admin/overview")
          .then(setOverview)
          .catch((e: unknown) =>
            setError(e instanceof Error ? e.message : "Could not load dashboard."),
          );
      }),
    [],
  );
  const stats = [
    { label: "Active notices", value: overview?.active_notices ?? "—", icon: Bell, to: "/notices" },
    { label: "Open tickets", value: overview?.open_tickets ?? "—", icon: Ticket, to: "/tickets" },
    { label: "Documents indexed", value: overview?.indexed_documents ?? "—", icon: FileText, to: "/documents" },
    { label: "Students served", value: overview?.students ?? "—", icon: Users, to: "/profile", hash: "students" },
  ] as const;
  return (
    <div className="dots -m-6 flex flex-1 flex-col rounded-3xl p-6">
      <PageHeader
        badge="Admin Console"
        title="Welcome, Admin"
        sub="IIT Kharagpur Campus Helpdesk — today across halls, departments & services."
      />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            hash={"hash" in s ? s.hash : undefined}
            className="panel group p-4 transition hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <s.icon className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-accent-foreground" />
            </div>
            <div className="font-display mt-2 text-2xl font-bold">{s.value}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </Link>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="panel mt-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Recent activity</h2>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-destructive"
            disabled={clearing || !(overview?.recent_tickets.length)}
            onClick={() => {
              if (!window.confirm("Clear recent activity from your dashboard? Tickets will not be deleted.")) return;
              setClearing(true);
              void api("/admin/overview/clear-recent-activity", { method: "POST" })
                .then(() => setOverview((current) => current ? { ...current, recent_tickets: [] } : current))
                .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not clear recent activity."))
                .finally(() => setClearing(false));
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
        <ul className="mt-2 divide-y">
          {(overview?.recent_tickets ?? []).map((ticket) => (
            <li key={ticket.id} className="flex justify-between py-2 text-sm">
              <span>
                Ticket: {ticket.subject} · {ticket.status}
              </span>
              <span className="text-muted-foreground">
                {new Date(ticket.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
        {overview && overview.recent_tickets.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">No recent activity.</p>
        )}
      </div>
    </div>
  );
}
