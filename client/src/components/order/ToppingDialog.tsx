import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Minus } from "lucide-react";
import { useState, useEffect } from "react";

export type MenuModifier = {
  id: number;
  name: string;
  price: string | null;
  isRequired: boolean | null;
  maxSelections: number | null;
};

export type SelectedModifier = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

export type ToppingDialogResult = {
  modifiers: SelectedModifier[];
  notes: string;
};

type ToppingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuItem: {
    id: number;
    name: string;
    price: string;
  } | null;
  onConfirm: (result: ToppingDialogResult) => void;
  initialModifiers?: SelectedModifier[];
  initialNotes?: string;
};

export function ToppingDialog({
  open,
  onOpenChange,
  menuItem,
  onConfirm,
  initialModifiers = [],
  initialNotes = "",
}: ToppingDialogProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>(initialModifiers);
  const [notes, setNotes] = useState(initialNotes);

  const { data: modifiers, isLoading } = trpc.menu.modifiers.useQuery(
    { menuItemId: menuItem?.id ?? 0 },
    { enabled: !!menuItem?.id }
  );

  // リセット
  useEffect(() => {
    if (open) {
      setSelectedModifiers(initialModifiers);
      setNotes(initialNotes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleModifier = (modifier: MenuModifier) => {
    const existing = selectedModifiers.find((m) => m.id === modifier.id);
    if (existing) {
      setSelectedModifiers(selectedModifiers.filter((m) => m.id !== modifier.id));
    } else {
      setSelectedModifiers([
        ...selectedModifiers,
        {
          id: modifier.id,
          name: modifier.name,
          price: modifier.price ? Number(modifier.price) : 0,
          quantity: 1,
        },
      ]);
    }
  };

  const updateModifierQuantity = (modifierId: number, delta: number) => {
    setSelectedModifiers(
      selectedModifiers
        .map((m) => {
          if (m.id === modifierId) {
            const newQty = m.quantity + delta;
            return newQty > 0 ? { ...m, quantity: newQty } : m;
          }
          return m;
        })
        .filter((m) => m.quantity > 0)
    );
  };

  const totalModifierPrice = selectedModifiers.reduce(
    (sum, m) => sum + m.price * m.quantity,
    0
  );

  const handleConfirm = () => {
    onConfirm({ modifiers: selectedModifiers, notes });
    onOpenChange(false);
  };

  if (!menuItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{menuItem.name}</DialogTitle>
          <DialogDescription>
            トッピングやオプションを選択できます
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-4 pr-4">
            {/* トッピング一覧 */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : modifiers && modifiers.length > 0 ? (
              <div className="space-y-3">
                <Label className="text-sm font-medium">トッピング</Label>
                {modifiers.map((modifier) => {
                  const selected = selectedModifiers.find((m) => m.id === modifier.id);
                  return (
                    <div
                      key={modifier.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`modifier-${modifier.id}`}
                          checked={!!selected}
                          onCheckedChange={() => toggleModifier(modifier)}
                        />
                        <Label
                          htmlFor={`modifier-${modifier.id}`}
                          className="cursor-pointer"
                        >
                          <span className="font-medium">{modifier.name}</span>
                          {modifier.isRequired && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              必須
                            </Badge>
                          )}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-primary">
                          +¥{Number(modifier.price).toLocaleString()}
                        </span>
                        {selected && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateModifierQuantity(modifier.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm font-bold">
                              {selected.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateModifierQuantity(modifier.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                トッピングはありません
              </div>
            )}

            <Separator />

            {/* 備考入力 */}
            <div className="space-y-2">
              <Label htmlFor="item-notes">個別備考（任意）</Label>
              <Textarea
                id="item-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="例: 辛さ控えめ、ネギ抜き など"
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>

        <Separator />

        {/* 合計表示 */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">トッピング合計</span>
          <span className="text-lg font-bold text-primary">
            +¥{totalModifierPrice.toLocaleString()}
          </span>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleConfirm}>
            追加する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
