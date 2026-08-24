export interface UpdateProfileDto {
  name?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}
