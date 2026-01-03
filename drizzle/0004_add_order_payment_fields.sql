ALTER TABLE `orders` ADD `entrySource` varchar(50);--> statement-breakpoint
ALTER TABLE `orders` ADD `routeToKitchen` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `paymentProvider` varchar(50);--> statement-breakpoint
ALTER TABLE `orders` ADD `paymentReference` varchar(255);
