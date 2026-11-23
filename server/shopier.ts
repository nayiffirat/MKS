/**
 * Shopier Tam Otomatik Abonelik Aktivasyonu (OSB Webhook + Tek Kullanımlık Sipariş Kodu Kilidi).
 * - POST /api/shopier/webhook    : Shopier OSB / Webhook ödeme bildirimini doğrular, eşleşen MKS hesabını
 *                                  otomatik aktif eder; farklı e-posta/telefonla alındıysa PENDING_CLAIM saklar.
 * - POST /api/shopier/claim-order: Farklı e-posta/telefonla alan kullanıcı sipariş numarasını 1 kez girerek
 *                                  aboneliğini kendi hesabına alır. Firestore updateTime önkoşuluyla ikinci
 *                                  kullanım (anti-replay) kalıcı olarak engellenir.
 */
import crypto from "crypto";
import { execSync } from "child_process";
import express, { Express, Request, Response } from "express";
import type { SubscriptionTierId, BillingPeriod } from "../utils/subscriptionManager";

const FS_PROJECT = (process.env.FIREBASE_PROJECT_ID || "muhendiskayitsistemi").trim();
const FS_DATABASE = (process.env.FIRESTORE_DATABASE_ID || "ai-studio-9eae1cae-4469-4d37-8b42-5e0fb091a527").trim();
const FS_ORG_PATH = "MKS/g892bEaJyGfEq1Fa67yb";
const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

export interface ShopierProductSpec {
  tier: SubscriptionTierId;
  period: BillingPeriod;
  days: number;
}

export const SHOPIER_PRODUCT_MAP: Record<string, ShopierProductSpec> = {
  "52837181": { tier: "PRO", period: "MONTHLY", days: 31 },
  "52837239": { tier: "PRO", period: "YEARLY", days: 366 },
  "52837600": { tier: "ULTRA", period: "MONTHLY", days: 31 },
  "52837843": { tier: "ULTRA", period: "YEARLY", days: 366 },
  "52837907": { tier: "MAX", period: "MONTHLY", days: 31 },
  "52837923": { tier: "MAX", period: "YEARLY", days: 366 },
};

const TIER_RANK: Record<SubscriptionTierId, number> = {
  PRO: 1,
  ULTRA: 2,
  MAX: 3,
};

export function normalizeTrPhone10(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 && digits.startsWith("5")) return digits;
  if (digits.length === 11 && digits.startsWith("05")) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith("905")) return digits.slice(2);
  if (digits.length > 10 && digits.slice(-10).startsWith("5")) return digits.slice(-10);
  return "";
}

export function normalizeShopierOrderId(raw: unknown): string {
  const cleaned = String(raw ?? "").trim().replace(/[^A-Za-z0-9_-]/g, "");
  return cleaned.length >= 4 && cleaned.length <= 64 ? cleaned : "";
}

export function resolveShopierPlanFromOrder(input: {
  productId?: unknown;
  productIds?: unknown[];
  title?: unknown;
  price?: unknown;
}): ShopierProductSpec {
  const candidates: string[] = [];
  if (input.productId !== undefined && input.productId !== null) {
    candidates.push(String(input.productId).trim());
  }
  if (Array.isArray(input.productIds)) {
    for (const item of input.productIds) {
      if (item !== undefined && item !== null) candidates.push(String(item).trim());
    }
  }
  for (const raw of candidates) {
    if (SHOPIER_PRODUCT_MAP[raw]) return SHOPIER_PRODUCT_MAP[raw];
    const numMatch = raw.match(/\b(52837181|52837239|52837600|52837843|52837907|52837923)\b/);
    if (numMatch && SHOPIER_PRODUCT_MAP[numMatch[1]]) {
      return SHOPIER_PRODUCT_MAP[numMatch[1]];
    }
  }

  const title = String(input.title || "").toLocaleUpperCase("tr-TR");
  const isYearly = /YILLIK|YEARLY|12\s*AY|SENELİK|SENELIK/.test(title);
  if (/\bMAX\b|KURUMSAL/.test(title)) {
    return { tier: "MAX", period: isYearly ? "YEARLY" : "MONTHLY", days: isYearly ? 366 : 31 };
  }
  if (/\bULTRA\b/.test(title)) {
    return { tier: "ULTRA", period: isYearly ? "YEARLY" : "MONTHLY", days: isYearly ? 366 : 31 };
  }
  if (/\bPRO\b/.test(title) && isYearly) {
    return { tier: "PRO", period: "YEARLY", days: 366 };
  }

  const priceNum = Number(String(input.price ?? "").replace(",", ".")) || 0;
  if (priceNum >= 11000) return { tier: "MAX", period: "YEARLY", days: 366 };
  if (priceNum >= 6500) return { tier: "ULTRA", period: "YEARLY", days: 366 };
  if (priceNum >= 3500) return { tier: "PRO", period: "YEARLY", days: 366 };
  if (priceNum >= 1200) return { tier: "MAX", period: "MONTHLY", days: 31 };
  if (priceNum >= 700) return { tier: "ULTRA", period: "MONTHLY", days: 31 };
  return { tier: "PRO", period: "MONTHLY", days: 31 };
}

