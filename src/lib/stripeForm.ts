// Stripe's embedded Checkout Form SDK (Stripe.js "dahlia" build, loaded in
// index.html). The publishable key is browser-safe and comes from
// VITE_STRIPE_PUBLISHABLE_KEY; the secret key never leaves the server.

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

/** Appearance as configured in Checkout Studio. */
export const APPEARANCE = {
  theme: "stripe",
  labels: "auto",
  inputs: "spaced",
  variables: {
    borderRadius: "4px",
    colorBackground: "#ffffff",
    colorDanger: "#df1b41",
    colorPrimary: "#0570de",
    colorSuccess: "#00c853",
    colorText: "#30313d",
    fontFamily: "default",
    fontSizeBase: "16px",
    spacingUnit: "4px",
  },
} as const;

// Minimal typings for the parts of the SDK we use.
export interface CheckoutForm {
  mount(target: HTMLElement | string): void;
  unmount?(): void;
  on(event: "confirm", handler: (event: unknown) => void): void;
}
interface LoadActionsResult {
  type: "success" | "error";
  actions?: { confirm(opts: { formConfirmEvent: unknown }): Promise<unknown> };
  error?: { message?: string };
}
interface CheckoutSdk {
  createForm(opts: { layout: "expanded" | "accordion" }): CheckoutForm;
  loadActions(): Promise<LoadActionsResult>;
}
interface StripeJs {
  initCheckoutFormSdk(opts: { clientSecret: Promise<string> | string; appearance?: typeof APPEARANCE }): CheckoutSdk;
}
declare global {
  interface Window {
    Stripe?: (key: string, opts?: { betas?: string[] }) => StripeJs;
  }
}

let instance: StripeJs | null = null;

/** Stripe.js with the embedded-form beta, or null when the key or script is missing. */
export function stripeJs(): StripeJs | null {
  if (instance) return instance;
  if (!PUBLISHABLE_KEY || typeof window === "undefined" || !window.Stripe) return null;
  instance = window.Stripe(PUBLISHABLE_KEY, { betas: ["custom_checkout_payment_form_1"] });
  return instance;
}

/**
 * Mounts the payment form for a Checkout Session and wires confirmation.
 * On success Stripe sends the customer to the session's return_url. Returns
 * the form so the caller can unmount it.
 */
export async function mountCheckoutForm(container: HTMLElement, clientSecret: string, onError: (message: string) => void): Promise<CheckoutForm | null> {
  const stripe = stripeJs();
  if (!stripe) {
    onError(PUBLISHABLE_KEY ? "Stripe.js did not load." : "VITE_STRIPE_PUBLISHABLE_KEY is not set.");
    return null;
  }
  const checkout = stripe.initCheckoutFormSdk({ clientSecret: Promise.resolve(clientSecret), appearance: APPEARANCE });
  const form = checkout.createForm({ layout: "expanded" });
  form.mount(container);
  const loaded = await checkout.loadActions();
  if (loaded.type === "success" && loaded.actions) {
    const { actions } = loaded;
    form.on("confirm", async (event) => {
      try {
        await actions.confirm({ formConfirmEvent: event });
      } catch (error) {
        console.error("Payment confirmation error:", error);
        onError(error instanceof Error ? error.message : "Payment could not be confirmed.");
      }
    });
  } else {
    onError(loaded.error?.message ?? "The payment form could not start.");
  }
  return form;
}
