-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "company_name" TEXT NOT NULL DEFAULT 'Villa OS',
    "logo_path" TEXT,
    "accent_color" TEXT NOT NULL DEFAULT '#2563eb',
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "contact_address" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);
