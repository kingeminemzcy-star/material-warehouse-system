-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'BOSS', 'WAREHOUSE', 'PURCHASER', 'PROJECT_MANAGER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM ('STEEL', 'PLATE', 'CHAIN', 'MOTOR', 'FAN', 'SPRAY_GUN', 'FILTER', 'HARDWARE', 'CABLE', 'BEARING', 'CYLINDER', 'PAINT', 'OTHER');

-- CreateEnum
CREATE TYPE "WarehouseZone" AS ENUM ('STEEL_AREA', 'ELECTRICAL_AREA', 'SPARE_PARTS_AREA', 'SITE_TEMP_AREA', 'RETURN_AREA', 'SCRAP_AREA');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING_APPROVAL', 'REJECTED', 'APPROVED', 'ORDERED', 'PARTIAL_RECEIVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InboundSource" AS ENUM ('PURCHASE_ARRIVAL', 'PROJECT_RETURN', 'INVENTORY_GAIN', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('PURCHASE_REQUEST', 'APPROVAL', 'PURCHASE_ORDER', 'INBOUND', 'OUTBOUND', 'UPDATE', 'DELETE', 'STOCK_ADJUSTMENT', 'LOGIN');

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customer" TEXT,
    "managerId" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "expectedEndDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "MaterialCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "minStock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "qrCode" TEXT,
    "defaultPhoto" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialSpec" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "specCode" TEXT NOT NULL,
    "specModel" TEXT,
    "materialText" TEXT,
    "dimensionsText" TEXT,
    "length" DECIMAL(65,30),
    "width" DECIMAL(65,30),
    "height" DECIMAL(65,30),
    "thickness" DECIMAL(65,30),
    "diameter" DECIMAL(65,30),
    "wallThickness" DECIMAL(65,30),
    "brand" TEXT,
    "power" TEXT,
    "voltage" TEXT,
    "speed" TEXT,
    "airVolume" TEXT,
    "airPressure" TEXT,
    "pitch" TEXT,
    "caliber" TEXT,
    "filterGrade" TEXT,
    "coreCount" INTEGER,
    "squareMm" DECIMAL(65,30),
    "innerDiameter" DECIMAL(65,30),
    "outerDiameter" DECIMAL(65,30),
    "bore" DECIMAL(65,30),
    "stroke" DECIMAL(65,30),
    "color" TEXT,
    "batchNo" TEXT,
    "shelfLife" TIMESTAMP(3),
    "qrCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "requestNo" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "approverId" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "purpose" TEXT NOT NULL,
    "expectedArrival" TIMESTAMP(3),
    "remark" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestItem" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL,
    "purpose" TEXT,
    "remark" TEXT,

    CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "purchaserId" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expectedArrival" TIMESTAMP(3),
    "status" "PurchaseStatus" NOT NULL DEFAULT 'ORDERED',
    "remark" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "receivedQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "zone" "WarehouseZone" NOT NULL,
    "locationCode" TEXT NOT NULL,
    "sourceProjectId" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL,
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "photoUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundRecord" (
    "id" TEXT NOT NULL,
    "inboundNo" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "materialId" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "projectId" TEXT,
    "source" "InboundSource" NOT NULL,
    "zone" "WarehouseZone" NOT NULL,
    "locationCode" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL,
    "beforeQty" DECIMAL(65,30) NOT NULL,
    "afterQty" DECIMAL(65,30) NOT NULL,
    "operatorId" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundRecord" (
    "id" TEXT NOT NULL,
    "outboundNo" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "zone" "WarehouseZone" NOT NULL,
    "locationCode" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "beforeQty" DECIMAL(65,30) NOT NULL,
    "afterQty" DECIMAL(65,30) NOT NULL,
    "operatorId" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storagePath" TEXT,
    "caption" TEXT,
    "materialId" TEXT,
    "projectId" TEXT,
    "inboundRecordId" TEXT,
    "outboundRecordId" TEXT,
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "materialId" TEXT,
    "projectId" TEXT,
    "quantityChange" DECIMAL(65,30),
    "beforeQty" DECIMAL(65,30),
    "afterQty" DECIMAL(65,30),
    "photoUrl" TEXT,
    "remark" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_supabaseUserId_key" ON "UserProfile"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Material_materialCode_key" ON "Material"("materialCode");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialSpec_specCode_key" ON "MaterialSpec"("specCode");

-- CreateIndex
CREATE INDEX "MaterialSpec_materialId_specModel_materialText_dimensionsTe_idx" ON "MaterialSpec"("materialId", "specModel", "materialText", "dimensionsText");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_requestNo_key" ON "PurchaseRequest"("requestNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_orderNo_key" ON "PurchaseOrder"("orderNo");

-- CreateIndex
CREATE INDEX "InventoryLot_zone_locationCode_idx" ON "InventoryLot"("zone", "locationCode");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_materialId_specId_zone_locationCode_sourceProj_key" ON "InventoryLot"("materialId", "specId", "zone", "locationCode", "sourceProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundRecord_inboundNo_key" ON "InboundRecord"("inboundNo");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundRecord_outboundNo_key" ON "OutboundRecord"("outboundNo");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_action_createdAt_idx" ON "AuditLog"("actorId", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialSpec" ADD CONSTRAINT "MaterialSpec_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_specId_fkey" FOREIGN KEY ("specId") REFERENCES "MaterialSpec"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_purchaserId_fkey" FOREIGN KEY ("purchaserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_specId_fkey" FOREIGN KEY ("specId") REFERENCES "MaterialSpec"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_specId_fkey" FOREIGN KEY ("specId") REFERENCES "MaterialSpec"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundRecord" ADD CONSTRAINT "InboundRecord_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundRecord" ADD CONSTRAINT "InboundRecord_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundRecord" ADD CONSTRAINT "InboundRecord_specId_fkey" FOREIGN KEY ("specId") REFERENCES "MaterialSpec"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundRecord" ADD CONSTRAINT "InboundRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundRecord" ADD CONSTRAINT "InboundRecord_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundRecord" ADD CONSTRAINT "OutboundRecord_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundRecord" ADD CONSTRAINT "OutboundRecord_specId_fkey" FOREIGN KEY ("specId") REFERENCES "MaterialSpec"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundRecord" ADD CONSTRAINT "OutboundRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundRecord" ADD CONSTRAINT "OutboundRecord_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_inboundRecordId_fkey" FOREIGN KEY ("inboundRecordId") REFERENCES "InboundRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_outboundRecordId_fkey" FOREIGN KEY ("outboundRecordId") REFERENCES "OutboundRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

