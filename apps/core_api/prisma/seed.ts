import "dotenv/config";
import { PrismaClient, Role, InstitutionStatus, SectionStatus, TeacherSectionRole, EnrollmentStatus } from "@prisma/client";
import bcrypt from "bcrypt";

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definido. Crea apps/core_api/.env con DATABASE_URL="postgresql://..."');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});





function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const institutionName = "Institución Demo";
  const institutionSlug = slugify(institutionName);

  // Password demo (cámbialo luego)
  const plainPassword = "Admin12345!";
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  // 1) Institution
  const institution = await prisma.institution.upsert({
    where: { slug: institutionSlug },
    update: {},
    create: {
      name: institutionName,
      slug: institutionSlug,
      status: InstitutionStatus.ACTIVE,
      settings: {
        create: {
          gradingScaleMax: 20,
          riskDropThreshold: 5,
          riskWindowSessions: 4,
          riskMinSessionsRequired: 3,
        },
      },
    },
  });

  // Helper para crear usuarios por rol
  async function upsertUser(role: Role, email: string, fullName: string) {
    return prisma.user.upsert({
      where: {
        institutionId_email: { institutionId: institution.id, email },
      },
      update: { isActive: true },
      create: {
        institutionId: institution.id,
        role,
        email,
        username: email.split("@")[0],
        passwordHash,
        isActive: true,
        ...(role === Role.TEACHER
          ? { teacherProfile: { create: { fullName } } }
          : {}),
        ...(role === Role.STUDENT
          ? { studentProfile: { create: { fullName } } }
          : {}),
      },
    });
  }

  // 2) Users base
  const admin = await upsertUser(Role.INSTITUTION_ADMIN, "admin@demo.edu", "Admin Demo");
  const teacher = await upsertUser(Role.TEACHER, "teacher@demo.edu", "Docente Demo");
  const student = await upsertUser(Role.STUDENT, "student@demo.edu", "Estudiante Demo");

  // 3) AcademicYear + Period
  const academicYear = await prisma.academicYear.upsert({
    where: { institutionId_name: { institutionId: institution.id, name: "2026" } },
    update: { isCurrent: true },
    create: {
      institutionId: institution.id,
      name: "2026",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-12-31"),
      isCurrent: true,
    },
  });

  const period = await prisma.period.upsert({
    where: { academicYearId_name: { academicYearId: academicYear.id, name: "Periodo 1" } },
    update: {},
    create: {
      institutionId: institution.id,
      academicYearId: academicYear.id,
      name: "Periodo 1",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-06-30"),
    },
  });

  // 4) Subject
  const subject = await prisma.subject.upsert({
    where: { institutionId_name: { institutionId: institution.id, name: "Comunicación" } },
    update: {},
    create: {
      institutionId: institution.id,
      name: "Comunicación",
    },
  });

  // 5) Section
  const section = await prisma.section.create({
    data: {
      institutionId: institution.id,
      academicYearId: academicYear.id,
      subjectId: subject.id,
      gradeLevel: "5",
      groupLabel: "A",
      primaryTeacherId: teacher.id,
      status: SectionStatus.ACTIVE,
      teachers: {
        create: {
          teacherId: teacher.id,
          role: TeacherSectionRole.PRIMARY,
        },
      },
    },
  });

  // 6) Enrollment
  await prisma.enrollment.upsert({
    where: { sectionId_studentId: { sectionId: section.id, studentId: student.id } },
    update: { status: EnrollmentStatus.ACTIVE },
    create: {
      institutionId: institution.id,
      sectionId: section.id,
      studentId: student.id,
      status: EnrollmentStatus.ACTIVE,
    },
  });

  // 7) Session (opcional)
  await prisma.session.create({
    data: {
      institutionId: institution.id,
      sectionId: section.id,
      periodId: period.id,
      sessionDate: new Date("2026-03-10"),
      weekLabel: "Semana 1",
      topicTitle: "Verbo to be (introducción)",
      topicDescription: "Identificar uso de am/is/are en oraciones simples.",
      createdBy: teacher.id,
    },
  });

  console.log("✅ Seed completado.");
  console.log("🔐 Credenciales demo:");
  console.log("admin@demo.edu / Admin12345!");
  console.log("teacher@demo.edu / Admin12345!");
  console.log("student@demo.edu / Admin12345!");
}

main()
  .catch((e) => {
    console.error("❌ Seed falló:", e);
    process.exit(1);
  })
  .finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});

