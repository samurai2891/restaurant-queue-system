import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type MenuImageProps = {
  imageUrl?: string | null;
  name: string;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  showLabel?: boolean;
};

const getInitials = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return "Menu";
  return trimmed.slice(0, 2);
};

export function MenuImage({
  imageUrl,
  name,
  className,
  iconClassName,
  labelClassName,
  showLabel = true,
}: MenuImageProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn("h-full w-full object-cover", className)}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg",
        "bg-gradient-to-br from-amber-100 via-orange-100 to-yellow-50 text-amber-700",
        className,
      )}
    >
      <ImageIcon
        className={cn(
          "absolute h-10 w-10 text-amber-300/70",
          iconClassName,
        )}
        aria-hidden="true"
      />
      {showLabel && (
        <span
          className={cn("relative z-10 text-sm font-semibold", labelClassName)}
        >
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}
