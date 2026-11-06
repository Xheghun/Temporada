import { z } from 'zod';
export const phoneFormSchema = z.object({
  phone: z
    .string()
    .refine(
      (value) => /^\+[1-9]\d{7,14}$/.test(value.replace(/[\s()-]/g, '')),
      'invalid_phone',
    ),
});
export const otpFormSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'invalid_otp'),
});
