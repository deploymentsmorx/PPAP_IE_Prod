/**
 * Drawing revisions step through single uppercase letters (H -> I -> J...).
 * On Z, rolls over to AA per the usual engineering-drawing convention.
 */
export function nextRevisionLetter(current: string): string {
  const trimmed = current.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(trimmed)) {
    throw new Error(`Cannot increment non-alphabetic revision "${current}"`);
  }

  const chars = trimmed.split("");
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] === "Z") {
      chars[i] = "A";
      i--;
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join("");
    }
  }
  return "A" + chars.join("");
}
