// Copyright (C) 2026 SoloPlax
// SPDX-License-Identifier: GPL-3.0-only

const crypto = require("node:crypto");
function createKeys() {
  return crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}
function issueLicense(data, privateKey) {
  if (!data.customer?.trim() || !data.deviceId?.trim())
    throw Error("Customer and installation code are required.");
  if (data.expires && !/^\d{4}-\d{2}-\d{2}$/.test(data.expires))
    throw Error("Use an expiry date in YYYY-MM-DD format.");
  if (
    data.expires &&
    (!Number.isFinite(Date.parse(data.expires + "T23:59:59Z")) ||
      new Date(data.expires + "T23:59:59Z").toISOString().slice(0, 10) !==
        data.expires)
  )
    throw Error("Invalid expiry date.");
  const payload = {
    version: 1,
    product: "GerbCraft",
    edition: "Professional",
    id: crypto.randomUUID(),
    customer: data.customer.trim(),
    deviceId: data.deviceId.trim(),
    issued: new Date().toISOString(),
    expires: data.expires || null,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .sign(null, Buffer.from(encoded), privateKey)
    .toString("base64url");
  return encoded + "." + signature;
}
function verifyLicense(token, publicKey, deviceId, now = new Date()) {
  if (typeof token !== "string" || token.length > 16000)
    throw Error("Invalid licence file.");
  const [payload, signature, ...extra] = token.trim().split(".");
  if (
    !payload ||
    !signature ||
    extra.length ||
    !crypto.verify(
      null,
      Buffer.from(payload),
      publicKey,
      Buffer.from(signature, "base64url"),
    )
  )
    throw Error("The licence signature is invalid.");
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    throw Error("Invalid licence data.");
  }
  if (
    data.version !== 1 ||
    data.product !== "GerbCraft" ||
    typeof data.customer !== "string" ||
    !data.customer.trim() ||
    typeof data.id !== "string" ||
    data.edition !== "Professional"
  )
    throw Error("This licence is not for GerbCraft.");
  if (data.deviceId !== deviceId)
    throw Error("This licence belongs to a different installation.");
  if (
    !Number.isFinite(Date.parse(data.issued)) ||
    Date.parse(data.issued) > now.getTime() + 300000
  )
    throw Error("Licence issue date is invalid or in the future.");
  if (
    data.expires &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(data.expires) ||
      !Number.isFinite(Date.parse(data.expires + "T23:59:59Z")) ||
      new Date(data.expires + "T23:59:59Z").toISOString().slice(0, 10) !==
        data.expires ||
      now.getTime() > Date.parse(data.expires + "T23:59:59Z"))
  )
    throw Error("This licence has expired or has an invalid expiry.");
  return data;
}
module.exports = { createKeys, issueLicense, verifyLicense };
