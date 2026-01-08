import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMenuCart, type MenuItem } from "@/hooks/useMenuCart";
import { ToppingDialog, type ToppingDialogResult } from "@/components/order/ToppingDialog";
import { CartPanel } from "@/components/order/CartPanel";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  Minus,
  Plus,
  Trash2,
  Clock,
  Users,
  ShoppingCart,
  Receipt,
} from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

// カテゴリ色設定
const CATEGORY_COLOR_MAP: Record<string, { bg: string; text: string; hover: string }> = {
  blue: { bg: "bg-blue-500", text: "text-white", hover: "hover:bg-blue-600" },
  cyan: { bg: "bg-cyan-500", text: "text-white", hover: "hover:bg-cyan-600" },
  green: { bg: "bg-green-500", text: "text-white", hover: "hover:bg-green-600" },
  yellow: { bg: "bg-yellow-500", text: "text-black", hover: "hover:bg-yellow-600" },
  orange: { bg: "bg-orange-500", text: "text-white", hover: "hover:bg-orange-600" },
  red: { bg: "bg-red-500", text: "text-white", hover: "hover:bg-red-600" },
  gray: { bg: "bg-gray-500", text: "text-white", hover: "hover:bg-gray-600" },
};

const getCategoryColor = (color: string | null | undefined) => {
  return CATEGORY_COLOR_MAP[color || "blue"] || CATEGORY_COLOR_MAP.blue;
};

// 経過時間を計算
const getElapsedTime = (startTime: string | Date | null | undefined): string => {
  if (!startTime) return "";
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  
  if (diffMinutes < 60) return `${diffMinutes}分`;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return `${hours}時間${mins}分`;
};

// 画面の状態
type Screen = "tableSelect" | "categorySelect" | "itemSelect";

// テーブル型
type TableWithParty = {
  id: number;
  name: string;
  maxCapacity: number | null;
  section: string | null;
  currentParty: {
    id: number;
    ticketNumber: number;
    guestName: string | null;
    partySize: number;
    seatedAt: string | null;
    registeredAt: string;
    unpaidTotalAmount: number;
    unpaidItemsCount: number;
  } | null;
};

