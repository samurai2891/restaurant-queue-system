import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Pencil } from "lucide-react";
import { useState, useEffect } from "react";

const commonAllergens = [
  "卵",
  "乳",
  "小麦",
  "そば",
  "落花生",
  "えび",
  "かに",
];

type OrderNoteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketLabel?: string;
  initialNotes?: string;
  initialAllergies?: string;
  onConfirm: (notes: string, allergies: string) => void;
};

export function OrderNoteDialog({
  open,
  onOpenChange,
  ticketLabel,
  initialNotes = "",
  initialAllergies = "",
  onConfirm,
}: OrderNoteDialogProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [allergies, setAllergies] = useState(initialAllergies);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);

  // 初期化
  useEffect(() => {
    if (open) {
      setNotes(initialNotes);
      setAllergies(initialAllergies);
      // 既存のアレルギー情報から選択状態を復元
      const existing = initialAllergies.split(/[,、\s]+/).filter(Boolean);
      setSelectedAllergens(
        commonAllergens.filter((a) =>
          existing.some((e) => e.includes(a))
        )
      );
    }
  }, [open, initialNotes, initialAllergies]);

  const toggleAllergen = (allergen: string) => {
    setSelectedAllergens((prev) => {
      const next = prev.includes(allergen)
        ? prev.filter((a) => a !== allergen)
        : [...prev, allergen];
      // 選択されたアレルゲンをテキストに反映
      const custom = allergies
        .split(/[,、\s]+/)
        .filter((a) => a && !commonAllergens.includes(a));
      setAllergies([...next, ...custom].join("、"));
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(notes, allergies);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            {ticketLabel ? `${ticketLabel} のメモ` : "注文メモ"}
          </DialogTitle>
          <DialogDescription>
            アレルギー情報や特別なリクエストを入力できます
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* アレルギー情報 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <Label className="text-sm font-medium">アレルギー情報</Label>
            </div>
            
            {/* よくあるアレルゲンのクイック選択 */}
            <div className="flex flex-wrap gap-2">
              {commonAllergens.map((allergen) => (
                <Badge
                  key={allergen}
                  variant={selectedAllergens.includes(allergen) ? "default" : "outline"}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleAllergen(allergen)}
                >
                  {allergen}
                </Badge>
              ))}
            </div>
            
            <Textarea
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="その他のアレルギー情報があれば入力"
              rows={2}
            />
          </div>

          <Separator />

          {/* 備考 */}
          <div className="space-y-2">
            <Label htmlFor="order-notes">備考・特別なリクエスト</Label>
            <Textarea
              id="order-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例: 子供用の取り皿をお願いします、大盛りで など"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleConfirm}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
