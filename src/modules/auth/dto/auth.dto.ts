export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export type OtpPurpose = 'signup' | 'reset';

export interface OtpDto {
  email: string;
  otp: string;
  purpose: OtpPurpose;
}

export interface EmailPurposeDto {
  email: string;
  purpose: OtpPurpose;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  email: string;
  otp: string;
  password: string;
}
