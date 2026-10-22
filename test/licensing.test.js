import test from "node:test";
import assert from "node:assert/strict";
import api from "../electron/licensing.cjs";
const { createKeys, issueLicense, verifyLicense } = api;
test("signed offline licence binds to key, installation and expiry", () => {
  const k = createKeys(),
    token = issueLicense(
      { customer: "Test", deviceId: "device1", expires: "2030-01-01" },
      k.privateKey,
    );
  assert.equal(verifyLicense(token, k.publicKey, "device1").customer, "Test");
  assert.throws(() => verifyLicense(token, k.publicKey, "device2"));
  assert.throws(() => verifyLicense(token, createKeys().publicKey, "device1"));
  assert.throws(() =>
    verifyLicense(token, k.publicKey, "device1", new Date("2031-01-01")),
  );
  assert.throws(() =>
    verifyLicense(
      token.slice(0, 10) + "A" + token.slice(11),
      k.publicKey,
      "device1",
    ),
  );
});
test("issuer refuses missing identity fields", () => {
  const k = createKeys();
  assert.throws(() =>
    issueLicense({ customer: "", deviceId: "x" }, k.privateKey),
  );
  assert.throws(() =>
    issueLicense({ customer: "A", deviceId: "" }, k.privateKey),
  );
});
