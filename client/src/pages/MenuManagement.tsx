import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Edit,
  ChefHat,
  ImageIcon
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

export default function MenuManagement() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = parseInt(storeId || "0");
  const { loading: authLoading, isAuthenticated } = useAuth();
  
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  
  // Category form
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  
  // Item form
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemPrepTime, setItemPrepTime] = useState("10");

  const { data: store, isLoading: storeLoading } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: categories, refetch: refetchCategories } = trpc.menu.categories.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: items, refetch: refetchItems } = trpc.menu.items.useQuery(
    { storeId: storeIdNum, categoryId: selectedCategoryId || undefined },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const createCategoryMutation = trpc.menu.createCategory.useMutation({
    onSuccess: () => {
      toast.success("カテゴリを追加しました");
      setIsAddCategoryOpen(false);
      setCategoryName("");
      setCategoryDescription("");
      refetchCategories();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  const createItemMutation = trpc.menu.createItem.useMutation({
    onSuccess: () => {
      toast.success("メニューを追加しました");
      setIsAddItemOpen(false);
      setItemName("");
      setItemDescription("");
      setItemPrice("");
      setItemCategoryId("");
      setItemPrepTime("10");
      refetchItems();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  const updateItemMutation = trpc.menu.updateItem.useMutation({
    onSuccess: () => {
      toast.success("メニューを更新しました");
      refetchItems();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  const handleAddCategory = () => {
    if (!categoryName.trim()) {
      toast.error("カテゴリ名を入力してください");
      return;
    }
    createCategoryMutation.mutate({
      storeId: storeIdNum,
      name: categoryName,
      description: categoryDescription || undefined,
    });
  };

  const handleAddItem = () => {
    if (!itemName.trim() || !itemPrice || !itemCategoryId) {
      toast.error("必須項目を入力してください");
      return;
    }
    createItemMutation.mutate({
      storeId: storeIdNum,
      categoryId: parseInt(itemCategoryId),
      name: itemName,
      description: itemDescription || undefined,
      price: itemPrice,
      prepTimeMinutes: parseInt(itemPrepTime),
    });
  };

  const handleToggleAvailability = (itemId: number, isAvailable: boolean) => {
    updateItemMutation.mutate({
      id: itemId,
      storeId: storeIdNum,
      isAvailable,
    });
  };

  if (authLoading || storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>ログインが必要です</CardTitle>
          </CardHeader>
          <CardContent>
            <a href={getLoginUrl()} className="block">
              <Button className="w-full">ログイン</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold">{store?.name}</h1>
              <p className="text-xs text-muted-foreground">メニュー管理</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  カテゴリ追加
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>カテゴリを追加</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>カテゴリ名 *</Label>
                    <Input
                      placeholder="ドリンク、フード、デザートなど"
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>説明</Label>
                    <Textarea
                      placeholder="カテゴリの説明"
                      value={categoryDescription}
                      onChange={(e) => setCategoryDescription(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>
                    キャンセル
                  </Button>
                  <Button onClick={handleAddCategory} disabled={createCategoryMutation.isPending}>
                    {createCategoryMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    追加
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  メニュー追加
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>メニューを追加</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>カテゴリ *</Label>
                    <Select value={itemCategoryId} onValueChange={setItemCategoryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map(cat => (
                          <SelectItem key={cat.id} value={String(cat.id)}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>メニュー名 *</Label>
                    <Input
                      placeholder="商品名"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>説明</Label>
                    <Textarea
                      placeholder="商品の説明"
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>価格（税込）*</Label>
                      <Input
                        type="number"
                        placeholder="500"
                        value={itemPrice}
                        onChange={(e) => setItemPrice(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>調理時間（分）</Label>
                      <Input
                        type="number"
                        value={itemPrepTime}
                        onChange={(e) => setItemPrepTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>
                    キャンセル
                  </Button>
                  <Button onClick={handleAddItem} disabled={createItemMutation.isPending}>
                    {createItemMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    追加
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Categories Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">カテゴリ</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  <button
                    className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
                      selectedCategoryId === null ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedCategoryId(null)}
                  >
                    すべて
                  </button>
                  {categories?.map(category => (
                    <button
                      key={category.id}
                      className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
                        selectedCategoryId === category.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedCategoryId(category.id)}
                    >
                      <p className="font-medium">{category.name}</p>
                      {category.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {category.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Menu Items */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedCategoryId 
                    ? categories?.find(c => c.id === selectedCategoryId)?.name 
                    : 'すべてのメニュー'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {items?.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ChefHat className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>メニューがありません</p>
                    <p className="text-sm">「メニュー追加」から追加してください</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items?.map(item => (
                      <div 
                        key={item.id}
                        className={`p-4 border rounded-lg ${!item.isAvailable ? 'opacity-50' : ''}`}
                      >
                        <div className="flex gap-4">
                          <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                            {item.imageUrl ? (
                              <img 
                                src={item.imageUrl} 
                                alt={item.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-lg font-bold text-primary">
                                  ¥{item.price.toLocaleString()}
                                </p>
                              </div>
                              <Switch
                                checked={item.isAvailable ?? false}
                                onCheckedChange={(checked) => handleToggleAvailability(item.id, checked)}
                              />
                            </div>
                            {item.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              調理時間: {item.prepTimeMinutes}分
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
