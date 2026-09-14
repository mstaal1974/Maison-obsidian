import { paths } from "../lib/route";

export default function Help() {
  const contact = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;
  const privacy = import.meta.env.VITE_PRIVACY_POLICY_URL as string | undefined;
  const returns = import.meta.env.VITE_RETURNS_POLICY_URL as string | undefined;
  const safeUrl = (url?: string) => url && /^https:\/\//.test(url) ? url : null;
  return <main className="mo-help" style={{maxWidth: 840, margin: "0 auto", padding: "110px 24px 64px", color: "#f3ecdc", fontSize: 16, lineHeight: 1.7}}>
    <h1>Shopping help</h1>
    <h2>Choose your fragrance and format</h2>
    <p>Start with a fragrance, then choose an available bottle size or car diffuser. Products marked coming soon cannot be ordered. For a smaller introduction, explore the 10 ml discovery range.</p>
    <a href={paths.discovery}>Explore discovery fragrances</a>
    <h2>Delivery and payment</h2>
    <p>Postal orders require an Australian address and a postage quote before you continue to Stripe. The total includes the selected delivery charge. If quotes are unavailable, postal checkout pauses until they return.</p>
    <p>Alternate delivery is for arrangements made directly with the house. Include a contact number and clear delivery instructions.</p>
    <p>You can check out as a guest. Payment is confirmed on Stripe; an unconfigured preview cannot place an order.</p>
    <h2>Returns and support</h2>
    {safeUrl(returns) ? <p><a href={returns}>Read the returns policy</a></p> : <p>Contact the house to confirm return arrangements before ordering. A detailed returns policy is not yet published here.</p>}
    {contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? <p><a href={`mailto:${contact}`}>Email customer support</a></p> : <p>Online support contact details are not yet available here.</p>}
    <h2>Privacy</h2>
    {safeUrl(privacy) ? <p><a href={privacy}>Read the privacy policy</a></p> : <p>A detailed privacy policy is not yet published here. Please confirm how your information will be handled before submitting personal details.</p>}
    <a href={paths.fragrances}>Back to fragrances</a>
  </main>;
}
