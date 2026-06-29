import { PIPELINE_STAGES, PipelineStageKey } from '@/constants/case-status';
import { cn } from '@/lib/utils/cn';

export interface PipelineDatum {
  stage: PipelineStageKey;
  count: number;
}

interface PipelineFunnelProps {
  data: PipelineDatum[];
}

const STAGE_COLORS: Record<PipelineStageKey, string> = {
  draft: 'bg-gray-200 text-gray-700',
  confirmed: 'bg-swan-200 text-swan-800',
  scheduled: 'bg-swan-400 text-white',
  in_procedure: 'bg-champagne-400/60 text-champagne-700',
  post_op: 'bg-emerald-100 text-emerald-700',
};

const STAGE_BG_GRADIENTS: Record<PipelineStageKey, string> = {
  draft: 'from-gray-100 to-gray-200',
  confirmed: 'from-swan-100 to-swan-200',
  scheduled: 'from-swan-400 to-swan-500',
  in_procedure: 'from-champagne-400/40 to-champagne-400/60',
  post_op: 'from-emerald-100 to-emerald-200',
};

export function PipelineFunnel({ data }: PipelineFunnelProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Chưa có dữ liệu
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 py-4">
      {data.map((item, idx) => {
        const pct = (item.count / total) * 100;
        const widthPct = Math.max((item.count / maxCount) * 100, 20);
        const stage = PIPELINE_STAGES.find((s) => s.key === item.stage)!;

        return (
          <div key={item.stage} className="flex items-center gap-3">
            {/* Bar */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'relative h-10 rounded-xl bg-gradient-to-r transition-all duration-500 flex items-center justify-center',
                  STAGE_BG_GRADIENTS[item.stage],
                )}
                style={{ width: `${widthPct}%`, minWidth: 80 }}
              >
                <span className="text-xs font-semibold whitespace-nowrap px-3">
                  {stage.label}
                </span>
              </div>
            </div>

            {/* Numbers */}
            <div className="flex items-baseline gap-1 min-w-[90px]">
              <span className="text-lg font-bold text-gray-900 tabular-nums">{item.count}</span>
              <span className="text-xs text-gray-500">({pct.toFixed(0)}%)</span>
            </div>

            {/* Arrow connector */}
            {idx < data.length - 1 && (
              <div className="absolute -bottom-1 left-1/2 hidden" />
            )}
          </div>
        );
      })}
    </div>
  );
}