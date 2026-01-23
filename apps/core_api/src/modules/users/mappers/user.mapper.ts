import type { StudentProfile, TeacherProfile, User } from '@prisma/client';
import { UserDetailResponseDto } from '../dto/user-detail-response.dto';
import { UserResponseDto } from '../dto/user-response.dto';

type UserWithProfiles = User & {
  teacherProfile?: TeacherProfile | null;
  studentProfile?: StudentProfile | null;
};

export class UserMapper {
  static toResponse(u: UserWithProfiles): UserResponseDto {
    return {
      id: u.id,
      institutionId: u.institutionId ?? null,
      role: u.role,
      email: u.email ?? null,
      username: u.username ?? null,
      phoneE164: u.phoneE164 ?? null,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  }

  static toDetailResponse(u: UserWithProfiles): UserDetailResponseDto {
    const base = this.toResponse(u);

    return {
      ...base,
      teacherProfile: u.teacherProfile
        ? {
            fullName: u.teacherProfile.fullName,
            phone: u.teacherProfile.phone ?? null,
            specialty: u.teacherProfile.specialty ?? null,
          }
        : null,
      studentProfile: u.studentProfile
        ? {
            fullName: u.studentProfile.fullName,
            contactPhone: u.studentProfile.contactPhone ?? null,
            gradeLevel: u.studentProfile.gradeLevel ?? null,
            sectionLabel: u.studentProfile.sectionLabel ?? null,
          }
        : null,
    };
  }
}
