-- tables テーブル作成
CREATE TABLE IF NOT EXISTS `tables` (
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

-- menu_categories に color 追加
ALTER TABLE `menu_categories` ADD COLUMN `color` varchar(20) DEFAULT 'blue';

-- parties に tableId 追加
ALTER TABLE `parties` ADD COLUMN `tableId` int;
