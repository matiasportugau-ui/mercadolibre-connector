export const PLANS = {
  free: {
    label: 'Free',
    priceUsd: 0,
    questionsPerMonth: 50,
    maxRules: 3,
    maxAccounts: 1,
    reputationDays: 7,
    orderDays: 0,
    features: ['basic_autoreply', 'templates'],
  },
  starter: {
    label: 'Starter',
    priceUsd: 9.99,
    questionsPerMonth: 500,
    maxRules: 10,
    maxAccounts: 1,
    reputationDays: 30,
    orderDays: 30,
    features: ['basic_autoreply', 'templates', 'analytics', 'post_sale_messages', 'order_intel', 'reputation_tracker', 'listing_health'],
  },
  pro: {
    label: 'Pro',
    priceUsd: 29.99,
    questionsPerMonth: 5000,
    maxRules: 50,
    maxAccounts: 3,
    reputationDays: 365,
    orderDays: 90,
    features: ['basic_autoreply', 'templates', 'analytics', 'post_sale_messages', 'order_intel', 'reputation_tracker', 'listing_health', 'ai_suggestions', 'priority_support'],
  },
  enterprise: {
    label: 'Enterprise',
    priceUsd: 99.99,
    questionsPerMonth: -1,
    maxRules: -1,
    maxAccounts: 10,
    reputationDays: -1,
    orderDays: -1,
    features: ['basic_autoreply', 'templates', 'analytics', 'post_sale_messages', 'order_intel', 'reputation_tracker', 'listing_health', 'ai_suggestions', 'priority_support', 'white_label', 'custom_webhooks'],
  },
};

/** Returns true if the plan allows unlimited of that resource */
export const isUnlimited = (value) => value === -1;

export const getPlan = (planId) => PLANS[planId] ?? PLANS.free;
