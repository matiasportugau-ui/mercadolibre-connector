const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Replaces {{variable}} placeholders in a template string.
 * Supported vars: buyer_name, item_title, price, order_id, question_text
 */
export const renderTemplate = (template, variables = {}) => {
  return template.replace(VARIABLE_PATTERN, (_, key) => variables[key] ?? `{{${key}}}`);
};
