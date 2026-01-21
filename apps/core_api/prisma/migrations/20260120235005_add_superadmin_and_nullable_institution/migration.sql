-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "institution_id" DROP NOT NULL;
