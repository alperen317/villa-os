-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('Utilities', 'Cleaning', 'Maintenance', 'Staff', 'Supplies', 'Tax', 'Other');

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "villa_id" UUID,
    "maintenance_record_id" UUID,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "supplier" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_expense_date_idx" ON "expenses"("expense_date");

-- CreateIndex
CREATE INDEX "expenses_villa_id_expense_date_idx" ON "expenses"("villa_id", "expense_date");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_maintenance_record_id_idx" ON "expenses"("maintenance_record_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_villa_id_fkey" FOREIGN KEY ("villa_id") REFERENCES "villas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_maintenance_record_id_fkey" FOREIGN KEY ("maintenance_record_id") REFERENCES "maintenance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The same guard the other money columns carry, so a zero or negative amount cannot
-- reach the table even if the service-layer validation is bypassed.
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_positive" CHECK (amount > 0);
