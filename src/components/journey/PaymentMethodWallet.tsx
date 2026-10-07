import { Check } from "lucide-react";
import { useEffect } from "react";

import { AtmPaymentCard } from "@/components/payment/AtmPaymentCard";
import type { PaymentMethod } from "@/lib/journey";
import { cn } from "@/lib/utils";

/**
 * Admin-added payment methods shown as the same ATM-style cards used on the
 * enrollment page. Tap a method to select it, then fill the form below.
 */
export function PaymentMethodWallet({
  methods,
  selectedName,
  onSelect,
}: {
  methods: PaymentMethod[];
  selectedName: string;
  onSelect: (name: string) => void;
}) {
  const selected = methods.find((m) => m.name === selectedName) ?? methods[0];

  useEffect(() => {
    if (methods[0] && !methods.some((m) => m.name === selectedName)) onSelect(methods[0].name);
  }, [methods, selectedName, onSelect]);

  if (!selected) return null;

  return (
    <div className="space-y-3">
      {methods.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {methods.map((m) => {
            const active = m.name === selected.name;
            return (
              <button
                key={m.name}
                type="button"
                onClick={() => onSelect(m.name)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-cyan/60 bg-primary/20 text-foreground"
                    : "border-hairline bg-surface-2 text-muted-foreground",
                )}
              >
                {active ? <Check className="h-3.5 w-3.5 text-cyan" /> : null}
                {m.name}
              </button>
            );
          })}
        </div>
      ) : null}
      <AtmPaymentCard
        key={selected.name}
        method={{
          provider: selected.name,
          accountTitle: selected.accountTitle,
          accountNumber: selected.accountNumber,
          note: selected.instructions || null,
          qr: selected.qrUrl || null,
        }}
      />
      <p className="text-center text-[11px] text-muted-foreground">
        Selected: <span className="font-semibold text-foreground">{selected.name}</span> — pay here,
        then fill the form below.
      </p>
    </div>
  );
}
