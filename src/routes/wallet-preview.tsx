import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PaymentMethodWallet } from "@/components/journey/PaymentMethodWallet";

export const Route = createFileRoute("/wallet-preview")({
  component: Page,
});

function Page() {
  const [selected, setSelected] = useState("JazzCash");
  return (
    <main className="mx-auto max-w-md p-5">
      <PaymentMethodWallet
        methods={[
          { name: "JazzCash", accountTitle: "A Q Malik", accountNumber: "03001234567", instructions: "", qrUrl: "" },
          { name: "Easypaisa", accountTitle: "A Q Malik", accountNumber: "03451234567", instructions: "", qrUrl: "" },
          { name: "National Bank", accountTitle: "Skyline Achievers", accountNumber: "PK36NBPA0000001123456702", instructions: "", qrUrl: "" },
        ]}
        selectedName={selected}
        onSelect={setSelected}
      />
    </main>
  );
}
