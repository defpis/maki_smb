/**
 * NTLM Authentication
 */
import crypto from "crypto";
import desjs from "des.js";
import md4 from "js-md4";

const FLAGS = {
  UNICODE: 1 << 0,
  NTLM: 1 << 9,
  ALWAYS_SIGN: 1 << 15,
  EXTENDED_SESSION_SECURITY: 1 << 19,
  TARGET_INFO: 1 << 23,
  VERSION: 1 << 25,
};

/**
 * Create NTLM Type 1 message (Negotiate)
 */
export function createType1(hostname: string, domain: string): Buffer {
  const host = hostname.toUpperCase();
  const dom = domain.toUpperCase();
  const hostLen = Buffer.byteLength(host, "ascii");
  const domLen = Buffer.byteLength(dom, "ascii");

  const buf = Buffer.alloc(32 + hostLen + domLen);
  let offset = 0;

  // Signature
  buf.write("NTLMSSP\0", offset);
  offset += 8;

  // Type = 1
  buf.writeUInt32LE(1, offset);
  offset += 4;

  // Flags
  const flags =
    FLAGS.UNICODE |
    FLAGS.NTLM |
    FLAGS.ALWAYS_SIGN |
    FLAGS.EXTENDED_SESSION_SECURITY |
    FLAGS.TARGET_INFO |
    FLAGS.VERSION;
  buf.writeUInt32LE(flags, offset);
  offset += 4;

  // Domain
  buf.writeUInt16LE(domLen, offset);
  buf.writeUInt16LE(domLen, offset + 2);
  buf.writeUInt32LE(32 + hostLen, offset + 4);
  offset += 8;

  // Hostname
  buf.writeUInt16LE(hostLen, offset);
  buf.writeUInt16LE(hostLen, offset + 2);
  buf.writeUInt32LE(32, offset + 4);
  offset += 8;

  // Write strings
  buf.write(host, 32, "ascii");
  buf.write(dom, 32 + hostLen, "ascii");

  return buf;
}

/**
 * Parse NTLM Type 2 message (Challenge)
 */
export function parseType2(buf: Buffer) {
  if (buf.toString("ascii", 0, 7) !== "NTLMSSP" || buf.readUInt8(7) !== 0) {
    throw new Error("Invalid NTLM signature");
  }
  if (buf.readUInt32LE(8) !== 2) {
    throw new Error("Not a Type 2 message");
  }

  return {
    flags: buf.readUInt32LE(20),
    challenge: buf.subarray(24, 32),
  };
}

/**
 * Create NTLM Type 3 message (Authentication)
 */
export function createType3(
  username: string,
  hostname: string,
  domain: string,
  password: string,
  challenge: Buffer,
  flags: number,
): Buffer {
  const host = hostname.toUpperCase();
  const dom = domain.toUpperCase();
  const ntHash = md4.arrayBuffer(Buffer.from(password, "utf16le"));
  const useV2 = (flags & FLAGS.EXTENDED_SESSION_SECURITY) !== 0;

  let lmResponse: Buffer;
  let ntResponse: Buffer;

  if (useV2) {
    const ntlmv2Hash = createNtlmV2Hash(username, dom, Buffer.from(ntHash));
    const clientChallenge = crypto.randomBytes(8);
    const timestamp = createTimestamp();
    const targetInfo = createTargetInfo(host, dom);

    ntResponse = createNtlmV2Response(
      ntlmv2Hash,
      challenge,
      clientChallenge,
      timestamp,
      targetInfo,
    );
    lmResponse = createLmV2Response(ntlmv2Hash, challenge, clientChallenge);
  } else {
    const ntHashPadded = Buffer.alloc(21);
    Buffer.from(ntHash).copy(ntHashPadded);
    ntResponse = desResponse(ntHashPadded, challenge);

    const lmHash = createLmHash(password);
    const lmHashPadded = Buffer.alloc(21);
    lmHash.copy(lmHashPadded);
    lmResponse = desResponse(lmHashPadded, challenge);
  }

  // Build Type 3 message
  const userBuf = Buffer.from(username, "ucs2");
  const hostBuf = Buffer.from(host, "ucs2");
  const domBuf = Buffer.from(dom, "ucs2");

  const fixedOffset = 64;
  const domOffset = fixedOffset;
  const userOffset = domOffset + domBuf.length;
  const hostOffset = userOffset + userBuf.length;
  const lmOffset = hostOffset + hostBuf.length;
  const ntOffset = lmOffset + lmResponse.length;

  const buf = Buffer.alloc(ntOffset + ntResponse.length);
  let offset = 0;

  // Signature
  buf.write("NTLMSSP\0", offset);
  offset += 8;

  // Type = 3
  buf.writeUInt32LE(3, offset);
  offset += 4;

  // LM Response
  buf.writeUInt16LE(lmResponse.length, offset);
  buf.writeUInt16LE(lmResponse.length, offset + 2);
  buf.writeUInt32LE(lmOffset, offset + 4);
  offset += 8;

  // NT Response
  buf.writeUInt16LE(ntResponse.length, offset);
  buf.writeUInt16LE(ntResponse.length, offset + 2);
  buf.writeUInt32LE(ntOffset, offset + 4);
  offset += 8;

  // Domain
  buf.writeUInt16LE(domBuf.length, offset);
  buf.writeUInt16LE(domBuf.length, offset + 2);
  buf.writeUInt32LE(domOffset, offset + 4);
  offset += 8;

  // User
  buf.writeUInt16LE(userBuf.length, offset);
  buf.writeUInt16LE(userBuf.length, offset + 2);
  buf.writeUInt32LE(userOffset, offset + 4);
  offset += 8;

  // Hostname
  buf.writeUInt16LE(hostBuf.length, offset);
  buf.writeUInt16LE(hostBuf.length, offset + 2);
  buf.writeUInt32LE(hostOffset, offset + 4);
  offset += 8;

  // Encrypted Random Session Key (empty)
  offset += 8;

  // Flags
  buf.writeUInt32LE(flags, offset);
  offset += 4;

  // Copy data
  domBuf.copy(buf, domOffset);
  userBuf.copy(buf, userOffset);
  hostBuf.copy(buf, hostOffset);
  lmResponse.copy(buf, lmOffset);
  ntResponse.copy(buf, ntOffset);

  return buf;
}

