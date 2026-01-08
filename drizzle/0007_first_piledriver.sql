CREATE TABLE `tables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`name` varchar(50) NOT NULL,
	`maxCapacity` int DEFAULT 4,
	`section` varchar(20),
	`sortOrder` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `menu_categories` ADD `color` varchar(20) DEFAULT 'blue';--> statement-breakpoint
ALTER TABLE `parties` ADD `tableId` int;