ALTER TABLE `orders` ADD `paymentStatus` enum('unpaid','paid','voided') DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `paymentMethod` varchar(50);--> statement-breakpoint
ALTER TABLE `orders` ADD `paidAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `paymentCanceledAt` timestamp;