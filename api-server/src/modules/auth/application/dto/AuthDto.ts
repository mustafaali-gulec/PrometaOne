/**
 * HTTP DTO'ları (REST request/response).
 */
import type { UserRole } from '../../domain/valueObjects/UserRole.js';

export interface PublicUserDto {
  id: number;
  username: string;
  fullName: string | null;
  email: string | null;
  role: UserRole;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: PublicUserDto;
}

export interface RefreshResponseDto {
  accessToken: string;
  expiresIn: number;
}

/** User entity -> DTO. */
export function toPublicUserDto(props: {
  id: number;
  username: string;
  fullName: string | null;
  email: string | null;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}): PublicUserDto {
  return {
    id: props.id,
    username: props.username,
    fullName: props.fullName,
    email: props.email,
    role: props.role,
    active: props.active,
    createdAt: props.createdAt.toISOString(),
    lastLoginAt: props.lastLoginAt?.toISOString() ?? null,
  };
}
