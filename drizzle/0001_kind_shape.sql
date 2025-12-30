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
CREATE TABLE `daily_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`totalParties` int DEFAULT 0,
	`totalGuests` int DEFAULT 0,
	`seatedCount` int DEFAULT 0,
	`canceledCount` int DEFAULT 0,
	`noshowCount` int DEFAULT 0,
	`avgWaitTime` int,
	`maxWaitTime` int,
	`minWaitTime` int,
	`avgTurnoverTime` int,
	`notificationsSent` int DEFAULT 0,
	`notificationsDelivered` int DEFAULT 0,
	`notificationsFailed` int DEFAULT 0,
	`totalOrders` int DEFAULT 0,
	`totalOrderAmount` decimal(12,0) DEFAULT '0',
	`preorderCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `menu_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`imageUrl` text,
	`sortOrder` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`availableTime` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menu_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`price` decimal NOT NULL,
	`imageUrl` text,
	`isAvailable` boolean NOT NULL DEFAULT true,
	`stockCount` int,
	`prepTimeMinutes` int DEFAULT 10,
	`allergens` json,
	`calories` int,
	`sortOrder` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menu_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `menu_modifiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`menuItemId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`price` decimal DEFAULT '0',
	`isRequired` boolean DEFAULT false,
	`maxSelections` int DEFAULT 1,
	`sortOrder` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menu_modifiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`type` enum('registration','notify','remind','seated','custom') NOT NULL,
	`channel` enum('sms','line','email') NOT NULL,
	`name` varchar(100) NOT NULL,
	`subject` varchar(255),
	`template` text NOT NULL,
	`isDefault` boolean DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`partyId` int NOT NULL,
	`type` enum('registration','notify','remind','seated','custom') NOT NULL,
	`channel` enum('sms','line','email') NOT NULL,
	`recipient` varchar(320) NOT NULL,
	`subject` varchar(255),
	`message` text NOT NULL,
	`status` enum('pending','sent','delivered','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`externalId` varchar(255),
	`sentAt` timestamp,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`menuItemId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal NOT NULL,
	`modifiers` json,
	`modifierPrice` decimal DEFAULT '0',
	`subtotal` decimal NOT NULL,
	`notes` text,
	`status` enum('pending','preparing','ready','served','canceled') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`partyId` int NOT NULL,
	`orderNumber` int NOT NULL,
	`status` enum('pending','confirmed','preparing','ready','served','canceled') NOT NULL DEFAULT 'pending',
	`totalAmount` decimal DEFAULT '0',
	`notes` text,
	`orderType` enum('preorder','dine_in') DEFAULT 'preorder',
	`orderedAt` timestamp NOT NULL DEFAULT (now()),
	`confirmedAt` timestamp,
	`preparedAt` timestamp,
	`servedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`ticketNumber` int NOT NULL,
	`guestName` varchar(100),
	`partySize` int NOT NULL,
	`childCount` int DEFAULT 0,
	`hasStroller` boolean DEFAULT false,
	`phone` varchar(20),
	`email` varchar(320),
	`lineUserId` varchar(255),
	`preferredSeatTypeId` int,
	`assignedSeatTypeId` int,
	`status` enum('waiting','notified','arrived','seated','canceled','noshow') NOT NULL DEFAULT 'waiting',
	`priority` int DEFAULT 0,
	`notes` text,
	`allergies` text,
	`accessToken` varchar(64) NOT NULL,
	`estimatedWaitMinutes` int,
	`registeredAt` timestamp NOT NULL DEFAULT (now()),
	`notifiedAt` timestamp,
	`arrivedAt` timestamp,
	`seatedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `parties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seat_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`minPartySize` int NOT NULL DEFAULT 1,
	`maxPartySize` int NOT NULL DEFAULT 4,
	`totalSeats` int NOT NULL DEFAULT 10,
	`availableSeats` int NOT NULL DEFAULT 10,
	`avgTurnoverMinutes` int DEFAULT 60,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seat_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_staff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','manager','host','staff','kitchen') NOT NULL DEFAULT 'staff',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_staff_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`address` text,
	`phone` varchar(20),
	`email` varchar(320),
	`logoUrl` text,
	`businessHours` json,
	`receptionHours` json,
	`isReceptionPaused` boolean NOT NULL DEFAULT false,
	`maxQueueSize` int DEFAULT 50,
	`timezone` varchar(64) DEFAULT 'Asia/Tokyo',
	`stripeCustomerId` varchar(255),
	`subscriptionPlan` enum('free','standard','premium') DEFAULT 'free',
	`subscriptionStatus` enum('active','canceled','past_due','trialing') DEFAULT 'active',
	`lineChannelAccessToken` text,
	`lineChannelSecret` varchar(255),
	`smsEnabled` boolean DEFAULT true,
	`orderReleaseRank` int DEFAULT 5,
	`orderReleaseMinutes` int DEFAULT 15,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`stripeSubscriptionId` varchar(255),
	`plan` enum('free','standard','premium') NOT NULL,
	`status` enum('active','canceled','past_due','trialing') NOT NULL,
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`canceledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
