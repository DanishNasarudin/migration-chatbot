import type { Attachment } from "@/lib/types";
import { File, Loader2, X } from "lucide-react";
import Image from "next/image";
import { Button } from "../ui/button";
import TooltipWrapper from "./tooltip-wrapper";

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
  onEdit,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
  onEdit?: () => void;
}) => {
  const { name, url, contentType } = attachment;

  return (
    <div
      data-testid="input-attachment-preview"
      className="group relative size-16 overflow-hidden rounded-lg border bg-muted"
    >
      {contentType?.startsWith("image") ? (
        <Image
          src={url}
          alt={name ?? "An image attachment"}
          className="size-full object-cover"
          width={64}
          height={64}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground text-xs select-none pointer-events-none">
          <File />
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-foreground/50">
          <Loader2 size={16} />
        </div>
      )}

      {onRemove && !isUploading && (
        <Button
          onClick={onRemove}
          size="icon"
          variant="destructive"
          className="absolute top-0.5 right-0.5 size-4 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <X size={8} />
        </Button>
      )}

      <TooltipWrapper content={name}>
        <div className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-foreground/80 to-transparent px-1 py-0.5 text-[10px] text-background select-none">
          {name}
        </div>
      </TooltipWrapper>
    </div>
  );
};
