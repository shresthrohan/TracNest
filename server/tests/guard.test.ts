import { describe, it, expect } from "vitest";
import { isBlockedIp } from "../src/services/executor/guard.js";

describe("isBlockedIp", () => {
  it.each(["127.0.0.1", "10.1.2.3", "169.254.169.254", "100.64.0.1", "::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "fd00::1", "0.0.0.0", "192.168.1.1", "172.16.0.1", "224.0.0.1", "fe80::1", "ff02::1", "::", "garbage"])(
    "blocks %s",
    (ip) => expect(isBlockedIp(ip)).toBe(true),
  );
  it.each(["93.184.216.34", "2606:4700::1111", "172.32.0.1", "::ffff:93.184.216.34"])("allows %s", (ip) => expect(isBlockedIp(ip)).toBe(false));
});
