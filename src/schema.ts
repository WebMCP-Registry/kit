import { z } from 'zod'

/**
 * Zod constructs `zod-to-json-schema` cannot faithfully represent as JSON
 * Schema: `.transform()`/`.refine()`/`.superRefine()` (wrapped in `ZodEffects`,
 * silently collapsed to their input type — exactly the schema/handler drift
 * this SDK exists to prevent), plus a few shapes whose JSON Schema output an
 * agent can't reliably act on (`ZodDiscriminatedUnion`, `ZodLazy`, `ZodPipeline`).
 *
 * We throw at `defineTool` definition time rather than let these reach
 * `zod-to-json-schema` quietly, per the documented named risk: fail loud at
 * the call site, not when an agent invokes the tool at runtime.
 */
const UNSUPPORTED_TYPE_NAMES = new Set([
  'ZodEffects',
  'ZodDiscriminatedUnion',
  'ZodLazy',
  'ZodPipeline',
])

export class UnsupportedSchemaError extends Error {
  constructor(path: string, typeName: string) {
    super(
      `[webmcp] Unsupported Zod construct "${typeName}" at "${path || '<root>'}". ` +
        `defineTool's input schema must convert cleanly to JSON Schema for agents to use. ` +
        `Avoid .transform()/.refine()/.superRefine(), z.discriminatedUnion(), z.lazy(), and ` +
        `.pipe() in tool input schemas — restructure with plain z.object()/z.union()/z.enum() ` +
        `instead, and validate/transform inside the handler.`,
    )
    this.name = 'UnsupportedSchemaError'
  }
}

function walk(schema: z.ZodTypeAny, path: string): void {
  const def = schema._def as { typeName: string }

  if (UNSUPPORTED_TYPE_NAMES.has(def.typeName)) {
    throw new UnsupportedSchemaError(path, def.typeName)
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>
    for (const [key, value] of Object.entries(shape)) {
      walk(value, path ? `${path}.${key}` : key)
    }
    return
  }

  if (schema instanceof z.ZodArray) {
    walk(schema.element, `${path}[]`)
    return
  }

  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault
  ) {
    walk(schema._def.innerType, path)
    return
  }

  if (schema instanceof z.ZodUnion) {
    const options = schema._def.options as z.ZodTypeAny[]
    options.forEach((option, i) => walk(option, `${path}|${i}`))
    return
  }

  if (schema instanceof z.ZodRecord) {
    walk(schema._def.valueType, `${path}{}`)
    return
  }
}

/**
 * Throws `UnsupportedSchemaError` if `schema` contains a Zod construct that
 * `zod-to-json-schema` can't faithfully convert. Call before conversion.
 */
export function assertSupportedSchema(schema: z.ZodTypeAny): void {
  walk(schema, '')
}