/** Shopier OSB doğrulaması: HMAC-SHA256(resBase64 + osbUsername, osbKey) hex. */
export function verifyShopierOsbSignature(
  resB64: string,
  osbUsername: string,
  incomingHash: string,
  osbKey: string
): boolean {
  if (!resB64 || !incomingHash || !osbKey) return false;
  const expected = crypto.createHmac("sha256", osbKey).update(`${resB64}${osbUsername}`, "utf8").digest("hex");
  const normIncoming = incomingHash.trim().toLowerCase();
  if (expected.length !== normIncoming.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(normIncoming, "utf8"));
}

/** Shopier Webhook v1 doğrulaması: X-Shopier-Signature (HMAC-SHA256 hex veya base64). */
export function verifyShopierModernSignature(rawBody: string, incomingSig: string, secret: string): boolean {
  if (!rawBody || !incomingSig || !secret) return false;
  const trimmed = incomingSig.trim();
  const digestHex = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const digestB64 = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const safeEq = (a: string, b: string) =>
    a.length === b.length && crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  return safeEq(digestHex, trimmed.toLowerCase()) || safeEq(digestB64, trimmed);
}

export function computeNewSubscriptionEnd(
  currentEndIso: string | undefined,
  currentTier: unknown,
  newTier: SubscriptionTierId,
  period: BillingPeriod,
  nowMs = Date.now()
): { endsAtIso: string; endsAtMs: number } {
  const durationMs = (period === "YEARLY" ? 366 : 31) * 86_400_000;
  const curMs = currentEndIso ? new Date(currentEndIso).getTime() : 0;
  const curNorm = String(currentTier || "PRO").toUpperCase();
  const baseMs = Number.isFinite(curMs) && curMs > nowMs && curNorm === newTier ? curMs : nowMs;
  const endsAtMs = baseMs + durationMs;
  return { endsAtIso: new Date(endsAtMs).toISOString(), endsAtMs };
}

// ---------------------------------------------------------------------------
// Google Cloud Firestore REST Client (Cloud Run Metadata Server / Local gcloud)
// ---------------------------------------------------------------------------
let cachedGcpToken = "";
let cachedGcpTokenExpMs = 0;

async function getGoogleAccessToken(): Promise<string> {
  const explicit = (process.env.GCP_ACCESS_TOKEN || "").trim();
  if (explicit) return explicit;
  const now = Date.now();
  if (cachedGcpToken && now < cachedGcpTokenExpMs) return cachedGcpToken;

  try {
    const resp = await fetch(METADATA_TOKEN_URL, {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(4000),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { access_token?: string; expires_in?: number };
      if (data.access_token) {
        cachedGcpToken = data.access_token;
        cachedGcpTokenExpMs = now + Math.max(60, (data.expires_in || 3600) - 90) * 1000;
        return cachedGcpToken;
      }
    }
  } catch {
    // Metadata sunucusu yoksa (yerel geliştirme ortamı) gcloud CLI yedeğini dene
  }

  if (!process.env.K_SERVICE) {
    try {
      const tok = execSync("gcloud auth print-access-token", { encoding: "utf8", timeout: 5000 }).trim();
      if (tok) {
        cachedGcpToken = tok;
        cachedGcpTokenExpMs = now + 300_000;
        return tok;
      }
    } catch {
      /* gcloud unavailable */
    }
  }

  throw new Error("Sunucu Firestore erişim belirteci alınamadı.");
}

function fsBaseDocUrl(docPath: string): string {
  return `https://firestore.googleapis.com/v1/projects/${FS_PROJECT}/databases/${FS_DATABASE}/documents/${docPath}`;
}

function toFsValue(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === "object") {
    const fields: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) {
      if (val !== undefined) fields[k] = toFsValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function fromFsValue(val: any): any {
  if (!val || typeof val !== "object") return null;
  if ("nullValue" in val) return null;
  if ("booleanValue" in val) return Boolean(val.booleanValue);
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("stringValue" in val) return String(val.stringValue);
  if ("timestampValue" in val) return String(val.timestampValue);
  if ("arrayValue" in val) return (val.arrayValue?.values || []).map(fromFsValue);
  if ("mapValue" in val) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue?.fields || {})) {
      out[k] = fromFsValue(v);
    }
    return out;
  }
  return null;
}

