import type { Show } from "../services/showsService";

/**
 * Generates an iCalendar (.ics) file for a show and triggers a download.
 * Compatible with Google Calendar, Apple Calendar, Outlook, etc.
 */

function formatICSDate(dateStr: string, timeStr?: string): string {
  // dateStr: "YYYY-MM-DD", timeStr: "HH:MM"
  const [year, month, day] = dateStr.split("-");
  if (timeStr) {
    const [hours, minutes] = timeStr.split(":");
    return `${year}${month}${day}T${hours}${minutes}00`;
  }
  return `${year}${month}${day}`;
}

function formatICSTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function buildDescription(show: Show): string {
  const parts: string[] = [];

  if (show.soundcheck_time) {
    const [h, m] = show.soundcheck_time.split(":");
    const d = new Date();
    d.setHours(parseInt(h), parseInt(m));
    const formatted = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    parts.push(`Soundcheck: ${formatted}`);
  }

  if (show.doors_time) {
    const [h, m] = show.doors_time.split(":");
    const d = new Date();
    d.setHours(parseInt(h), parseInt(m));
    const formatted = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    parts.push(`Doors: ${formatted}`);
  }

  if (show.notes) {
    parts.push(show.notes);
  }

  return parts.join("\n");
}

export function generateShowICS(show: Show): string {
  const uid = `show-${show.id}@bandmate`;
  const stamp = formatICSTimestamp();
  const summary = escapeICSText(show.name);

  const location = [show.venue, show.venue_address].filter(Boolean).join(", ");

  const description = buildDescription(show);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bandmate//Show//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${summary}`,
  ];

  if (show.event_time) {
    const dtStart = formatICSDate(show.event_date, show.event_time);
    lines.push(`DTSTART:${dtStart}`);
    // Default duration: 2 hours
    const [h, m] = show.event_time.split(":").map(Number);
    const endH = h + 2;
    const endTime = `${endH.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    const dtEnd = formatICSDate(show.event_date, endTime);
    lines.push(`DTEND:${dtEnd}`);
  } else {
    // All-day event
    const dtStart = formatICSDate(show.event_date);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    // Next day for all-day event end
    const nextDay = new Date(show.event_date + "T00:00:00");
    nextDay.setDate(nextDay.getDate() + 1);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dtEnd = `${nextDay.getFullYear()}${pad(nextDay.getMonth() + 1)}${pad(nextDay.getDate())}`;
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
  }

  if (location) {
    lines.push(`LOCATION:${escapeICSText(location)}`);
  }

  if (description) {
    lines.push(`DESCRIPTION:${escapeICSText(description)}`);
  }

  if (show.status === "cancelled") {
    lines.push("STATUS:CANCELLED");
  } else {
    lines.push("STATUS:CONFIRMED");
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

export function downloadShowICS(show: Show): void {
  const icsContent = generateShowICS(show);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${show.name.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
