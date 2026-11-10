import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import type { Reminder } from "@/lib/student-data";
import { reminderOptions } from "@/lib/student-data";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStudentAccount } from "./student-account";

const CHECK_INTERVAL_MS = 15_000;

export function ReminderAlerts() {
  const { user, profileId } = useStudentAccount();
  const navigate = useNavigate();
  const announcedIds = useRef(new Set<string>());
  const audioContext = useRef<AudioContext | null>(null);
  const [activeReminder, setActiveReminder] = useState<Reminder | null>(null);
  const query = useQuery({
    ...reminderOptions(profileId ?? ""),
    enabled: Boolean(user && profileId),
    refetchInterval: CHECK_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  const unlockSound = useCallback(() => {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    if (!audioContext.current) audioContext.current = new AudioContextClass();
    const context = audioContext.current;
    if (context.state === "running") return;
    // This is called directly from a click or key press. The silent pulse marks
    // the audio context as user-approved, so a later reminder can play on time.
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = 0.00001;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.01);
    void context.resume().catch(() => undefined);
  }, []);

  const playAlarm = useCallback(() => {
    const context = audioContext.current;
    if (!context || context.state !== "running") return;
    const start = context.currentTime;
    for (const [offset, frequency] of [
      [0, 784],
      [0.22, 988],
      [0.44, 784],
      [0.8, 784],
      [1.02, 988],
      [1.24, 784],
    ]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.28, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.2);
    }
  }, []);

  const announcedStorageKey = user ? `campus-helpdesk:reminders:${user.uid}` : "";

  const alertKey = useCallback(
    (reminder: Reminder) => `${reminder.id}:${reminder.due_at}:${reminder.title}`,
    [],
  );

  const wasAnnounced = useCallback(
    (reminder: Reminder) => {
      const key = alertKey(reminder);
      if (announcedIds.current.has(key)) return true;
      try {
        return announcedStorageKey
          ? JSON.parse(sessionStorage.getItem(announcedStorageKey) || "[]").includes(key)
          : false;
      } catch {
        return false;
      }
    },
    [alertKey, announcedStorageKey],
  );

  const rememberAnnouncement = useCallback(
    (reminder: Reminder) => {
      const key = alertKey(reminder);
      announcedIds.current.add(key);
      try {
        if (!announcedStorageKey) return;
        const remembered = JSON.parse(sessionStorage.getItem(announcedStorageKey) || "[]");
        sessionStorage.setItem(
          announcedStorageKey,
          JSON.stringify([...new Set([...remembered, key])]),
        );
      } catch {
        // The in-memory set still prevents repeat alerts if browser storage is unavailable.
      }
    },
    [alertKey, announcedStorageKey],
  );

  const checkReminders = useCallback(() => {
    const now = Date.now();
    const dueReminder = (query.data ?? []).find(
      (reminder) =>
        !reminder.completed &&
        new Date(reminder.due_at).getTime() <= now &&
        !wasAnnounced(reminder),
    );
    if (!dueReminder) return;
    rememberAnnouncement(dueReminder);
    setActiveReminder(dueReminder);
    playAlarm();
    navigator.vibrate?.([150, 90, 150, 90, 150]);
    toast(`Reminder: ${dueReminder.title}`, {
      description: `Due ${new Date(dueReminder.due_at).toLocaleString("en-GB")}`,
      duration: 12_000,
    });
  }, [playAlarm, query.data, rememberAnnouncement, wasAnnounced]);

  useEffect(() => {
    const enableSound = () => unlockSound();
    window.addEventListener("pointerdown", enableSound, true);
    window.addEventListener("keydown", enableSound, true);
    return () => {
      window.removeEventListener("pointerdown", enableSound, true);
      window.removeEventListener("keydown", enableSound, true);
      audioContext.current?.close();
      audioContext.current = null;
    };
  }, [unlockSound]);

  const viewReminders = useCallback(() => {
    setActiveReminder(null);
    void navigate({ to: "/reminders" });
  }, [navigate]);

  useEffect(() => {
    if (!user) {
      announcedIds.current.clear();
      setActiveReminder(null);
    }
  }, [user]);

  useEffect(() => {
    checkReminders();
    const timer = window.setInterval(checkReminders, 1_000);
    return () => window.clearInterval(timer);
  }, [checkReminders]);

  return (
    <Dialog
      open={Boolean(activeReminder)}
      onOpenChange={(open) => !open && setActiveReminder(null)}
    >
      <DialogContent className="max-w-md bg-card">
        <DialogHeader>
          <BellRing className="size-9 text-primary" aria-hidden="true" />
          <DialogTitle>Reminder due</DialogTitle>
          <DialogDescription>
            {activeReminder
              ? `${activeReminder.title} was due at ${new Date(activeReminder.due_at).toLocaleString("en-GB")}.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setActiveReminder(null)}>
            Dismiss
          </Button>
          <Button onClick={viewReminders}>View reminders</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
