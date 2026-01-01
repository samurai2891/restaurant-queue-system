import {
  deleteAuditLogsBefore,
  deleteDailyAnalyticsBefore,
  deleteNotificationsBefore,
  deleteOrderItemsBeforeOrderDate,
  deleteOrdersBefore,
  deletePartiesBefore,
  deleteSubscriptionsBefore,
} from "../db";

type RetentionPolicy = {
  label: string;
  table: string;
  months?: number;
  days?: number;
  basis: string;
  deleteBefore: (cutoff: Date) => Promise<number>;
};

const RETENTION_POLICIES: RetentionPolicy[] = [
  {
    label: "顧客受付（ゲスト情報/待ち行列）",
    table: "parties",
    days: 14,
    basis: "registeredAt",
    deleteBefore: deletePartiesBefore,
  },
  {
    label: "通知履歴（SMS/LINE/Email）",
    table: "notifications",
    days: 14,
    basis: "createdAt",
    deleteBefore: deleteNotificationsBefore,
  },
  {
    label: "売上/注文ヘッダ",
    table: "orders",
    months: 18,
    basis: "orderedAt",
    deleteBefore: deleteOrdersBefore,
  },
  {
    label: "売上/注文明細",
    table: "order_items",
    months: 18,
    basis: "orders.orderedAt",
    deleteBefore: deleteOrderItemsBeforeOrderDate,
  },
  {
    label: "監査ログ",
    table: "audit_logs",
    days: 14,
    basis: "createdAt",
    deleteBefore: deleteAuditLogsBefore,
  },
  {
    label: "サブスクリプション履歴",
    table: "subscriptions",
    months: 12,
    basis: "createdAt",
    deleteBefore: deleteSubscriptionsBefore,
  },
  {
    label: "日次集計（分析）",
    table: "daily_analytics",
    months: 6,
    basis: "createdAt",
    deleteBefore: deleteDailyAnalyticsBefore,
  },
];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const subtractMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
};

export async function runDataRetentionPurge() {
  const now = new Date();
  console.log(`[Retention] Starting purge at ${now.toISOString()}`);
  for (const policy of RETENTION_POLICIES) {
    const cutoff = policy.days
      ? new Date(now.getTime() - policy.days * ONE_DAY_MS)
      : subtractMonths(now, policy.months ?? 0);
    const deleted = await policy.deleteBefore(cutoff);
    console.log(
      `[Retention] ${policy.label} (${policy.table}) < ${cutoff.toISOString()} deleted=${deleted}`
    );
  }
}

let retentionTimer: NodeJS.Timeout | null = null;

export function startDataRetentionScheduler() {
  if (retentionTimer) return;
  const run = async () => {
    try {
      await runDataRetentionPurge();
    } catch (error) {
      console.error("[Retention] Purge failed:", error);
    }
  };
  void run();
  retentionTimer = setInterval(run, ONE_DAY_MS);
  retentionTimer.unref?.();
}
