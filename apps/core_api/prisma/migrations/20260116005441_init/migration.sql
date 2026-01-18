-- CreateEnum
CREATE TYPE "Role" AS ENUM ('INSTITUTION_ADMIN', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SectionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'DROPPED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "RiskReasonCode" AS ENUM ('DROP_SCORE', 'LOW_ATTENDANCE', 'BOTH');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SenderRole" AS ENUM ('STUDENT', 'TUTOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'AUDIO', 'IMAGE', 'DOC');

-- CreateEnum
CREATE TYPE "Emotion" AS ENUM ('CALM', 'FRUSTRATED', 'ANXIOUS', 'MOTIVATED', 'CONFUSED', 'OTHER');

-- CreateEnum
CREATE TYPE "DifficultyType" AS ENUM ('CONCEPTUAL', 'PROCEDURAL', 'ATTENTION', 'LANGUAGE', 'FOUNDATIONS', 'OTHER');

-- CreateEnum
CREATE TYPE "LearningStrategy" AS ENUM ('EXAMPLES', 'THEORY', 'PRACTICE', 'STEP_BY_STEP', 'VISUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TeacherSectionRole" AS ENUM ('PRIMARY', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RISK_ALERT', 'GRADE_PUBLISHED', 'TUTOR_ASSIGNED', 'TUTOR_COMPLETED', 'GENERAL');

