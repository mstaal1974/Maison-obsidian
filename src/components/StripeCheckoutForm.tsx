import { useEffect, useRef, useState } from "react";
import { type CheckoutForm, mountCheckoutForm } from "../lib/stripeForm";

/**
 * Stripe's embedded payment form for a Checkout Session. Stripe renders it in
 * its own iframe; on success the customer lands on the session's return_url.
 */
export default function StripeCheckoutForm({ clientSecret }: { clientSecret: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let form: CheckoutForm | null = null;
    let active = true;
    if (ref.current) {
      void mountCheckoutForm(ref.current, clientSecret, (m) => active && setError(m)).then((f) => {
        if (!active) f?.unmount?.();
        else form = f;
      });
    }
    return () => {
      active = false;
      try {
        form?.unmount?.();
      } catch {
        /* already gone */
      }
    };
  }, [clientSecret]);

  return (
    <div>
      <div id="checkout-form" ref={ref} style={{ background: "#ffffff", padding: 12, borderRadius: 4, minHeight: 120 }} />
      {error && <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.5, color: "#d98a6a" }}>{error}</div>}
    </div>
  );
}
