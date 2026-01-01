import { useMemo, useState } from "react";
import { toast } from "sonner";

export interface CartItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
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
};

const getStockLimit = (item: MenuItem) =>
  item.stockCount === null || item.stockCount === undefined ? Number.POSITIVE_INFINITY : item.stockCount;

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
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      const stockLimit = getStockLimit(item);
      const nextQuantity = (existing?.quantity || 0) + 1;
      if (nextQuantity > stockLimit) {
        toast.error("在庫が不足しています");
        return prev;
      }
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          price: Number(item.price),
          quantity: 1,
          imageUrl: item.imageUrl,
        },
      ];
    });
    toast.success(`${item.name}をカートに追加しました`, options?.onActionClick ? {
      action: {
        label: options.actionLabel ?? "カートを見る",
        onClick: options.onActionClick,
      },
    } : undefined);
  };

  const updateQuantity = (menuItemId: number, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.menuItemId === menuItemId) {
            const newQty = item.quantity + delta;
            if (delta > 0 && item.quantity >= getStockLimitForMenuItem(menuItemId)) {
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

  const removeFromCart = (menuItemId: number) => {
    setCart((prev) => prev.filter((item) => item.menuItemId !== menuItemId));
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

  return {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalAmount,
    totalItems,
    setCart,
  };
};