// ==================== Helpers ====================

function createLmHash(password: string): Buffer {
  const pwd = password.toUpperCase().padEnd(14, "\0").slice(0, 14);
  const pwdBuf = Buffer.from(pwd, "ascii");

  const key1 = expandDesKey(pwdBuf.subarray(0, 7));
  const key2 = expandDesKey(pwdBuf.subarray(7, 14));
  const magic = Buffer.from("KGS!@#$%", "ascii");

  const des1 = desjs.DES.create({ type: "encrypt", key: key1 });
  const des2 = desjs.DES.create({ type: "encrypt", key: key2 });

  return Buffer.concat([
    Buffer.from(des1.update(magic)),
    Buffer.from(des2.update(magic)),
  ]);
}

function createNtlmV2Hash(
  username: string,
  domain: string,
  ntHash: Buffer,
): Buffer {
  const identity = Buffer.from(
    username.toUpperCase() + domain.toUpperCase(),
    "ucs2",
  );
  return crypto.createHmac("md5", ntHash).update(identity).digest();
}

function createTimestamp(): Buffer {
  const buf = Buffer.alloc(8);
  const now = BigInt(Date.now() + 11644473600000) * 10000n;
  buf.writeBigUInt64LE(now);
  return buf;
}

function createTargetInfo(hostname: string, domain: string): Buffer {
  const hostBuf = Buffer.from(hostname, "utf16le");
  const domBuf = Buffer.from(domain, "utf16le");
  const size = 4 + hostBuf.length + 4 + domBuf.length + 4;
  const buf = Buffer.alloc(size);
  let offset = 0;

  // MsvAvNbComputerName
  buf.writeUInt16LE(1, offset);
  buf.writeUInt16LE(hostBuf.length, offset + 2);
  hostBuf.copy(buf, offset + 4);
  offset += 4 + hostBuf.length;

  // MsvAvNbDomainName
  buf.writeUInt16LE(2, offset);
  buf.writeUInt16LE(domBuf.length, offset + 2);
  domBuf.copy(buf, offset + 4);
  offset += 4 + domBuf.length;

  // MsvAvEOL
  buf.writeUInt16LE(0, offset);
  buf.writeUInt16LE(0, offset + 2);

  return buf;
}

function createNtlmV2Response(
  hash: Buffer,
  serverChallenge: Buffer,
  clientChallenge: Buffer,
  timestamp: Buffer,
  targetInfo: Buffer,
): Buffer {
  const blob = Buffer.concat([
    Buffer.from([0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
    timestamp,
    clientChallenge,
    Buffer.alloc(4),
    targetInfo,
  ]);

  const hmac = crypto.createHmac("md5", hash);
  hmac.update(serverChallenge);
  hmac.update(blob);

  return Buffer.concat([hmac.digest(), blob]);
}

function createLmV2Response(
  hash: Buffer,
  serverChallenge: Buffer,
  clientChallenge: Buffer,
): Buffer {
  const hmac = crypto.createHmac("md5", hash);
  hmac.update(Buffer.concat([serverChallenge, clientChallenge]));
  return Buffer.concat([hmac.digest(), clientChallenge]);
}

function desResponse(hash: Buffer, challenge: Buffer): Buffer {
  const k1 = expandDesKey(hash.subarray(0, 7));
  const k2 = expandDesKey(hash.subarray(7, 14));
  const k3 = expandDesKey(hash.subarray(14, 21));

  const des1 = desjs.DES.create({ type: "encrypt", key: k1 });
  const des2 = desjs.DES.create({ type: "encrypt", key: k2 });
  const des3 = desjs.DES.create({ type: "encrypt", key: k3 });

  return Buffer.concat([
    Buffer.from(des1.update(challenge)),
    Buffer.from(des2.update(challenge)),
    Buffer.from(des3.update(challenge)),
  ]);
}

function expandDesKey(key7: Buffer): Buffer {
  const key8 = Buffer.alloc(8);
  key8[0] = key7[0];
  key8[1] = ((key7[0] << 7) | (key7[1] >> 1)) & 0xff;
  key8[2] = ((key7[1] << 6) | (key7[2] >> 2)) & 0xff;
  key8[3] = ((key7[2] << 5) | (key7[3] >> 3)) & 0xff;
  key8[4] = ((key7[3] << 4) | (key7[4] >> 4)) & 0xff;
  key8[5] = ((key7[4] << 3) | (key7[5] >> 5)) & 0xff;
  key8[6] = ((key7[5] << 2) | (key7[6] >> 6)) & 0xff;
  key8[7] = (key7[6] << 1) & 0xff;
  return key8;
}