-- CreateTable
CREATE TABLE "institutions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "status" "InstitutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_settings" (
    "institution_id" UUID NOT NULL,
    "grading_scale_max" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "risk_drop_threshold" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "risk_window_sessions" INTEGER NOT NULL DEFAULT 4,
    "risk_min_sessions_required" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_settings_pkey" PRIMARY KEY ("institution_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "email" VARCHAR(255),
    "username" VARCHAR(80),
    "phone_e164" VARCHAR(20),
    "password_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_profiles" (
    "user_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "specialty" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "user_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "contact_phone" TEXT,
    "grade_level" TEXT,
    "section_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periods" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,

    CONSTRAINT "periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "grade_level" TEXT NOT NULL,
    "group_label" TEXT NOT NULL,
    "primary_teacher_id" UUID NOT NULL,
    "status" "SectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_teachers" (
    "section_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "role" "TeacherSectionRole" NOT NULL DEFAULT 'ASSISTANT',

    CONSTRAINT "section_teachers_pkey" PRIMARY KEY ("section_id","teacher_id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "period_id" UUID,
    "session_date" DATE NOT NULL,
    "week_label" TEXT,
    "topic_title" TEXT NOT NULL,
    "topic_description" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_grades" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "max_score" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "teacher_comment" TEXT,
    "graded_by" UUID NOT NULL,
    "graded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_change_log" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "session_grade_id" UUID NOT NULL,
    "changed_by" UUID NOT NULL,
    "old_score" DECIMAL(5,2) NOT NULL,
    "new_score" DECIMAL(5,2) NOT NULL,
    "reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grade_change_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_alerts" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "trigger_session_id" UUID,
    "severity" "RiskSeverity" NOT NULL,
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "reason_code" "RiskReasonCode" NOT NULL,
    "details" JSONB,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutoring_assignments" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "related_session_id" UUID,
    "assigned_topic" TEXT NOT NULL,
    "topic_hash" VARCHAR(64),
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assigned_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutoring_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutoring_messages" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "sender_role" "SenderRole" NOT NULL,
    "message_type" "MessageType" NOT NULL,
    "content_text" TEXT,
    "content_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutoring_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutoring_summary" (
    "assignment_id" UUID NOT NULL,
    "understanding_level" INTEGER NOT NULL,
    "emotion" "Emotion" NOT NULL,
    "difficulty_type" "DifficultyType" NOT NULL,
    "learning_strategy" "LearningStrategy" NOT NULL,
    "student_message_sample" TEXT,
    "tutor_response_sample" TEXT,
    "teacher_observation" TEXT,
    "model_provider" TEXT,
    "model_version" TEXT,
    "confidence" DECIMAL(3,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutoring_summary_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "app_events" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_user_id" UUID,
    "student_id" UUID,
    "section_id" UUID,
    "session_id" UUID,
    "assignment_id" UUID,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_weekly_metrics" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "week_end" DATE NOT NULL,
    "avg_score" DECIMAL(5,2),
    "attendance_rate" DECIMAL(5,2),
    "num_sessions" INTEGER NOT NULL DEFAULT 0,
    "num_students" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "section_weekly_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_risk_snapshots" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "risk_level" "RiskSeverity" NOT NULL,
    "risk_factors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_risk_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_difficulty_stats" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "topic_hash" TEXT NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "avg_score" DECIMAL(5,2),
    "common_difficulty_types" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_difficulty_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institutions_slug_key" ON "institutions"("slug");

-- CreateIndex
CREATE INDEX "users_institution_id_role_idx" ON "users"("institution_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_institution_id_email_key" ON "users"("institution_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_institution_id_username_key" ON "users"("institution_id", "username");

-- CreateIndex
CREATE UNIQUE INDEX "users_institution_id_phone_e164_key" ON "users"("institution_id", "phone_e164");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "academic_years_institution_id_is_current_idx" ON "academic_years"("institution_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_institution_id_name_key" ON "academic_years"("institution_id", "name");

-- CreateIndex
CREATE INDEX "periods_institution_id_academic_year_id_idx" ON "periods"("institution_id", "academic_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "periods_academic_year_id_name_key" ON "periods"("academic_year_id", "name");

-- CreateIndex
CREATE INDEX "subjects_institution_id_idx" ON "subjects"("institution_id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_institution_id_name_key" ON "subjects"("institution_id", "name");

-- CreateIndex
CREATE INDEX "sections_institution_id_academic_year_id_idx" ON "sections"("institution_id", "academic_year_id");

-- CreateIndex
CREATE INDEX "sections_primary_teacher_id_idx" ON "sections"("primary_teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "sections_institution_id_academic_year_id_subject_id_grade_l_key" ON "sections"("institution_id", "academic_year_id", "subject_id", "grade_level", "group_label", "primary_teacher_id");

-- CreateIndex
CREATE INDEX "section_teachers_teacher_id_idx" ON "section_teachers"("teacher_id");

-- CreateIndex
CREATE INDEX "enrollments_student_id_idx" ON "enrollments"("student_id");

-- CreateIndex
CREATE INDEX "enrollments_section_id_status_idx" ON "enrollments"("section_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_section_id_student_id_key" ON "enrollments"("section_id", "student_id");

-- CreateIndex
CREATE INDEX "sessions_section_id_session_date_idx" ON "sessions"("section_id", "session_date");

-- CreateIndex
CREATE INDEX "sessions_institution_id_session_date_idx" ON "sessions"("institution_id", "session_date");

-- CreateIndex
CREATE INDEX "attendance_student_id_created_at_idx" ON "attendance"("student_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_session_id_student_id_key" ON "attendance"("session_id", "student_id");

-- CreateIndex
CREATE INDEX "session_grades_student_id_graded_at_idx" ON "session_grades"("student_id", "graded_at");

-- CreateIndex
CREATE INDEX "session_grades_session_id_graded_at_idx" ON "session_grades"("session_id", "graded_at");

-- CreateIndex
CREATE UNIQUE INDEX "session_grades_session_id_student_id_key" ON "session_grades"("session_id", "student_id");

-- CreateIndex
CREATE INDEX "grade_change_log_session_grade_id_changed_at_idx" ON "grade_change_log"("session_grade_id", "changed_at");

-- CreateIndex
CREATE INDEX "grade_change_log_changed_by_changed_at_idx" ON "grade_change_log"("changed_by", "changed_at");

-- CreateIndex
CREATE INDEX "risk_alerts_section_id_status_idx" ON "risk_alerts"("section_id", "status");

-- CreateIndex
CREATE INDEX "risk_alerts_student_id_created_at_idx" ON "risk_alerts"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "risk_alerts_institution_id_created_at_idx" ON "risk_alerts"("institution_id", "created_at");

-- CreateIndex
CREATE INDEX "tutoring_assignments_student_id_status_idx" ON "tutoring_assignments"("student_id", "status");

-- CreateIndex
CREATE INDEX "tutoring_assignments_section_id_created_at_idx" ON "tutoring_assignments"("section_id", "created_at");

-- CreateIndex
CREATE INDEX "tutoring_assignments_institution_id_starts_at_idx" ON "tutoring_assignments"("institution_id", "starts_at");

-- CreateIndex
CREATE INDEX "tutoring_assignments_section_id_topic_hash_idx" ON "tutoring_assignments"("section_id", "topic_hash");

-- CreateIndex
CREATE INDEX "tutoring_assignments_institution_id_section_id_created_at_idx" ON "tutoring_assignments"("institution_id", "section_id", "created_at");

-- CreateIndex
CREATE INDEX "tutoring_assignments_institution_id_student_id_created_at_idx" ON "tutoring_assignments"("institution_id", "student_id", "created_at");

-- CreateIndex
CREATE INDEX "tutoring_messages_assignment_id_created_at_idx" ON "tutoring_messages"("assignment_id", "created_at");

-- CreateIndex
CREATE INDEX "tutoring_messages_institution_id_created_at_idx" ON "tutoring_messages"("institution_id", "created_at");

-- CreateIndex
CREATE INDEX "tutoring_summary_emotion_idx" ON "tutoring_summary"("emotion");

-- CreateIndex
CREATE INDEX "tutoring_summary_difficulty_type_idx" ON "tutoring_summary"("difficulty_type");

-- CreateIndex
CREATE INDEX "tutoring_summary_learning_strategy_idx" ON "tutoring_summary"("learning_strategy");

-- CreateIndex
CREATE INDEX "app_events_institution_id_occurred_at_idx" ON "app_events"("institution_id", "occurred_at");

-- CreateIndex
CREATE INDEX "app_events_event_type_occurred_at_idx" ON "app_events"("event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "app_events_student_id_occurred_at_idx" ON "app_events"("student_id", "occurred_at");

-- CreateIndex
CREATE INDEX "section_weekly_metrics_institution_id_week_start_idx" ON "section_weekly_metrics"("institution_id", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "section_weekly_metrics_section_id_week_start_key" ON "section_weekly_metrics"("section_id", "week_start");

-- CreateIndex
CREATE INDEX "student_risk_snapshots_institution_id_snapshot_date_idx" ON "student_risk_snapshots"("institution_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "student_risk_snapshots_student_id_snapshot_date_idx" ON "student_risk_snapshots"("student_id", "snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "student_risk_snapshots_student_id_section_id_snapshot_date_key" ON "student_risk_snapshots"("student_id", "section_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "topic_difficulty_stats_section_id_topic_hash_idx" ON "topic_difficulty_stats"("section_id", "topic_hash");

-- CreateIndex
CREATE INDEX "topic_difficulty_stats_institution_id_from_date_idx" ON "topic_difficulty_stats"("institution_id", "from_date");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_institution_id_created_at_idx" ON "notifications"("institution_id", "created_at");

-- AddForeignKey
ALTER TABLE "institution_settings" ADD CONSTRAINT "institution_settings_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periods" ADD CONSTRAINT "periods_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periods" ADD CONSTRAINT "periods_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_primary_teacher_id_fkey" FOREIGN KEY ("primary_teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_teachers" ADD CONSTRAINT "section_teachers_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_teachers" ADD CONSTRAINT "section_teachers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_grades" ADD CONSTRAINT "session_grades_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_grades" ADD CONSTRAINT "session_grades_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_grades" ADD CONSTRAINT "session_grades_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_grades" ADD CONSTRAINT "session_grades_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_change_log" ADD CONSTRAINT "grade_change_log_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_change_log" ADD CONSTRAINT "grade_change_log_session_grade_id_fkey" FOREIGN KEY ("session_grade_id") REFERENCES "session_grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_change_log" ADD CONSTRAINT "grade_change_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_trigger_session_id_fkey" FOREIGN KEY ("trigger_session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_assignments" ADD CONSTRAINT "tutoring_assignments_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_assignments" ADD CONSTRAINT "tutoring_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_assignments" ADD CONSTRAINT "tutoring_assignments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_assignments" ADD CONSTRAINT "tutoring_assignments_related_session_id_fkey" FOREIGN KEY ("related_session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_assignments" ADD CONSTRAINT "tutoring_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_messages" ADD CONSTRAINT "tutoring_messages_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_messages" ADD CONSTRAINT "tutoring_messages_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "tutoring_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_summary" ADD CONSTRAINT "tutoring_summary_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "tutoring_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_events" ADD CONSTRAINT "app_events_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_events" ADD CONSTRAINT "app_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_events" ADD CONSTRAINT "app_events_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_events" ADD CONSTRAINT "app_events_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_events" ADD CONSTRAINT "app_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_events" ADD CONSTRAINT "app_events_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "tutoring_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_weekly_metrics" ADD CONSTRAINT "section_weekly_metrics_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_weekly_metrics" ADD CONSTRAINT "section_weekly_metrics_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_risk_snapshots" ADD CONSTRAINT "student_risk_snapshots_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_risk_snapshots" ADD CONSTRAINT "student_risk_snapshots_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_risk_snapshots" ADD CONSTRAINT "student_risk_snapshots_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_difficulty_stats" ADD CONSTRAINT "topic_difficulty_stats_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_difficulty_stats" ADD CONSTRAINT "topic_difficulty_stats_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
