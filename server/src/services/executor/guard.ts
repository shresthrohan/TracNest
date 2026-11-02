import { BlockList, isIP } from "node:net";

const list = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.168.0.0", 16], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) list.addSubnet(net, bits, "ipv4");
list.addAddress("::", "ipv6");
list.addAddress("::1", "ipv6");
for (const [net, bits] of [["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) list.addSubnet(net, bits, "ipv6");

// Expand ::ffff:a.b.c.d and ::ffff:xxxx:yyyy to dotted IPv4, else null.
function mappedV4(ip: string): string | null {
  const m = /^(?:0{0,4}:){0,5}:?ffff:(.+)$/i.exec(ip) ?? /^::ffff:(.+)$/i.exec(ip);
  if (!m) return null;
  if (isIP(m[1]) === 4) return m[1];
  const h = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(m[1]);
  if (!h) return null;
  const a = parseInt(h[1], 16), b = parseInt(h[2], 16);
  return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
}

/** True if the IP is in a blocked range. Unparseable input is blocked. */
export function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (!v) return true;
  if (v === 4) return list.check(ip, "ipv4");
  const v4 = mappedV4(ip);
  return v4 ? list.check(v4, "ipv4") : list.check(ip, "ipv6");
}
