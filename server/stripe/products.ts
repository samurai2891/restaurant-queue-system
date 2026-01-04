// Stripe製品・価格定義
// ユーザー提供のStripeアカウントで作成された製品ID

// Stripe Price IDs（実際に作成されたもの）
export const STRIPE_PRICE_IDS = {
  free: 'price_1SllfORpCmDhhjB3VEYWSUXR',
  standard: 'price_1SllfPRpCmDhhjB3v2m4qkeJ',
  premium: 'price_1SllfQRpCmDhhjB30cOFk4WB',
} as const;

export const SUBSCRIPTION_PLANS = {
  free: {
    name: "フリープラン",
    description: "基本機能を無料でご利用いただけます",
    priceId: STRIPE_PRICE_IDS.free,
    price: 0,
    features: [
      "1店舗まで",
      "月間100組まで",
      "基本的なキュー管理",
      "メール通知",
    ],
    limits: {
      maxStores: 1,
      maxPartiesPerMonth: 100,
      smsEnabled: false,
      lineEnabled: false,
      preorderEnabled: false,
      analyticsEnabled: false,
    },
  },
  standard: {
    name: "スタンダードプラン",
    description: "中小規模店舗向けの充実した機能",
    priceId: STRIPE_PRICE_IDS.standard,
    price: 4980,
    features: [
      "3店舗まで",
      "月間1,000組まで",
      "SMS/LINE通知",
      "事前注文機能",
      "基本分析ダッシュボード",
      "メールサポート",
    ],
    limits: {
      maxStores: 3,
      maxPartiesPerMonth: 1000,
      smsEnabled: true,
      lineEnabled: true,
      preorderEnabled: true,
      analyticsEnabled: true,
    },
  },
  premium: {
    name: "プレミアムプラン",
    description: "大規模店舗・チェーン向けのフル機能",
    priceId: STRIPE_PRICE_IDS.premium,
    price: 9980,
    features: [
      "無制限の店舗数",
      "無制限の受付数",
      "SMS/LINE通知（優先配信）",
      "事前注文機能",
      "高度な分析・AI予測",
      "API連携",
      "優先サポート",
      "カスタムブランディング",
    ],
    limits: {
      maxStores: -1, // 無制限
      maxPartiesPerMonth: -1, // 無制限
      smsEnabled: true,
      lineEnabled: true,
      preorderEnabled: true,
      analyticsEnabled: true,
      apiAccess: true,
      customBranding: true,
    },
  },
} as const;

export type PlanType = keyof typeof SUBSCRIPTION_PLANS;

export function getPlanByPriceId(priceId: string): PlanType | null {
  for (const [plan, config] of Object.entries(SUBSCRIPTION_PLANS)) {
    if ('priceId' in config && config.priceId === priceId) {
      return plan as PlanType;
    }
  }
  return null;
}

export function getPlanLimits(plan: PlanType) {
  return SUBSCRIPTION_PLANS[plan].limits;
}
