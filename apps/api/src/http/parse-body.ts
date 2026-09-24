import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

/** One schema violation of a request body: the field path and what is wrong (REQ-API-11). */
export interface BodyError {
  path: string;
  message: string;
}

/** Parses a request body with its zod schema; a violation answers 400 with every error. */
export function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;
  const errors: BodyError[] = result.error.issues.map(({ path, message }) => ({
    path: path.map(String).join('.'),
    message,
  }));
  throw new BadRequestException({ message: 'the request body is invalid', errors });
}
