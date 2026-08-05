-- DropForeignKey
ALTER TABLE "housekeeping_tasks" DROP CONSTRAINT "housekeeping_tasks_reservation_id_fkey";

-- AlterTable
ALTER TABLE "housekeeping_tasks" ALTER COLUMN "reservation_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
