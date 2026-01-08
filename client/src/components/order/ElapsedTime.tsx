import { Badge } from "@/components/ui/badge";
import { Timer } from "lucide-react";
import { useState, useEffect } from "react";

type AlertLevel = "normal" | "warning" | "danger" | "critical";

type ElapsedTimeProps = {
  startTime: string | Date;
  thresholdMinutes?: number; // デフォルト30分
  className?: string;
  showIcon?: boolean;
};

const getAlertLevel = (elapsedMinutes: number, threshold: number): AlertLevel => {
  const ratio = elapsedMinutes / threshold;
  if (ratio < 0.5) return "normal";
  if (ratio < 0.8) return "warning";
  if (ratio < 1.0) return "danger";
  return "critical";
};

const alertStyles: Record<AlertLevel, string> = {
  normal: "bg-muted text-muted-foreground",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  danger: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 animate-pulse",
};

const formatElapsedTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}時間${mins}分`;
};

const getElapsedMinutes = (startTime: string | Date): number => {
  const now = new Date();
  const start = typeof startTime === "string" ? new Date(startTime) : startTime;
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000));
};

export function ElapsedTime({
  startTime,
  thresholdMinutes = 30,
  className = "",
  showIcon = true,
}: ElapsedTimeProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(getElapsedMinutes(startTime));
  const alertLevel = getAlertLevel(elapsedMinutes, thresholdMinutes);
  const style = alertStyles[alertLevel];

  // 1分ごとに更新
  useEffect(() => {
    setElapsedMinutes(getElapsedMinutes(startTime));
    const interval = setInterval(() => {
      setElapsedMinutes(getElapsedMinutes(startTime));
    }, 60000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <Badge className={`${style} ${className} font-mono`}>
      {showIcon && <Timer className="w-3 h-3 mr-1" />}
      {formatElapsedTime(elapsedMinutes)}
    </Badge>
  );
}

// テーブル用の簡易表示
export function ElapsedTimeCompact({
  startTime,
  thresholdMinutes = 30,
}: {
  startTime: string | Date;
  thresholdMinutes?: number;
}) {
  const [elapsedMinutes, setElapsedMinutes] = useState(getElapsedMinutes(startTime));
  const alertLevel = getAlertLevel(elapsedMinutes, thresholdMinutes);

  useEffect(() => {
    setElapsedMinutes(getElapsedMinutes(startTime));
    const interval = setInterval(() => {
      setElapsedMinutes(getElapsedMinutes(startTime));
    }, 60000);
    return () => clearInterval(interval);
  }, [startTime]);

  const colorClass = {
    normal: "text-muted-foreground",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-orange-600 dark:text-orange-400",
    critical: "text-red-600 dark:text-red-400 font-bold",
  }[alertLevel];

  return (
    <span className={`text-xs ${colorClass} font-mono`}>
      {formatElapsedTime(elapsedMinutes)}
    </span>
  );
}
