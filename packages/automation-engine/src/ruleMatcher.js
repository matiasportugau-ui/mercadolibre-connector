/**
 * Evaluates a set of automation rules against an incoming ML question.
 * Returns the first matching rule (lowest priority number wins), or null.
 */
export const evaluateRules = (question, rules) => {
  const questionText = (question.text ?? '').toLowerCase();
  const itemId = String(question.item_id ?? '');
  const categoryId = String(question.item?.category_id ?? '');

  // rules must already be sorted by priority ASC before calling this
  for (const rule of rules) {
    if (!rule.enabled) continue;

    const results = (rule.conditions ?? []).map((condition) => {
      const rawValue = String(condition.value ?? '');
      switch (condition.type) {
        case 'keyword':
          return questionText.includes(rawValue.toLowerCase());
        case 'regex': {
          try {
            return new RegExp(rawValue, 'i').test(question.text ?? '');
          } catch {
            return false;
          }
        }
        case 'item_id':
          return itemId === rawValue;
        case 'category_id':
          return categoryId === rawValue;
        case 'any':
          return true;
        default:
          return false;
      }
    });

    const matches =
      rule.condition_mode === 'all'
        ? results.every(Boolean)
        : results.some(Boolean);

    if (matches) return rule;
  }

  return null;
};
