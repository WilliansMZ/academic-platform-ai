import "dotenv/config";
import {
  PrismaClient,
  Role,
  InstitutionStatus,
  SectionStatus,
  TeacherSectionRole,
  EnrollmentStatus,
} from "@prisma/client";
import bcrypt from "bcrypt";

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL no está definido. Crea apps/core_api/.env con DATABASE_URL="postgresql://..."'
  );
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
  // Password demo (cámbialo luego)
  const plainPassword = "Admin12345!";
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  // =========================
  // Helper genérico: usuarios por institución
  // =========================
  async function upsertUserInInstitution(
    institutionId: string,
    role: Role,
    email: string,
    fullName: string
  ) {
    return prisma.user.upsert({
      where: {
        institutionId_email: { institutionId, email },
      },
      update: { isActive: true },
      create: {
        institutionId,
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

  // =========================
  // 0) SUPERADMIN global (institutionId = null)
  // =========================
  const superadminEmail = "superadmin@platform.com";

  const existingSuper = await prisma.user.findFirst({
    where: {
      email: superadminEmail,
      role: Role.SUPERADMIN,
      institutionId: null,
    },
  });

  if (!existingSuper) {
    await prisma.user.create({
      data: {
        institutionId: null,
        role: Role.SUPERADMIN,
        email: superadminEmail,
        username: "superadmin",
        passwordHash,
        isActive: true,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: existingSuper.id },
      data: { isActive: true },
    });
  }

  // =========================
  // 1) Institución A (Demo)
  // =========================
  const institutionNameA = "Institución Demo";
  const institutionSlugA = slugify(institutionNameA);

  const institutionA = await prisma.institution.upsert({
    where: { slug: institutionSlugA },
    update: {},
    create: {
      name: institutionNameA,
      slug: institutionSlugA,
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

  // =========================
  // 1b) Institución B (cross-tenant tests)
  // =========================
  const institutionNameB = "Institución B";
  const institutionSlugB = slugify(institutionNameB);

  const institutionB = await prisma.institution.upsert({
    where: { slug: institutionSlugB },
    update: {},
    create: {
      name: institutionNameB,
      slug: institutionSlugB,
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

  // =========================
  // 2) Users base (tenant A)
  // =========================
  const adminA = await upsertUserInInstitution(
    institutionA.id,
    Role.INSTITUTION_ADMIN,
    "admin@demo.edu",
    "Admin Demo"
  );

  const teacherA = await upsertUserInInstitution(
    institutionA.id,
    Role.TEACHER,
    "teacher@demo.edu",
    "Docente Demo"
  );

  const studentA = await upsertUserInInstitution(
    institutionA.id,
    Role.STUDENT,
    "student@demo.edu",
    "Estudiante Demo"
  );

  // =========================
  // 2b) User base (tenant B)
  // =========================
  const adminB = await upsertUserInInstitution(
    institutionB.id,
    Role.INSTITUTION_ADMIN,
    "admin-b@demo.edu",
    "Admin B"
  );

  // =========================
  // 4) Subjects (A y B) - para Swagger/E2E
  // =========================
  const subjectA = await prisma.subject.upsert({
    where: {
      institutionId_name: { institutionId: institutionA.id, name: "Comunicación" },
    },
    update: {},
    create: {
      institutionId: institutionA.id,
      name: "Comunicación",
    },
  });

  await prisma.subject.upsert({
    where: {
      institutionId_name: { institutionId: institutionB.id, name: "Comunicación" },
    },
    update: {},
    create: {
      institutionId: institutionB.id,
      name: "Comunicación",
    },
  });

  // =========================
  // 3) AcademicYear + Period (tenant A)
  // =========================
  const academicYearA = await prisma.academicYear.upsert({
    where: {
      institutionId_name: { institutionId: institutionA.id, name: "2026" },
    },
    update: { isCurrent: true },
    create: {
      institutionId: institutionA.id,
      name: "2026",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-12-31"),
      isCurrent: true,
    },
  });

  const periodA = await prisma.period.upsert({
    where: {
      academicYearId_name: {
        academicYearId: academicYearA.id,
        name: "Periodo 1",
      },
    },
    update: {},
    create: {
      institutionId: institutionA.id,
      academicYearId: academicYearA.id,
      name: "Periodo 1",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-06-30"),
    },
  });

  // =========================
  // 5) Section (tenant A) - idempotente
  // =========================
  const sectionA = await prisma.section.upsert({
    where: {
      institutionId_academicYearId_subjectId_gradeLevel_groupLabel_primaryTeacherId:
        {
          institutionId: institutionA.id,
          academicYearId: academicYearA.id,
          subjectId: subjectA.id,
          gradeLevel: "5",
          groupLabel: "A",
          primaryTeacherId: teacherA.id,
        },
    },
    update: {
      status: SectionStatus.ACTIVE,
      academicYearId: academicYearA.id,
      subjectId: subjectA.id,
      primaryTeacherId: teacherA.id,
    },
    create: {
      institutionId: institutionA.id,
      academicYearId: academicYearA.id,
      subjectId: subjectA.id,
      gradeLevel: "5",
      groupLabel: "A",
      primaryTeacherId: teacherA.id,
      status: SectionStatus.ACTIVE,
    },
  });

  // =========================
  // 5b) Link SectionTeacher (tenant A)
  // =========================
  await prisma.sectionTeacher.upsert({
    where: {
      sectionId_teacherId: { sectionId: sectionA.id, teacherId: teacherA.id },
    },
    update: { role: TeacherSectionRole.PRIMARY },
    create: {
      sectionId: sectionA.id,
      teacherId: teacherA.id,
      role: TeacherSectionRole.PRIMARY,
    },
  });

  // =========================
  // 6) Enrollment (tenant A)
  // =========================
  await prisma.enrollment.upsert({
    where: {
      sectionId_studentId: { sectionId: sectionA.id, studentId: studentA.id },
    },
    update: { status: EnrollmentStatus.ACTIVE },
    create: {
      institutionId: institutionA.id,
      sectionId: sectionA.id,
      studentId: studentA.id,
      status: EnrollmentStatus.ACTIVE,
    },
  });

  // =========================
  // 7) Session (tenant A)
  // =========================
  const sessionDate = new Date("2026-03-10");

  const existingSession = await prisma.session.findFirst({
    where: {
      institutionId: institutionA.id,
      sectionId: sectionA.id,
      sessionDate,
    },
  });

  if (!existingSession) {
    await prisma.session.create({
      data: {
        institutionId: institutionA.id,
        sectionId: sectionA.id,
        periodId: periodA.id,
        sessionDate,
        weekLabel: "Semana 1",
        topicTitle: "Verbo to be (introducción)",
        topicDescription: "Identificar uso de am/is/are en oraciones simples.",
        createdBy: teacherA.id,
      },
    });
  }

  console.log("✅ Seed completado.");
  console.log("🔐 SUPERADMIN:", "superadmin@platform.com / Admin12345!");
  console.log("🔐 Credenciales tenant A:");
  console.log("admin@demo.edu / Admin12345!");
  console.log("teacher@demo.edu / Admin12345!");
  console.log("student@demo.edu / Admin12345!");
  console.log("🔐 Credenciales tenant B:");
  console.log("admin-b@demo.edu / Admin12345!");

  // opcional: logs útiles para debug
  console.log("🏫 InstitutionA:", institutionA.id);
  console.log("🏫 InstitutionB:", institutionB.id);
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
