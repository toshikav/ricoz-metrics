import { z } from 'zod';
export const states = ['DRAFT', 'IN_REVIEW', 'CERTIFIED', 'DEPRECATED', 'ARCHIVED'];
export const transitions = {
  DRAFT: ['IN_REVIEW', 'ARCHIVED'],
  IN_REVIEW: ['DRAFT', 'CERTIFIED', 'ARCHIVED'],
  CERTIFIED: ['DEPRECATED', 'ARCHIVED'],
  DEPRECATED: ['ARCHIVED'],
  ARCHIVED: [],
};
const text = (max) => z.string().trim().min(1).max(max);
export const email = z.email().max(254);
const logic = z.strictObject({
  sql_template: text(20000),
  dependencies: z
    .array(z.string().regex(/^[a-z0-9_]+$/))
    .max(50)
    .default([]),
  parameters: z.record(z.string().regex(/^[a-zA-Z0-9_]+$/), z.string().max(500)).default({}),
  aggregation: z.enum(['sum', 'avg', 'count', 'min', 'max', 'custom']).default('sum'),
});
export const metricSchema = z.strictObject({
  name: text(100).regex(/^[a-z0-9_]+$/),
  display_name: text(200),
  description: text(5000),
  metric_type: z.enum(['BASE', 'COMPOSITE', 'RATIO']),
  domain: text(100),
  operational_tier: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  calculation_logic: logic,
  state: z.enum(states).default('DRAFT'),
  created_by: email,
  steward: z.string().trim().max(254).default(''),
  tags: z.array(text(50)).max(30).default([]),
});
const optionalFields = (schema) =>
  Object.fromEntries(
    Object.entries(schema.shape).map(([key, value]) => [
      key,
      (value instanceof z.ZodDefault ? value.removeDefault() : value).optional(),
    ]),
  );
export const updateSchema = z
  .strictObject({
    ...optionalFields(metricSchema),
    calculation_logic: z.strictObject(optionalFields(logic)).optional(),
    updated_by: email,
    expected_version: z.number().int().positive(),
    changes_summary: text(1000),
  })
  .strict();
export const listSchema = z.strictObject({
  search: z.string().trim().max(200).optional(),
  domain: z.string().trim().max(100).optional(),
  state: z.enum(states).optional(),
  metric_type: z.enum(['BASE', 'COMPOSITE', 'RATIO']).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export function fail(message, statusCode = 400, details) {
  return Object.assign(new Error(message), { statusCode, details });
}
export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw fail('Please correct the invalid fields.', 400, {
      errors: result.error.issues.map((i) => `${i.path.join('.') || 'request'}: ${i.message}`),
    });
  return result.data;
}
export const objectId = (req, res, next, id) =>
  /^[a-f0-9]{24}$/i.test(id) ? next() : next(fail('Invalid metric ID.'));
