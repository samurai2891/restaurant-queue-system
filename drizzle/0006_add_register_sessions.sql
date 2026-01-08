-- Migration: Add register_sessions table for cash management
-- This table tracks daily register sessions including opening cash, closing cash, and sales totals

CREATE TABLE IF NOT EXISTS `register_sessions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `storeId` int NOT NULL,
  `sessionDate` varchar(10) NOT NULL,
  `status` enum('open','closed') NOT NULL DEFAULT 'open',
  `openingCash` decimal(10,0) DEFAULT '0',
  `openedByStaffId` int,
  `openedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closingCash` decimal(10,0),
  `expectedCash` decimal(10,0),
  `cashDifference` decimal(10,0),
  `closedByStaffId` int,
  `closedAt` timestamp,
  `totalSales` decimal(12,0) DEFAULT '0',
  `cashSales` decimal(12,0) DEFAULT '0',
  `cardSales` decimal(12,0) DEFAULT '0',
  `otherSales` decimal(12,0) DEFAULT '0',
  `totalTransactions` int DEFAULT 0,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `register_sessions_id` PRIMARY KEY(`id`)
);

-- Add index for efficient queries by store and date
CREATE INDEX `register_sessions_store_date_idx` ON `register_sessions` (`storeId`, `sessionDate`);

-- Add unique constraint to ensure only one session per store per day
CREATE UNIQUE INDEX `register_sessions_store_date_unique` ON `register_sessions` (`storeId`, `sessionDate`);
