CREATE TABLE `audit_logs` (
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
--> statement-breakpoint
ALTER TABLE `store_staff` MODIFY COLUMN `role` enum('owner','manager','cashier','host','staff','kitchen') NOT NULL DEFAULT 'staff';--> statement-breakpoint
ALTER TABLE `parties` ADD `partyKind` enum('DINE_IN','COUNTER_SALE','MEMO_ONLY') DEFAULT 'DINE_IN' NOT NULL;--> statement-breakpoint
ALTER TABLE `parties` ADD `posStatus` enum('OPEN','MEMO_ONLY','ITEMIZED','PAYMENT_LOCKED','PAID','VOID') DEFAULT 'OPEN' NOT NULL;--> statement-breakpoint
ALTER TABLE `parties` ADD `tableLabel` varchar(50);--> statement-breakpoint
ALTER TABLE `parties` ADD `memoText` text;--> statement-breakpoint
ALTER TABLE `parties` ADD `memoImageUrl` text;--> statement-breakpoint
ALTER TABLE `parties` ADD `paymentLockedAt` timestamp;--> statement-breakpoint
ALTER TABLE `parties` ADD `paymentLockedByStaffId` int;--> statement-breakpoint
ALTER TABLE `stores` ADD `enablePosV2UI` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `stores` ADD `enableHandheld` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `stores` ADD `enableMemoTicket` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `stores` ADD `enableDraftHandoff` boolean DEFAULT false NOT NULL;