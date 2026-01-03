DROP TABLE `audit_logs`;--> statement-breakpoint
ALTER TABLE `orders` ADD `routeToKitchen` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `entrySource` varchar(32);--> statement-breakpoint
ALTER TABLE `stores` ADD `autoNotifyRank` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `stores` ADD `autoNotifyMinutes` int DEFAULT 0;