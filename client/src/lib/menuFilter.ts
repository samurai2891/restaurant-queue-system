/**
 * 繝｡繝九Η繝ｼ繧｢繧､繝・Β縺ｮ邨槭ｊ霎ｼ縺ｿ繝ｦ繝ｼ繝・ぅ繝ｪ繝・ぅ
 * - Register / Cashier / HandheldOrder 縺ｧ蜈ｱ騾壼茜逕ｨ
 */

export interface FilterableMenuItem {
  id: number;
  name: string;
  categoryId: number;
}

export interface MenuFilterOptions {
  /** 繧ｫ繝・ざ繝ｪID譁・ｭ怜・縲・all" 縺ｮ蝣ｴ蜷医・蜈ｨ繧ｫ繝・ざ繝ｪ繧定｡ｨ遉ｺ */
  categoryId?: string;
  /** 讀懃ｴ｢繧ｯ繧ｨ繝ｪ・亥膚蜩∝錐縺ｮ驛ｨ蛻・ｸ閾ｴ・・*/
  searchQuery?: string;
}

/**
 * 繝｡繝九Η繝ｼ繧｢繧､繝・Β繧偵き繝・ざ繝ｪ繝ｻ讀懃ｴ｢繧ｯ繧ｨ繝ｪ縺ｧ繝輔ぅ繝ｫ繧ｿ繝ｪ繝ｳ繧ｰ縺吶ｋ
 */
export function filterMenuItems<T extends FilterableMenuItem>(
  items: T[] | undefined | null,
  options: MenuFilterOptions
): T[] {
  if (!items) return [];

  const { categoryId = "all", searchQuery = "" } = options;

  let results = items;

  // 繧ｫ繝・ざ繝ｪ繝輔ぅ繝ｫ繧ｿ
  if (categoryId !== "all") {
    const catId = Number.parseInt(categoryId, 10);
    if (Number.isFinite(catId)) {
      results = results.filter((item) => item.categoryId === catId);
    }
  }

  // 讀懃ｴ｢繧ｯ繧ｨ繝ｪ繝輔ぅ繝ｫ繧ｿ
  const trimmedQuery = searchQuery.trim();
  if (trimmedQuery) {
    const lowerQuery = trimmedQuery.toLowerCase();
    results = results.filter((item) => item.name.toLowerCase().includes(lowerQuery));
  }

  return results;
}
