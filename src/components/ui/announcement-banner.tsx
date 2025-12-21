import { useEffect, useMemo, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type AnnouncementSeverity = "info" | "success" | "warning" | "error";

interface AnnouncementBannerProps {
  text?: string;
  link?: string;
  severity?: AnnouncementSeverity;
  active?: boolean;
  storageKeyOverride?: string;
}

const severityStyles: Record<AnnouncementSeverity, { bg: string; border: string; text: string; pill: string }> = {
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-900",
    pill: "bg-blue-100 text-blue-800",
  },
  success: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-900",
    pill: "bg-green-100 text-green-800",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    pill: "bg-amber-100 text-amber-800",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
    pill: "bg-red-100 text-red-800",
  },
};

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // keep 32-bit
  }
  return Math.abs(hash).toString(16);
}

export function AnnouncementBanner({ text, link, severity = "info", active = true, storageKeyOverride }: AnnouncementBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const storageKey = useMemo(() => {
    const base = storageKeyOverride || `${text || ""}|${link || ""}|${severity}`;
    return `wirenet-announcement-${hashString(base)}`;
  }, [storageKeyOverride, text, link, severity]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(storageKey);
    setDismissed(stored === "1");
  }, [storageKey]);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, "1");
    }
    setDismissed(true);
  };

  if (!active || !text || !text.trim() || dismissed) {
    return null;
  }

  const styles = severityStyles[severity] || severityStyles.info;

  return (
    <div className={cn("w-full border rounded-lg p-4 flex flex-col gap-3 shadow-sm", styles.bg, styles.border, styles.text)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className={cn("px-2 py-0.5 rounded-full", styles.pill)}>
              {severity === "info" && "Info"}
              {severity === "success" && "Success"}
              {severity === "warning" && "Notice"}
              {severity === "error" && "Alert"}
            </span>
            <span>Announcement</span>
          </div>
          <p className="text-base leading-relaxed whitespace-pre-wrap">{text}</p>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium underline hover:opacity-80"
            >
              Learn more
              <ExternalLink size={16} />
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-current/70 hover:text-current focus:outline-none"
          aria-label="Dismiss announcement"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

export default AnnouncementBanner;