export default function Cashier() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = Number.parseInt(storeId || "0", 10);
  const { loading: authLoading, isAuthenticated } = useAuth();

  // 画面状態
  const [currentScreen, setCurrentScreen] = useState<Screen>("tableSelect");
  const [selectedTable, setSelectedTable] = useState<TableWithParty | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  // 新規着席ダイアログ
  const [newPartyDialogOpen, setNewPartyDialogOpen] = useState(false);
  const [pendingTable, setPendingTable] = useState<TableWithParty | null>(null);
  const [newPartySize, setNewPartySize] = useState("2");
  const [newPartyName, setNewPartyName] = useState("");

  // トッピングダイアログ
  const [toppingDialogOpen, setToppingDialogOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);

  // カート表示
  const [cartPanelOpen, setCartPanelOpen] = useState(false);

  // データ取得
  const { data: store, isLoading: storeLoading } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: tables, refetch: refetchTables } = trpc.table.listWithParties.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0, refetchInterval: 5000 }
  );

  const { data: categories } = trpc.menu.categories.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: items } = trpc.menu.items.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalAmount,
    totalItems,
  } = useMenuCart(items);

  // Mutations
  const createPartyMutation = trpc.party.create.useMutation();
  const updatePartyMutation = trpc.party.update.useMutation();
  const createOrderMutation = trpc.order.createByStaff.useMutation();

  // セクションごとにテーブルをグループ化
  const tablesBySection = useMemo(() => {
    if (!tables) return new Map<string, TableWithParty[]>();
    const map = new Map<string, TableWithParty[]>();
    
    for (const table of tables as TableWithParty[]) {
      const section = table.section || "その他";
      if (!map.has(section)) {
        map.set(section, []);
      }
      map.get(section)!.push(table);
    }
    
    return map;
  }, [tables]);

  // 選択カテゴリの商品
  const filteredItems = useMemo(() => {
    const list = (items as MenuItem[] | undefined) ?? [];
    if (!selectedCategoryId) return list;
    return list.filter((item) => item.categoryId === selectedCategoryId);
  }, [items, selectedCategoryId]);

  // 選択中のカテゴリ
  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId || !categories) return null;
    return categories.find((c) => c.id === selectedCategoryId);
  }, [selectedCategoryId, categories]);

  const isSubmitting = createPartyMutation.isPending || createOrderMutation.isPending;

  // テーブル選択
  const handleTableClick = useCallback((table: TableWithParty) => {
    if (table.currentParty) {
      // 使用中テーブル → カテゴリ選択へ
      setSelectedTable(table);
      setCurrentScreen("categorySelect");
    } else {
      // 空席テーブル → 新規着席ダイアログ
      setPendingTable(table);
      setNewPartyDialogOpen(true);
    }
  }, []);

  // 新規パーティ作成
  const handleCreateParty = async () => {
    if (!pendingTable) return;
    
    const size = parseInt(newPartySize, 10);
    if (!size || size < 1) {
      toast.error("人数を入力してください");
      return;
    }

    try {
      const createdParty = await createPartyMutation.mutateAsync({
        storeId: storeIdNum,
        guestName: newPartyName || undefined,
        partySize: size,
        tableId: pendingTable.id,
      });

      // パーティを着席状態に
      await updatePartyMutation.mutateAsync({
        id: createdParty.id,
        storeId: storeIdNum,
        status: "seated",
      });

      await refetchTables();

      // 更新されたテーブル情報を取得
      const updatedTables = tables as TableWithParty[] | undefined;
      const updatedTable = updatedTables?.find(t => t.id === pendingTable.id);
      
      if (updatedTable) {
        setSelectedTable({
          ...pendingTable,
          currentParty: {
            id: createdParty.id,
            ticketNumber: createdParty.ticketNumber,
            guestName: newPartyName || null,
            partySize: size,
            seatedAt: new Date().toISOString(),
            registeredAt: new Date().toISOString(),
            unpaidTotalAmount: 0,
            unpaidItemsCount: 0,
          },
        });
      } else {
        setSelectedTable({
          ...pendingTable,
          currentParty: {
            id: createdParty.id,
            ticketNumber: createdParty.ticketNumber,
            guestName: newPartyName || null,
            partySize: size,
            seatedAt: new Date().toISOString(),
            registeredAt: new Date().toISOString(),
            unpaidTotalAmount: 0,
            unpaidItemsCount: 0,
          },
        });
      }

      setNewPartyDialogOpen(false);
      setPendingTable(null);
      setNewPartySize("2");
      setNewPartyName("");
      setCurrentScreen("categorySelect");
      
      toast.success(`${pendingTable.name}に着席しました`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "着席処理に失敗しました";
      toast.error(message);
    }
  };

  // カテゴリ選択
  const handleCategoryClick = useCallback((categoryId: number) => {
    setSelectedCategoryId(categoryId);
    setCurrentScreen("itemSelect");
  }, []);

  // メニューアイテムクリック
  const handleMenuItemClick = (item: MenuItem) => {
    const isSoldOut = !item.isAvailable || (item.stockCount !== null && item.stockCount <= 0);
    if (isSoldOut) return;
    setSelectedMenuItem(item);
    setToppingDialogOpen(true);
  };

  // トッピング確定
  const handleToppingConfirm = (result: ToppingDialogResult) => {
    if (!selectedMenuItem) return;
    addToCart(selectedMenuItem, {
      modifiers: result.modifiers,
      notes: result.notes,
    });
    setSelectedMenuItem(null);
  };

  // 注文確定
  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error("カートが空です");
      return;
    }

    if (!selectedTable?.currentParty) {
      toast.error("テーブルを選択してください");
      return;
    }

    try {
      await createOrderMutation.mutateAsync({
        storeId: storeIdNum,
        partyId: selectedTable.currentParty.id,
        items: cart.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          modifiers: item.modifiers,
          notes: item.notes,
        })),
        notes: notes || undefined,
        status: "served",
        routeToKitchen: false,
      });

      toast.success("注文を確定しました");
      clearCart();
      setNotes("");
      await refetchTables();
    } catch (error) {
      const message = error instanceof Error ? error.message : "注文の作成に失敗しました";
      toast.error(message);
    }
  };

  // 戻る処理
  const handleBack = () => {
    if (currentScreen === "itemSelect") {
      setSelectedCategoryId(null);
      setCurrentScreen("categorySelect");
    } else if (currentScreen === "categorySelect") {
      setSelectedTable(null);
      clearCart();
      setNotes("");
      setCurrentScreen("tableSelect");
    }
  };

  // ローディング
  if (authLoading || storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 未認証
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>ログインが必要です</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/staff">
              <Button className="w-full">スタッフ入口へ</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 店舗なし
  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>店舗が見つかりません</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100">
      {/* トッピングダイアログ */}
      <ToppingDialog
        open={toppingDialogOpen}
        onOpenChange={setToppingDialogOpen}
        menuItem={selectedMenuItem}
        onConfirm={handleToppingConfirm}
      />

      {/* 新規着席ダイアログ */}
      <Dialog open={newPartyDialogOpen} onOpenChange={setNewPartyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {pendingTable?.name} に着席
            </DialogTitle>
            <DialogDescription>
              人数を入力して着席処理を行います
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>人数 *</Label>
              <Input
                type="number"
                min={1}
                max={pendingTable?.maxCapacity || 99}
                value={newPartySize}
                onChange={(e) => setNewPartySize(e.target.value)}
              />
              {pendingTable?.maxCapacity && (
                <p className="text-sm text-muted-foreground">
                  最大{pendingTable.maxCapacity}名
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>お名前（任意）</Label>
              <Input
                value={newPartyName}
                onChange={(e) => setNewPartyName(e.target.value)}
                placeholder="山田様"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPartyDialogOpen(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={handleCreateParty} 
              disabled={createPartyMutation.isPending || updatePartyMutation.isPending}
            >
              {(createPartyMutation.isPending || updatePartyMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              着席する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* カート表示ダイアログ */}
      <Dialog open={cartPanelOpen} onOpenChange={setCartPanelOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>カート</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <CartPanel
              cart={cart}
              totalAmount={totalAmount}
              totalItems={totalItems}
              notes={notes}
              onNotesChange={setNotes}
              onQuantityChange={(menuItemId, delta) => updateQuantity(menuItemId, delta)}
              onRemove={(menuItemId) => removeFromCart(menuItemId)}
              onClear={clearCart}
              showNotes={true}
              compact={true}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCartPanelOpen(false)}>
              閉じる
            </Button>
            <Button 
              onClick={() => {
                setCartPanelOpen(false);
                handleSubmitOrder();
              }}
              disabled={cart.length === 0 || isSubmitting}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              注文確定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ヘッダー */}
      <header className="shrink-0 bg-white border-b shadow-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {currentScreen !== "tableSelect" ? (
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            ) : (
              <Link href={`/queue/${storeIdNum}`}>
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
            )}
            <div>
              <div className="font-semibold">
                {currentScreen === "tableSelect" && store.name}
                {currentScreen === "categorySelect" && selectedTable?.name}
                {currentScreen === "itemSelect" && selectedCategory?.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {currentScreen === "tableSelect" && "テーブル選択"}
                {currentScreen === "categorySelect" && (
                  selectedTable?.currentParty 
                    ? `${selectedTable.currentParty.partySize}名 · ${getElapsedTime(selectedTable.currentParty.seatedAt)}`
                    : "カテゴリ選択"
                )}
                {currentScreen === "itemSelect" && "商品選択"}
              </div>
            </div>
          </div>
          
          {currentScreen !== "tableSelect" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCartPanelOpen(true)}
              className="gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              {totalItems > 0 && (
                <Badge variant="default" className="h-5 px-1.5">
                  {totalItems}
                </Badge>
              )}
            </Button>
          )}
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-hidden">
        {/* テーブル選択画面 */}
        {currentScreen === "tableSelect" && (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {Array.from(tablesBySection.entries()).map(([section, sectionTables]) => (
                <div key={section}>
                  <h2 className="text-lg font-semibold mb-3 text-gray-700">{section}</h2>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {sectionTables.map((table) => {
                      const isOccupied = !!table.currentParty;
                      const elapsed = table.currentParty?.seatedAt 
                        ? getElapsedTime(table.currentParty.seatedAt)
                        : "";
                      
                      return (
                        <button
                          key={table.id}
                          onClick={() => handleTableClick(table)}
                          className={`
                            relative p-4 rounded-xl text-center transition-all
                            ${isOccupied 
                              ? "bg-blue-500 text-white shadow-lg hover:bg-blue-600" 
                              : "bg-white text-gray-700 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                            }
                          `}
                        >
                          <div className="font-bold text-lg">{table.name}</div>
                          {isOccupied ? (
                            <>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <Users className="w-3 h-3" />
                                <span className="text-sm">{table.currentParty!.partySize}名</span>
                              </div>
                              <div className="flex items-center justify-center gap-1 mt-0.5 text-xs opacity-80">
                                <Clock className="w-3 h-3" />
                                <span>{elapsed}</span>
                              </div>
                              {table.currentParty!.unpaidItemsCount > 0 && (
                                <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                                  {table.currentParty!.unpaidItemsCount}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-gray-400 mt-1">空席</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {(!tables || tables.length === 0) && (
                <div className="text-center py-12 text-gray-500">
                  <Receipt className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>テーブルが登録されていません</p>
                  <p className="text-sm mt-1">店舗設定でテーブルを追加してください</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* カテゴリ選択画面 */}
        {currentScreen === "categorySelect" && (
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {categories?.map((category) => {
                  const colorClasses = getCategoryColor(category.color);
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryClick(category.id)}
                      className={`
                        p-6 rounded-xl text-center font-bold text-lg
                        transition-all shadow-md hover:shadow-lg
                        ${colorClasses.bg} ${colorClasses.text} ${colorClasses.hover}
                      `}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
              
              {(!categories || categories.length === 0) && (
                <div className="text-center py-12 text-gray-500">
                  <p>カテゴリが登録されていません</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* 商品選択画面 */}
        {currentScreen === "itemSelect" && (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {filteredItems.map((item) => {
                const isSoldOut = !item.isAvailable || (item.stockCount !== null && item.stockCount <= 0);
                const cartQty = cart
                  .filter((c) => c.menuItemId === item.id)
                  .reduce((sum, c) => sum + c.quantity, 0);
                const inCart = cartQty > 0;

                return (
                  <div
                    key={item.id}
                    className={`
                      bg-white rounded-lg shadow-sm border overflow-hidden
                      ${isSoldOut ? "opacity-50" : ""}
                      ${inCart ? "ring-2 ring-blue-500" : ""}
                    `}
                  >
                    <button
                      onClick={() => handleMenuItemClick(item)}
                      disabled={isSoldOut}
                      className="w-full p-4 text-left flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">{item.name}</div>
                        {item.description && (
                          <div className="text-sm text-gray-500 line-clamp-1">
                            {item.description}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">
                          ¥{Number(item.price).toLocaleString()}
                        </div>
                        {isSoldOut && (
                          <Badge variant="secondary" className="text-xs">売切れ</Badge>
                        )}
                      </div>
                    </button>
                    
                    {inCart && (
                      <div className="px-4 pb-3 flex items-center justify-end gap-2 border-t pt-3">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          onClick={() => {
                            if (cartQty === 1) removeFromCart(item.id);
                            else updateQuantity(item.id, -1);
                          }}
                        >
                          {cartQty === 1 ? (
                            <Trash2 className="h-4 w-4 text-red-500" />
                          ) : (
                            <Minus className="h-4 w-4" />
                          )}
                        </Button>
                        <span className="w-10 text-center font-bold text-lg">
                          {cartQty}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {filteredItems.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p>このカテゴリには商品がありません</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </main>

      {/* フッター（カテゴリ/商品選択時のみ） */}
      {currentScreen !== "tableSelect" && (
        <footer className="shrink-0 bg-white border-t shadow-lg">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex-1">
              <div className="text-sm text-gray-500">合計</div>
              <div className="text-xl font-bold">
                ¥{totalAmount.toLocaleString()}
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({totalItems}点)
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={clearCart}
                disabled={cart.length === 0 || isSubmitting}
              >
                クリア
              </Button>
              <Button
                onClick={handleSubmitOrder}
                disabled={cart.length === 0 || isSubmitting}
                className="px-6"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                注文確定
              </Button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
