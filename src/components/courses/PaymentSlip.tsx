import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

export type PaymentSlipData = {
  courseTitle: string;
  buyerName: string;
  buyerId?: string | null;
  method: string;
  amount: number;
  reference: string;
  phone: string;
  submittedAt: Date;
};

function money(value: number) {
  return `PKR ${Number(value).toLocaleString("en-PK")}`;
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="slip-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/**
 * Receipt-printer animation shown after a course payment is submitted: the slip
 * slides out of the machine like a shop / ATM receipt, branded for Skyline.
 */
export function PaymentSlip({
  open,
  data,
  onClose,
}: {
  open: boolean;
  data: PaymentSlipData | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!mounted || !open || !data) return null;

  const stamp = data.submittedAt;
  const date = stamp.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = stamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return createPortal(
    <div className="slip-overlay" role="dialog" aria-modal="true" aria-label="Payment receipt">
      <button type="button" className="slip-close" onClick={onClose} aria-label="Close receipt">
        <X className="h-4 w-4" />
      </button>

      <div className="slip-machine">
        <div className="slip-printer" aria-hidden>
          <span className="slip-printer-slot" />
          <span className="slip-printer-led" />
        </div>

        <div className="slip-window">
          <div className="slip-paper">
            <div className="slip-paper-inner">
              <div className="slip-brand">
                <img src={BRAND.logoUrl} alt={BRAND.logoAlt} />
                <p className="slip-brand-name">SKYLINE ACHIEVERS</p>
                <p className="slip-brand-tag">LEARN • EARN • LEAD</p>
              </div>

              <p className="slip-status">PAYMENT SUBMITTED</p>
              <p className="slip-amount">{money(data.amount)}</p>
              <p className="slip-datetime">
                {date} • {time}
              </p>

              <div className="slip-divider" />

              <Line label="Course" value={data.courseTitle} />
              <Line label="Method" value={data.method} />
              <Line label="Transaction ID" value={data.reference} />
              <Line label="Contact" value={data.phone} />

              <div className="slip-divider" />

              <Line label="Member" value={data.buyerName} />
              {data.buyerId ? <Line label="Skyline ID" value={data.buyerId} /> : null}
              <Line label="Status" value="Under verification" />

              <div className="slip-divider" />

              <p className="slip-note">
                Access unlocks within 24 hours after verification. Keep this receipt for your record.
              </p>
              <p className="slip-footer">THANK YOU FOR YOUR PAYMENT</p>
            </div>
            <div className="slip-zigzag" aria-hidden />
          </div>
        </div>
      </div>

      <Button type="button" variant="brand" className="slip-done rounded-xl font-display" onClick={onClose}>
        Done
      </Button>
    </div>,
    document.body,
  );
}
