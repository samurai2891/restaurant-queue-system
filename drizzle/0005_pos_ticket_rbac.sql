ALTER TABLE `stores`
  ADD COLUMN `enablePosV2UI` boolean NOT NULL DEFAULT false,
  ADD COLUMN `enableHandheld` boolean NOT NULL DEFAULT false,
  ADD COLUMN `enableMemoTicket` boolean NOT NULL DEFAULT false,
  ADD COLUMN `enableDraftHandoff` boolean NOT NULL DEFAULT false;

--> statement-breakpoint

ALTER TABLE `store_staff`
  MODIFY COLUMN `role` enum('owner','manager','cashier','host','staff','kitchen') NOT NULL DEFAULT 'staff';

--> statement-breakpoint

ALTER TABLE `parties`
  ADD COLUMN `partyKind` enum('DINE_IN','COUNTER_SALE','MEMO_ONLY') NOT NULL DEFAULT 'DINE_IN',
  ADD COLUMN `posStatus` enum('OPEN','MEMO_ONLY','ITEMIZED','PAYMENT_LOCKED','PAID','VOID') NOT NULL DEFAULT 'OPEN',
  ADD COLUMN `tableLabel` varchar(50),
  ADD COLUMN `memoText` text,
  ADD COLUMN `memoImageUrl` text,
  ADD COLUMN `paymentLockedAt` timestamp,
  ADD COLUMN `paymentLockedByStaffId` int;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `storeId` int NOT NULL,
  `userId` int,
  `action` varchar(100) NOT NULL,
  `targetType` varchar(50),
  `targetId` int,
  `details` json,
  `ipAddress` varchar(45),
  `userAgent` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);


