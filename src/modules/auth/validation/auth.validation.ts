import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }).min(2, 'Name must be at least 2 characters'),
    email: z.string({ required_error: 'Email is required' }).email('Invalid email address format'),
    password: z.string({ required_error: 'Password is required' }).min(8, 'Password must be at least 8 characters'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }).email('Invalid email address format'),
    password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string({ required_error: 'Refresh token is required' }).min(1, 'Refresh token cannot be empty'),
  }),
});

export const logoutSchema = z.object({
  body: z
    .object({
      refreshToken: z.string().optional().nullable(),
    })
    .optional()
    .default({}),
});

const emailSchema = z.string({ required_error: 'Email is required' }).email('Invalid email address format');
const otpSchema = z.string({ required_error: 'OTP is required' }).regex(/^\d{6}$/, 'OTP must be 6 digits');
const otpPurposeSchema = z.enum(['signup', 'reset']);

export const verifyOtpSchema = z.object({
  body: z.object({
    email: emailSchema,
    otp: otpSchema,
    purpose: otpPurposeSchema,
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({ email: emailSchema }),
});

export const resendOtpSchema = z.object({
  body: z.object({
    email: emailSchema,
    purpose: otpPurposeSchema,
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
    otp: otpSchema,
    password: z.string({ required_error: 'Password is required' }).min(8, 'Password must be at least 8 characters'),
  }),
});
