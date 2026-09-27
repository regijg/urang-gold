/** wa.me link; Indonesian local numbers (08...) are converted to 628... */
export function waLink(phone: string | null | undefined, text: string): string {
  const to = phone ? phone.replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^0/, "62") : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}
