ALTER TABLE `orders` ADD `routeToKitchen` boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE `orders` ADD `entrySource` varchar(32);
