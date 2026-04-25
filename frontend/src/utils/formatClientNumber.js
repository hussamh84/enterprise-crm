/** Display label for sequential clients: prefer API `clientCode` (zero-padded), else pad `clientNumber`. */
function padFour(n) {
  const num = Math.floor(Number(n));
  if (Number.isNaN(num)) return "";
  return String(num).padStart(4, "0");
}

/**
 * @param {number|string|{ clientCode?: string, clientNumber?: number|string }|null|undefined} clientOrNumber
 */
export function formatClientNumber(clientOrNumber) {
  if (clientOrNumber == null || clientOrNumber === "") return "—";
  if (typeof clientOrNumber === "object") {
    const code = clientOrNumber.clientCode;
    if (code != null && String(code).trim() !== "") {
      return `Client #${String(code)}`;
    }
    const n = clientOrNumber.clientNumber;
    if (n == null || n === "") return "—";
    const padded = padFour(n);
    return padded ? `Client #${padded}` : "—";
  }
  const padded = padFour(clientOrNumber);
  return padded ? `Client #${padded}` : "—";
}