function fromFsDoc(doc: any): { id: string; updateTime?: string; data: Record<string, any> } | null {
  if (!doc?.name) return null;
  const id = String(doc.name).split("/").pop() || "";
  const data: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    data[k] = fromFsValue(v);
  }
  return { id, updateTime: doc.updateTime, data };
}

async function fsGetDoc(docPath: string) {
  const token = await getGoogleAccessToken();
  const r = await fetch(fsBaseDocUrl(docPath), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore read failed (${r.status})`);
  return fromFsDoc(await r.json());
}

async function fsPatchDoc(
  docPath: string,
  data: Record<string, any>,
  opts: { exists?: boolean; updateTime?: string } = {}
): Promise<{ ok: boolean; status: number; doc?: ReturnType<typeof fromFsDoc> }> {
  const token = await getGoogleAccessToken();
  const params = new URLSearchParams();
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields[k] = toFsValue(v);
      params.append("updateMask.fieldPaths", k);
    }
  }
  if (opts.exists !== undefined) {
    params.set("currentDocument.exists", String(opts.exists));
  }
  if (opts.updateTime) {
    params.set("currentDocument.updateTime", opts.updateTime);
  }
  const r = await fetch(`${fsBaseDocUrl(docPath)}?${params.toString()}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) {
    return { ok: false, status: r.status };
  }
  return { ok: true, status: r.status, doc: fromFsDoc(await r.json()) };
}

