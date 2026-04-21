import type { Insight, InsightTone } from "@/lib/insights";

const toneStyles: Record<InsightTone, { border: string; bg: string; icon: string }> = {
  info: {
    border: "border-teal-400",
    bg: "bg-teal-50/60",
    icon: "💡",
  },
  warning: {
    border: "border-amber-400",
    bg: "bg-amber-50/70",
    icon: "⚠️",
  },
  success: {
    border: "border-emerald-400",
    bg: "bg-emerald-50/70",
    icon: "✅",
  },
};

export function SmartInsights({ insights }: { insights: Insight[] }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h3 className="text-base font-semibold text-slate-900">Smart Insights</h3>
      <div className="mt-4 space-y-3">
        {insights.map((insight) => {
          const style = toneStyles[insight.tone];
          return (
            <div
              key={insight.id}
              className={`rounded-lg border-l-4 ${style.border} ${style.bg} p-3`}
            >
              <div className="flex items-start gap-2">
                <span aria-hidden className="shrink-0 text-base leading-none">
                  {style.icon}
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {insight.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {insight.detail}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
