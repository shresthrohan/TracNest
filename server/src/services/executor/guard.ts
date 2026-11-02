import { BlockList, isIP } from "node:net";

const list = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.168.0.0", 16], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) list.addSubnet(net, bits, "ipv4");
list.addAddress("::", "ipv6");
list.addAddress("::1", "ipv6");
for (const [net, bits] of [["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) list.addSubnet(net, bits, "ipv6");

// IPv6 -> 16 bytes (isIP already validated the text).
function v6Bytes(ip: string): number[] {
  let t = ip.split("%")[0];
  const dot = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(t);
  if (dot) t = t.slice(0, dot.index) + ((+dot[1] << 8) | +dot[2]).toString(16) + ":" + ((+dot[3] << 8) | +dot[4]).toString(16);
  const [head, tail] = t.split("::");
  const h = head ? head.split(":") : [];
  const l = tail === undefined ? [] : tail ? tail.split(":") : [];
  const groups = tail === undefined ? h : [...h, ...Array(8 - h.length - l.length).fill("0"), ...l];
  return groups.flatMap((g) => [parseInt(g, 16) >> 8, parseInt(g, 16) & 255]);
}

/** IPv4 embedded in an IPv6 address (mapped, SIIT, NAT64, 6to4), else null. ::/96 is blocked outright by the caller. */
function embeddedV4(b: number[]): string | null {
  const zero = (from: number, to: number) => b.slice(from, to).every((x) => x === 0);
  const at = (o: number) => b.slice(o, o + 4).join(".");
  if (zero(0, 10) && b[10] === 255 && b[11] === 255) return at(12); // ::ffff:a.b.c.d
  if (zero(0, 8) && b[8] === 255 && b[9] === 255 && b[10] === 0 && b[11] === 0) return at(12); // ::ffff:0:a.b.c.d (SIIT)
  if (b[0] === 0 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && zero(4, 12)) return at(12); // 64:ff9b::/96 (NAT64)
  if (b[0] === 0x20 && b[1] === 0x02) return at(2); // 2002::/16 (6to4)
  return null;
}

/** True if the IP is in a blocked range. Unparseable input is blocked. */
export function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (!v) return true;
  if (v === 4) return list.check(ip, "ipv4");
  const b = v6Bytes(ip);
  if (b.slice(0, 12).every((x) => x === 0)) return true; // ::/96 (IPv4-compatible, ::, ::1)
  const v4 = embeddedV4(b);
  return v4 ? list.check(v4, "ipv4") : list.check(ip.split("%")[0], "ipv6");
}
