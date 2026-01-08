import { useMemo, useState } from "react";
import { toast } from "sonner";

export type SelectedModifier = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

export interface CartItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  modifiers?: SelectedModifier[];
  notes?: string;
}

export interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
  stockCount: number | null;
  categoryId: number;
}

type AddToCartOptions = {
  actionLabel?: string;
  onActionClick?: () => void;
  modifiers?: SelectedModifier[];
  notes?: string;
  silent?: boolean;
};

const getStockLimit = (item: MenuItem) =>
  item.stockCount === null || item.stockCount === undefined ? Number.POSITIVE_INFINITY : item.stockCount;

// カートアイテムのユニークキーを生成（モディファイア考慮）
const getCartItemKey = (menuItemId: number, modifiers?: SelectedModifier[]): string => {
  if (!modifiers || modifiers.length === 0) {
    return `item-${menuItemId}`;
  }
  const modifierKey = modifiers
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((m) => `${m.id}:${m.quantity}`)
    .join(",");
  return `item-${menuItemId}-mod-${modifierKey}`;
};

export const useMenuCart = (items?: MenuItem[]) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const getStockLimitForMenuItem = (menuItemId: number) => {
    const menuItem = items?.find((item) => item.id === menuItemId);
    if (!menuItem) return Number.POSITIVE_INFINITY;
    return getStockLimit(menuItem);
  };

  const addToCart = (item: MenuItem, options?: AddToCartOptions) => {
    if (!item.isAvailable || (item.stockCount !== null && item.stockCount <= 0)) {
      toast.error("売切れのため追加できません");
      return;
    }

    const modifiers = options?.modifiers;
    const notes = options?.notes;
    const cartKey = getCartItemKey(item.id, modifiers);

    setCart((prev) => {
      // 同じメニュー+モディファイアの組み合わせを探す
      const existingIndex = prev.findIndex(
        (c) => getCartItemKey(c.menuItemId, c.modifiers) === cartKey
      );
      
      const stockLimit = getStockLimit(item);
      const currentQty = existingIndex >= 0 ? prev[existingIndex].quantity : 0;
      const nextQuantity = currentQty + 1;

      if (nextQuantity > stockLimit) {
        toast.error("在庫が不足しています");
        return prev;
      }

      if (existingIndex >= 0) {
        // 既存アイテムの数量を増やす
        return prev.map((c, i) =>
          i === existingIndex ? { ...c, quantity: c.quantity + 1 } : c
        );
      }

      // 新規アイテムを追加
      const modifierTotal = modifiers?.reduce((sum, m) => sum + m.price * m.quantity, 0) ?? 0;
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          price: Number(item.price) + modifierTotal,
          quantity: 1,
          imageUrl: item.imageUrl,
          modifiers,
          notes,
        },
      ];
    });

    if (!options?.silent) {
      toast.success(`${item.name}をカートに追加しました`, options?.onActionClick ? {
        action: {
          label: options.actionLabel ?? "カートを見る",
          onClick: options.onActionClick,
        },
      } : undefined);
    }
  };

  const updateQuantity = (menuItemId: number, delta: number, modifiers?: SelectedModifier[]) => {
    const cartKey = getCartItemKey(menuItemId, modifiers);
    
    setCart((prev) => {
      return prev
        .map((item) => {
          const itemKey = getCartItemKey(item.menuItemId, item.modifiers);
          if (itemKey === cartKey) {
            const newQty = item.quantity + delta;
            if (delta > 0 && item.quantity >= getStockLimitForMenuItem(item.menuItemId)) {
              toast.error("在庫が不足しています");
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : item;
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (menuItemId: number, modifiers?: SelectedModifier[]) => {
    const cartKey = getCartItemKey(menuItemId, modifiers);
    setCart((prev) => prev.filter((item) => getCartItemKey(item.menuItemId, item.modifiers) !== cartKey));
    toast.info("商品を削除しました");
  };

  const clearCart = () => {
    setCart([]);
    toast.info("カートをクリアしました");
  };

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );
  const totalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  // カートアイテムのノート更新
  const updateItemNotes = (menuItemId: number, notes: string, modifiers?: SelectedModifier[]) => {
    const cartKey = getCartItemKey(menuItemId, modifiers);
    setCart((prev) =>
      prev.map((item) =>
        getCartItemKey(item.menuItemId, item.modifiers) === cartKey
          ? { ...item, notes }
          : item
      )
    );
  };

  return {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalAmount,
    totalItems,
    setCart,
    updateItemNotes,
  };
};
