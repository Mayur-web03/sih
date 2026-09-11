import { cn } from "@/lib/utils";
import { riskLevel } from "@/lib/format";

const styles = {
  high: "bg-risk-high/15 text-risk-high border-risk-high/30",
  medium: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  low: "bg-risk-low/15 text-risk-low border-risk-low/30",
};

export function RiskBadge({
  score,
  showLabel = false,
  className,
}: {
  score: number;
  showLabel?: boolean;
  className?: string;
}) {
  const level = riskLevel(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
        styles[level],
        className,
      )}
      aria-label={`Risk score ${score}, ${level}`}
    >
      <span className={cn("size-1.5 rounded-full", `bg-risk-${level}`)} />
      {score}
      {showLabel && <span className="font-sans uppercase tracking-wide">{level}</span>}
    </span>
  );
}

export function RiskBar({ score, className }: { score: number; className?: string }) {
  const level = riskLevel(score);
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className={cn("h-full rounded-full", `bg-risk-${level}`)} style={{ width: `${score}%` }} />
    </div>
  );
}
