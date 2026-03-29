import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

interface DetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}

export function DetailDialog({ open, onOpenChange, title, description, children }: DetailDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-950/55 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 max-h-[88vh] -translate-y-1/2 overflow-hidden rounded-[2rem] border border-white/40 bg-sand-50 shadow-2xl shadow-ink-950/20 md:left-1/2 md:right-auto md:w-[min(1120px,calc(100vw-3rem))] md:-translate-x-1/2">
          <div className="flex items-start justify-between gap-4 border-b border-ink-900/6 bg-white/85 px-6 py-5 backdrop-blur">
            <div>
              <Dialog.Title className="text-xl font-bold tracking-tight text-ink-950">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-600">{description}</Dialog.Description>
            </div>
            <Dialog.Close className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-ink-900/8 bg-white text-ink-600 hover:border-ink-900/16 hover:text-ink-950">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Dialog.Close>
          </div>
          <div className="max-h-[calc(88vh-5.5rem)] overflow-y-auto px-6 py-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