async function findMksUserByContact(email: string, phone10: string) {
  const token = await getGoogleAccessToken();
  const normEmail = email.trim().toLowerCase();

  if (phone10) {
    const dir = await fsGetDoc(`${FS_ORG_PATH}/phone_directory/${phone10}`).catch(() => null);
    if (dir?.data?.uid) {
      const userDoc = await fsGetDoc(`${FS_ORG_PATH}/users/${dir.data.uid}`).catch(() => null);
      if (userDoc) return userDoc;
    }
  }

  // Exact query on users.email first
  if (normEmail) {
    const qRes = await fetch(`${fsBaseDocUrl(FS_ORG_PATH)}:runQuery`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "users" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "email" },
              op: "EQUAL",
              value: { stringValue: normEmail },
            },
          },
          limit: 1,
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (qRes.ok) {
      const rows = (await qRes.json()) as any[];
      const hit = rows.find(x => x.document)?.document;
      if (hit) return fromFsDoc(hit);
    }
  }

  // Fallback scan (case-insensitive email / formatted phone numbers)
  const params = new URLSearchParams({ pageSize: "200" });
  for (const field of ["email", "phoneNumber", "subscriptionTier", "subscriptionEndsAt", "subscriptionStatus"]) {
    params.append("mask.fieldPaths", field);
  }
  const listRes = await fetch(`${fsBaseDocUrl(`${FS_ORG_PATH}/users`)}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!listRes.ok) return null;
  const listJson = (await listRes.json()) as { documents?: any[] };
  for (const rawDoc of listJson.documents || []) {
    const parsed = fromFsDoc(rawDoc);
    if (!parsed) continue;
    const uEmail = String(parsed.data.email || "").trim().toLowerCase();
    const uPhone = normalizeTrPhone10(parsed.data.phoneNumber);
    if ((normEmail && uEmail === normEmail) || (phone10 && uPhone === phone10)) {
      return parsed;
    }
  }
  return null;
}

async function grantSubscriptionToUser(
  uid: string,
  plan: ShopierProductSpec,
  orderId: string,
  currentUserData?: Record<string, any>
) {
  const existing = currentUserData || (await fsGetDoc(`${FS_ORG_PATH}/users/${uid}`))?.data || {};
  const { endsAtIso, endsAtMs } = computeNewSubscriptionEnd(
    existing.subscriptionEndsAt,
    existing.subscriptionTier,
    plan.tier,
    plan.period
  );
  const currentRank = TIER_RANK[(String(existing.subscriptionTier || "PRO").toUpperCase() as SubscriptionTierId)] || 1;
  const finalTier: SubscriptionTierId = TIER_RANK[plan.tier] >= currentRank ? plan.tier : (String(existing.subscriptionTier).toUpperCase() as SubscriptionTierId);
  const patchRes = await fsPatchDoc(`${FS_ORG_PATH}/users/${uid}`, {
    subscriptionStatus: "active",
    subscriptionTier: finalTier,
    subscriptionEndsAt: endsAtIso,
    subscriptionEndsAtMs: endsAtMs,
    lastShopierOrderId: orderId,
    lastPaymentProvider: "SHOPIER",
    lastPaymentAt: new Date().toISOString(),
  });
  if (!patchRes.ok) {
    throw new Error(`Kullanıcı aboneliği güncellenemedi (${patchRes.status})`);
  }
  return { finalTier, endsAtIso, endsAtMs };
}

async function loadShopierServerConfig() {
  let osbUsername = (process.env.SHOPIER_OSB_USERNAME || "").trim();
  let osbKey = (process.env.SHOPIER_OSB_KEY || "").trim();
  let webhookToken = (process.env.SHOPIER_WEBHOOK_TOKEN || "").trim();
  if (!osbKey && !webhookToken) {
    const cfg = await fsGetDoc(`${FS_ORG_PATH}/system_settings/shopier_server_config`).catch(() => null);
    if (cfg?.data) {
      osbUsername = osbUsername || String(cfg.data.osbUsername || "").trim();
      osbKey = osbKey || String(cfg.data.osbKey || "").trim();
      webhookToken = webhookToken || String(cfg.data.webhookToken || "").trim();
    }
  }
  return { osbUsername, osbKey, webhookToken };
}

export interface ShopierRouteDeps {
  verifyFirebaseIdToken: (idToken: string, allowOfflineDevFallback: boolean) => Promise<{ uid: string; email?: string } | null>;
  checkRateLimit: (key: string, maxRequests?: number, windowMs?: number) => boolean;
}

export function registerShopierRoutes(app: Express, deps: ShopierRouteDeps) {
  /**
   * 1. Shopier OSB / Webhook — ödeme bildirimi geldiği anda imzayı doğrular,
   *    eşleşen hesabı anında aktif eder veya farklı mail/telefon için tek kullanımlık sipariş kaydı açar.
   */
  app.post("/api/shopier/webhook", express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
    try {
      const { osbUsername, osbKey, webhookToken } = await loadShopierServerConfig();
      if (!osbKey && !webhookToken) {
        return res.status(503).send("shopier_not_configured");
      }

      let payload: any = null;
      const body = req.body || {};
      if (typeof body.res === "string" && typeof body.hash === "string") {
        if (!verifyShopierOsbSignature(body.res, osbUsername, body.hash, osbKey)) {
          return res.status(401).send("unauthorized");
        }
        try {
          payload = JSON.parse(Buffer.from(body.res, "base64").toString("utf8"));
        } catch {
          return res.status(400).send("invalid_payload");
        }
      } else {
        const sigHeader = String(req.headers["shopier-signature"] || req.headers["x-shopier-signature"] || "");
        const rawJson = typeof req.body === "object" ? JSON.stringify(req.body) : String(req.body || "");
        if (!webhookToken || !verifyShopierModernSignature(rawJson, sigHeader, webhookToken)) {
          return res.status(401).send("unauthorized");
        }
        payload = body;
      }

      if (Number(payload?.istest) === 1 && process.env.SHOPIER_ALLOW_TEST_ACTIVATION !== "true") {
        return res.status(200).send("success");
      }

      const rawStatus = String(payload?.status || payload?.paymentStatus || payload?.fulfillmentStatus?.status || "").toLowerCase();
      if (rawStatus && /cancel|refund|fail|iptal|iade/.test(rawStatus)) {
        return res.status(200).send("success");
      }

      const orderId = normalizeShopierOrderId(payload?.orderid || payload?.orderId || payload?.id || payload?.platform_order_id);
      if (!orderId) {
        return res.status(400).send("missing_order_id");
      }

      const existingOrder = await fsGetDoc(`${FS_ORG_PATH}/shopier_orders/${orderId}`).catch(() => null);
      if (existingOrder?.data?.status === "REDEEMED") {
        return res.status(200).send("success");
      }

      const buyerEmail = String(
        payload?.email || payload?.buyer?.email || payload?.shippingInfo?.email || payload?.billingInfo?.email || ""
      )
        .trim()
        .toLowerCase();
      const buyerPhone = normalizeTrPhone10(
        payload?.phone || payload?.buyerphone || payload?.gsm || payload?.tel || payload?.buyer?.phone || payload?.shippingInfo?.phone
      );
      const lineItems: any[] = Array.isArray(payload?.productlist)
        ? payload.productlist
        : Array.isArray(payload?.lineItems)
          ? payload.lineItems
          : [];
      const plan = resolveShopierPlanFromOrder({
        productId: payload?.productid || payload?.productId || lineItems[0]?.productId || lineItems[0]?.id,
        productIds: lineItems.map(li => li?.productId || li?.id).filter(Boolean),
        title: lineItems[0]?.title || payload?.productname || "",
        price: payload?.price || payload?.totals?.total || payload?.total_order_value,
      });

      const matchedUser = await findMksUserByContact(buyerEmail, buyerPhone);
      const nowIso = new Date().toISOString();
      const orderRecord: Record<string, any> = {
        orderId,
        tier: plan.tier,
        period: plan.period,
        days: plan.days,
        amount: Number(String(payload?.price || payload?.totals?.total || "0").replace(",", ".")) || 0,
        buyerEmail,
        buyerPhone,
        buyerName: `${String(payload?.buyername || payload?.buyer?.firstName || "").trim()} ${String(payload?.buyersurname || payload?.buyer?.lastName || "").trim()}`.trim(),
        createdAt: existingOrder?.data?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      if (matchedUser) {
        orderRecord.status = "REDEEMED";
        orderRecord.redeemedByUid = matchedUser.id;
        orderRecord.redeemedByEmail = String(matchedUser.data.email || buyerEmail).toLowerCase();
        orderRecord.redeemedAt = nowIso;
        orderRecord.claimedViaCode = false;

        const locked = await fsPatchDoc(
          `${FS_ORG_PATH}/shopier_orders/${orderId}`,
          orderRecord,
          existingOrder?.updateTime ? { updateTime: existingOrder.updateTime } : { exists: false }
        );
        if (locked.ok) {
          await grantSubscriptionToUser(matchedUser.id, plan, orderId, matchedUser.data);
        }
      } else {
        orderRecord.status = "PENDING_CLAIM";
        await fsPatchDoc(
          `${FS_ORG_PATH}/shopier_orders/${orderId}`,
          orderRecord,
          existingOrder?.updateTime ? { updateTime: existingOrder.updateTime } : { exists: false }
        );
      }

      return res.status(200).send("success");
    } catch (err) {
      console.error("Shopier webhook hatası:", err);
      return res.status(500).send("error");
    }
  });

  /**
   * 2. Farklı e-posta/telefonla satın alan kullanıcılar için Sipariş Kodu doğrulama ve tek seferlik aktivasyon.
   *    Aynı sipariş kodu başka bir hesapça kullanılmışsa Firestore updateTime kilidi ile 409 döner.
   */
  app.post("/api/shopier/claim-order", async (req: Request, res: Response) => {
    const authHeader = String(req.headers.authorization || "");
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const verifiedUser = bearerToken ? await deps.verifyFirebaseIdToken(bearerToken, false) : null;
    if (!verifiedUser) {
      return res.status(401).json({ ok: false, error: "Sipariş aktifleştirmek için MKS hesabınıza giriş yapın." });
    }

    const clientIp = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
    if (!deps.checkRateLimit(`shopier_claim_uid:${verifiedUser.uid}`, 8, 60_000) || !deps.checkRateLimit(`shopier_claim_ip:${clientIp}`, 12, 60_000)) {
      return res.status(429).json({ ok: false, error: "Çok fazla deneme yaptınız. Lütfen 1 dakika sonra tekrar deneyin." });
    }

    const orderId = normalizeShopierOrderId(req.body?.orderId);
    const contactRaw = String(req.body?.buyerContact || "").trim();
    const contactEmail = contactRaw.includes("@") ? contactRaw.toLowerCase() : "";
    const contactPhone = normalizeTrPhone10(contactRaw);

    if (!orderId) {
      return res.status(400).json({ ok: false, error: "Geçerli bir Shopier sipariş numarası girin (ör. 834912345)." });
    }
    if (!contactEmail && !contactPhone) {
      return res.status(400).json({ ok: false, error: "Shopier'de ödeme yaparken kullandığınız e-posta veya cep telefonunu yazın." });
    }

    try {
      const orderDoc = await fsGetDoc(`${FS_ORG_PATH}/shopier_orders/${orderId}`);
      if (!orderDoc) {
        return res.status(404).json({
          ok: false,
          error: "Bu sipariş numarasına ait doğrulanmış bir Shopier ödemesi bulunamadı. Ödemeyi yeni tamamladıysanız birkaç saniye bekleyip tekrar deneyin.",
        });
      }

      const ord = orderDoc.data;
      if (ord.status === "REDEEMED") {
        if (ord.redeemedByUid === verifiedUser.uid) {
          return res.status(409).json({
            ok: false,
            alreadyActive: true,
            error: "Bu Shopier sipariş numarası zaten sizin MKS hesabınızda aktif edilmiştir.",
          });
        }
        return res.status(409).json({
          ok: false,
          error: "Bu Shopier sipariş numarası daha önce başka bir hesapta kullanılmış ve kalıcı olarak kilitlenmiştir. Aynı kod ikinci kez kullanılamaz.",
        });
      }

      const orderEmail = String(ord.buyerEmail || "").trim().toLowerCase();
      const orderPhone = normalizeTrPhone10(ord.buyerPhone);
      const emailMatches = Boolean(contactEmail && orderEmail && contactEmail === orderEmail);
      const phoneMatches = Boolean(contactPhone && orderPhone && contactPhone === orderPhone);
      if (!emailMatches && !phoneMatches) {
        return res.status(403).json({
          ok: false,
          error: "Girdiğiniz e-posta veya telefon numarası bu Shopier siparişindeki alıcı bilgisiyle eşleşmiyor.",
        });
      }

      const plan: ShopierProductSpec = {
        tier: (String(ord.tier || "PRO").toUpperCase() as SubscriptionTierId) || "PRO",
        period: ord.period === "YEARLY" ? "YEARLY" : "MONTHLY",
        days: ord.period === "YEARLY" ? 366 : 31,
      };
      const nowIso = new Date().toISOString();

      // Firestore iyimser kilidi (currentDocument.updateTime): aynı anda iki farklı hesap istek atsa bile biri 409 alır!
      const lockRes = await fsPatchDoc(
        `${FS_ORG_PATH}/shopier_orders/${orderId}`,
        {
          status: "REDEEMED",
          redeemedByUid: verifiedUser.uid,
          redeemedByEmail: (verifiedUser.email || "").toLowerCase(),
          redeemedAt: nowIso,
          updatedAt: nowIso,
          claimedViaCode: true,
        },
        { updateTime: orderDoc.updateTime }
      );
      if (!lockRes.ok) {
        return res.status(409).json({
          ok: false,
          error: "Bu Shopier sipariş numarası az önce başka bir işlemle aktif edildi ve kilitlendi.",
        });
      }

      const granted = await grantSubscriptionToUser(verifiedUser.uid, plan, orderId);
      return res.json({
        ok: true,
        tier: granted.finalTier,
        period: plan.period,
        subscriptionEndsAt: granted.endsAtIso,
        orderId,
        message: `MKS ${granted.finalTier} (${plan.period === "YEARLY" ? "Yıllık" : "Aylık"}) aboneliğiniz başarıyla aktifleştirildi!`,
      });
    } catch (err) {
      console.error("Shopier sipariş doğrulama hatası:", err);
      return res.status(500).json({ ok: false, error: "Sipariş doğrulanırken sunucu hatası oluştu." });
    }
  });
}
