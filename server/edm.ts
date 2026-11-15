/**
 * EDM Bilişim e-Fatura / e-Arşiv web servis köprüsü (SOAP, EFaturaEDM.svc).
 * - Şifre hiçbir yerde saklanmaz ve kayda yazılmaz; her istekte Login -> işlem -> Logout yapılır.
 * - APPLICATION_NAME her istekte "MKS" gönderilir (EDM gelir payı bu alana göre hesaplanır; DEĞİŞTİRMEYİN).
 */
import type { Express, Request, Response } from "express";
import crypto from "crypto";

const EDM_URLS = {
  TEST: "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc",
  LIVE: "https://portal2.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc"
} as const;
type EdmEnv = keyof typeof EDM_URLS;
const APP_NAME = "MKS";

export interface EdmRouteDeps {
  isDev: boolean;
  isLoopbackAddress: (addr: string | undefined) => boolean;
  verifyFirebaseIdToken: (token: string, allowLocal: boolean) => Promise<{ uid: string } | null>;
  checkRateLimit: (bucketKey: string, maxRequests?: number, windowMs?: number) => boolean;
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
const unesc = (v: string) =>
  v.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const pick = (text: string, tag: string) =>
  unesc((text.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`)) || [])[1] || "");
const attr = (attrs: string, name: string) => unesc((attrs.match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1] || "");
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number) => r2(n).toFixed(2);

function requestHeader(sessionId: string, reason: string) {
  return (
    `<REQUEST_HEADER xmlns=""><SESSION_ID>${esc(sessionId)}</SESSION_ID><CLIENT_TXN_ID>${crypto.randomUUID()}</CLIENT_TXN_ID>` +
    `<ACTION_DATE>${new Date().toISOString()}</ACTION_DATE><REASON>${esc(reason)}</REASON><APPLICATION_NAME>${APP_NAME}</APPLICATION_NAME>` +
    `<HOSTNAME>${APP_NAME}</HOSTNAME><CHANNEL_NAME>${APP_NAME}</CHANNEL_NAME><COMPRESSED>N</COMPRESSED></REQUEST_HEADER>`
  );
}

async function soap(env: EdmEnv, action: string, inner: string, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(EDM_URLS[env], {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${action}"` },
      body:
        `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">` +
        `<${action} xmlns="http://tempuri.org/">${inner}</${action}></s:Body></s:Envelope>`,
      signal: controller.signal
    });
    return { ok: resp.ok, text: await resp.text() };
  } finally {
    clearTimeout(timer);
  }
}

class EdmError extends Error {
  constructor(message: string, public code = "") {
    super(message);
  }
}
const faultOf = (text: string, fallback: string) =>
  new EdmError(pick(text, "ERROR_LONG_DES") || pick(text, "ERROR_SHORT_DES") || pick(text, "faultstring") || fallback, pick(text, "ERROR_CODE"));

async function withSession<T>(env: EdmEnv, username: string, password: string, reason: string, fn: (sid: string) => Promise<T>): Promise<T> {
  const login = await soap(env, "LoginRequest", `${requestHeader("0", reason)}<USER_NAME xmlns="">${esc(username)}</USER_NAME><PASSWORD xmlns="">${esc(password)}</PASSWORD>`, 25_000);
  const sid = pick(login.text, "SESSION_ID");
  if (!login.ok || !sid) throw faultOf(login.text, "EDM girişi başarısız.");
  try {
    return await fn(sid);
  } finally {
    void soap(env, "LogoutRequest", requestHeader(sid, reason), 10_000).catch(() => {});
  }
}

// ---------------------------------------------------------------- UBL-TR 1.2
export interface EdmParty {
  taxNo: string;
  name: string;
  address?: string;
  district?: string;
  city?: string;
  taxOffice?: string;
  phone?: string;
  email?: string;
}
export interface EdmLine {
  name: string;
  quantity: number;
  unit?: string;
  unitPrice: number; // KDV hariç birim fiyat
  vatRate: number; // 0, 1, 10, 20
}
export interface EdmInvoiceInput {
  docType: "EFATURA" | "EARSIV";
  scenario?: "TEMELFATURA" | "TICARIFATURA";
  sender: EdmParty;
  receiver: EdmParty;
  receiverAlias?: string;
  lines: EdmLine[];
  note?: string;
  issueDate?: string; // YYYY-MM-DD
  invoiceType?: "SATIS" | "IADE";
  refInvoiceNo?: string; // IADE: iade edilen faturanın numarası
  refInvoiceDate?: string; // IADE: iade edilen faturanın tarihi (YYYY-MM-DD)
}

const UNIT_CODES: Record<string, string> = {
  adet: "C62", ad: "C62", kg: "KGM", kilogram: "KGM", gr: "GRM", g: "GRM", gram: "GRM", lt: "LTR", l: "LTR", litre: "LTR",
  ml: "MLT", ton: "TNE", paket: "PA", kutu: "BX", koli: "BX", m: "MTR", metre: "MTR" // çuval, şişe vb. GİB listesinde yok: adet (C62) gider
};
const unitCode = (u?: string) => UNIT_CODES[String(u || "").trim().toLocaleLowerCase("tr-TR")] || "C62";

function partyXml(p: EdmParty) {
  const taxNo = String(p.taxNo || "").replace(/\D/g, "");
  const isPerson = taxNo.length === 11;
  const name = (p.name || "").trim();
  const parts = name.split(/\s+/);
  const family = parts.length > 1 ? parts.pop()! : name;
  const first = parts.join(" ") || name;
  return (
    `<cac:Party><cac:PartyIdentification><cbc:ID schemeID="${isPerson ? "TCKN" : "VKN"}">${taxNo}</cbc:ID></cac:PartyIdentification>` +
    (isPerson ? "" : `<cac:PartyName><cbc:Name>${esc(name)}</cbc:Name></cac:PartyName>`) +
    `<cac:PostalAddress><cbc:StreetName>${esc(p.address || "")}</cbc:StreetName><cbc:CitySubdivisionName>${esc(p.district || "-")}</cbc:CitySubdivisionName>` +
    `<cbc:CityName>${esc(p.city || "-")}</cbc:CityName><cac:Country><cbc:IdentificationCode>TR</cbc:IdentificationCode><cbc:Name>Türkiye</cbc:Name></cac:Country></cac:PostalAddress>` +
    `<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>${esc(p.taxOffice || "")}</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>` +
    (p.phone || p.email
      ? `<cac:Contact>${p.phone ? `<cbc:Telephone>${esc(p.phone)}</cbc:Telephone>` : ""}${p.email ? `<cbc:ElectronicMail>${esc(p.email)}</cbc:ElectronicMail>` : ""}</cac:Contact>`
      : "") +
    (isPerson ? `<cac:Person><cbc:FirstName>${esc(first)}</cbc:FirstName><cbc:FamilyName>${esc(family)}</cbc:FamilyName></cac:Person>` : "") +
    `</cac:Party>`
  );
}

export function buildUblInvoice(inv: EdmInvoiceInput) {
  const uuid = crypto.randomUUID();
  const now = new Date();
  const trNow = new Date(now.getTime() + 3 * 3600_000).toISOString(); // Türkiye saati (UTC+3)
  const issueDate = /^\d{4}-\d{2}-\d{2}$/.test(inv.issueDate || "") ? inv.issueDate! : trNow.slice(0, 10);
  const issueTime = trNow.slice(11, 19);
  const isReturn = inv.invoiceType === "IADE";
  // İade faturası e-Fatura'da yalnızca TEMELFATURA senaryosuyla gönderilebilir
  const profile = inv.docType === "EARSIV" ? "EARSIVFATURA" : inv.scenario === "TICARIFATURA" && !isReturn ? "TICARIFATURA" : "TEMELFATURA";
  const billingRef = isReturn
    ? `<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${esc(String(inv.refInvoiceNo || "").trim())}</cbc:ID><cbc:IssueDate>${inv.refInvoiceDate}</cbc:IssueDate><cbc:DocumentTypeCode>IADE</cbc:DocumentTypeCode></cac:InvoiceDocumentReference></cac:BillingReference>`
    : "";

  const lines = inv.lines.map((l, i) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unitPrice) || 0;
    const rate = Number(l.vatRate) || 0;
    const net = r2(qty * price);
    const tax = r2((net * rate) / 100);
    return { no: i + 1, name: l.name, qty, price, rate, net, tax, unit: unitCode(l.unit) };
  });
  const byRate = new Map<number, { base: number; tax: number }>();
  for (const l of lines) {
    const g = byRate.get(l.rate) || { base: 0, tax: 0 };
    g.base = r2(g.base + l.net);
    g.tax = r2(g.tax + l.tax);
    byRate.set(l.rate, g);
  }
  const netTotal = r2(lines.reduce((s, l) => s + l.net, 0));
  const taxTotal = r2(lines.reduce((s, l) => s + l.tax, 0));
  const payable = r2(netTotal + taxTotal);
  const amt = (n: number) => `currencyID="TRY">${money(n)}`;
  const subtotal = (base: number, tax: number, rate: number) =>
    `<cac:TaxSubtotal><cbc:TaxableAmount ${amt(base)}</cbc:TaxableAmount><cbc:TaxAmount ${amt(tax)}</cbc:TaxAmount><cbc:CalculationSequenceNumeric>1</cbc:CalculationSequenceNumeric>` +
    `<cbc:Percent>${rate}</cbc:Percent><cac:TaxCategory>${rate === 0 ? `<cbc:TaxExemptionReasonCode>351</cbc:TaxExemptionReasonCode><cbc:TaxExemptionReason>KDV istisna olmayan diğer</cbc:TaxExemptionReason>` : ""}` +
    `<cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`;

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2 UBL-Invoice-2.1.xsd">` +
    `<cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>TR1.2</cbc:CustomizationID><cbc:ProfileID>${profile}</cbc:ProfileID><cbc:ID>ABC2009123456789</cbc:ID>` + // özel değer: numarayı EDM kendi serisinden atar
    `<cbc:CopyIndicator>false</cbc:CopyIndicator><cbc:UUID>${uuid}</cbc:UUID><cbc:IssueDate>${issueDate}</cbc:IssueDate><cbc:IssueTime>${issueTime}</cbc:IssueTime>` +
    `<cbc:InvoiceTypeCode>${isReturn ? "IADE" : "SATIS"}</cbc:InvoiceTypeCode>${inv.note ? `<cbc:Note>${esc(inv.note)}</cbc:Note>` : ""}` +
    `<cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode><cbc:LineCountNumeric>${lines.length}</cbc:LineCountNumeric>${billingRef}` +
    `<cac:AccountingSupplierParty>${partyXml(inv.sender)}</cac:AccountingSupplierParty>` +
    `<cac:AccountingCustomerParty>${partyXml(inv.receiver)}</cac:AccountingCustomerParty>` +
    `<cac:TaxTotal><cbc:TaxAmount ${amt(taxTotal)}</cbc:TaxAmount>${[...byRate.entries()].map(([rate, g]) => subtotal(g.base, g.tax, rate)).join("")}</cac:TaxTotal>` +
    `<cac:LegalMonetaryTotal><cbc:LineExtensionAmount ${amt(netTotal)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount ${amt(netTotal)}</cbc:TaxExclusiveAmount>` +
    `<cbc:TaxInclusiveAmount ${amt(payable)}</cbc:TaxInclusiveAmount><cbc:AllowanceTotalAmount ${amt(0)}</cbc:AllowanceTotalAmount><cbc:PayableAmount ${amt(payable)}</cbc:PayableAmount></cac:LegalMonetaryTotal>` +
    lines
      .map(
        l =>
          `<cac:InvoiceLine><cbc:ID>${l.no}</cbc:ID><cbc:InvoicedQuantity unitCode="${l.unit}">${l.qty}</cbc:InvoicedQuantity><cbc:LineExtensionAmount ${amt(l.net)}</cbc:LineExtensionAmount>` +
          `<cac:TaxTotal><cbc:TaxAmount ${amt(l.tax)}</cbc:TaxAmount>${subtotal(l.net, l.tax, l.rate)}</cac:TaxTotal>` +
          `<cac:Item><cbc:Name>${esc(l.name)}</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="TRY">${(Math.round(l.price * 1e6) / 1e6).toString()}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`
      )
      .join("") +
    `</Invoice>`;
  return { xml, uuid, payable, netTotal, taxTotal, issueDate, profile };
}

function validateInvoice(inv: any): string | null {
  if (!inv || (inv.docType !== "EFATURA" && inv.docType !== "EARSIV")) return "Belge türü e-Fatura veya e-Arşiv olmalıdır.";
  const sTax = String(inv.sender?.taxNo || "").replace(/\D/g, "");
  const rTax = String(inv.receiver?.taxNo || "").replace(/\D/g, "");
  if (sTax.length !== 10 && sTax.length !== 11) return "Ayarlar'da bayi VKN/TCKN (10 veya 11 hane) girilmelidir.";
  if (!String(inv.sender?.name || "").trim()) return "Ayarlar'da firma ünvanı girilmelidir.";
  if (rTax.length !== 10 && rTax.length !== 11) return "Alıcı VKN (10 hane) veya TCKN (11 hane) girilmelidir.";
  if (!String(inv.receiver?.name || "").trim()) return "Alıcı adı / ünvanı girilmelidir.";
  if (inv.invoiceType === "IADE") {
    if (!/^[A-Za-z0-9]{3,16}$/.test(String(inv.refInvoiceNo || "").trim())) return "İade edilen faturanın numarası gerekli.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(inv.refInvoiceDate || ""))) return "İade edilen faturanın tarihi gerekli.";
  }
  if (!Array.isArray(inv.lines) || inv.lines.length === 0 || inv.lines.length > 200) return "En az bir fatura satırı gereklidir.";
  for (const l of inv.lines) {
    if (!String(l?.name || "").trim()) return "Her satırda ürün adı olmalıdır.";
    if (!(Number(l.quantity) > 0)) return `"${l.name}" için miktar sıfırdan büyük olmalıdır.`;
    if (!(Number(l.unitPrice) >= 0)) return `"${l.name}" için birim fiyat geçersiz.`;
    if (![0, 1, 8, 10, 18, 20].includes(Number(l.vatRate))) return `"${l.name}" için KDV oranı geçersiz.`;
  }
  return null;
}

function parseInvoices(text: string) {
  return [...text.matchAll(/<INVOICE\b([^>]*)>([\s\S]*?)<\/INVOICE>/g)].map(m => ({
    id: attr(m[1], "ID"),
    uuid: attr(m[1], "UUID"),
    sender: pick(m[2], "SENDER"),
    receiver: pick(m[2], "RECEIVER"),
    supplier: pick(m[2], "SUPPLIER"),
    customer: pick(m[2], "CUSTOMER"),
    issueDate: pick(m[2], "ISSUE_DATE"),
    payableAmount: Number(pick(m[2], "PAYABLE_AMOUNT")) || 0,
    profile: pick(m[2], "PROFILEID"),
    status: pick(m[2], "STATUS"),
    statusDescription: pick(m[2], "STATUS_DESCRIPTION"),
    gibStatusCode: pick(m[2], "GIB_STATUS_CODE"),
    gibStatusDescription: pick(m[2], "GIB_STATUS_DESCRIPTION"),
    responseCode: pick(m[2], "RESPONSE_CODE"),
    createdAt: pick(m[2], "CDATE")
  }));
}

const UNIT_NAMES: Record<string, string> = { C62: "Adet", KGM: "Kg", GRM: "Gr", LTR: "Lt", MLT: "Ml", TNE: "Ton", PA: "Paket", BX: "Kutu", MTR: "Metre" };
/** İmzalı UBL'den alıcı/satıcı ve satırları çıkarır (iade faturası hazırlamak için). */
function parseUbl(xml: string) {
  const tag = (s: string, n: string) => (s.match(new RegExp(`<(?:\\w+:)?${n}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${n}>`)) || [])[1] || "";
  const un = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
  const party = (block: string) => {
    const p = tag(block, "Party");
    const person = tag(p, "Person");
    return {
      taxNo: (p.match(/schemeID="(?:VKN|TCKN)"[^>]*>\s*(\d+)/) || [])[1] || "",
      name: un(tag(tag(p, "PartyName"), "Name")) || [un(tag(person, "FirstName")), un(tag(person, "FamilyName"))].filter(Boolean).join(" "),
      district: un(tag(p, "CitySubdivisionName")).replace(/^-$/, ""),
      city: un(tag(p, "CityName")).replace(/^-$/, "")
    };
  };
  const lines = [...xml.matchAll(/<(?:\w+:)?InvoiceLine>([\s\S]*?)<\/(?:\w+:)?InvoiceLine>/g)].map(m => {
    const q = m[1].match(/InvoicedQuantity[^>]*unitCode="([^"]*)"[^>]*>([^<]+)</) || [];
    return {
      name: un(tag(tag(m[1], "Item"), "Name")),
      quantity: Number(q[2]) || 0,
      unit: UNIT_NAMES[q[1] || ""] || "Adet",
      unitPrice: Number(tag(tag(m[1], "Price"), "PriceAmount")) || 0,
      vatRate: Number(tag(m[1], "Percent")) || 0
    };
  });
  return {
    invoiceNo: un((xml.match(/ProfileID>\s*<(?:\w+:)?ID>([^<]+)</) || [])[1] || ""),
    issueDate: un(tag(xml, "IssueDate")).slice(0, 10),
    typeCode: un(tag(xml, "InvoiceTypeCode")),
    supplier: party(tag(xml, "AccountingSupplierParty")),
    customer: party(tag(xml, "AccountingCustomerParty")),
    lines
  };
}

// ---------------------------------------------------------------- Routes
export function registerEdmRoutes(app: Express, deps: EdmRouteDeps) {
  /** Kimlik + hız sınırı + ortak gövde alanları. Hata varsa yanıtı yazar ve null döner. */
  const guard = async (req: Request, res: Response, bucket: string, perMinute: number) => {
    const remoteIp = req.socket.remoteAddress;
    const forwardedIp = process.env.K_SERVICE ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "";
    const isLocalLoopback = deps.isDev && deps.isLoopbackAddress(remoteIp) && !forwardedIp;
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const user = token ? await deps.verifyFirebaseIdToken(token, isLocalLoopback) : null;
    if (!user && !isLocalLoopback) {
      res.status(401).json({ ok: false, error: "Oturum doğrulanamadı. Lütfen tekrar giriş yapın." });
      return null;
    }
    const key = user ? `${bucket}:${user.uid}` : `${bucket}_ip:${forwardedIp || remoteIp || "unknown"}`;
    if (!deps.checkRateLimit(key, perMinute, 60_000)) {
      res.status(429).json({ ok: false, error: "Çok fazla istek gönderildi, bir dakika bekleyin." });
      return null;
    }
    const provider = String(req.body?.provider || "EDM").trim().toUpperCase();
    if (provider !== "EDM") {
      res.status(400).json({
        ok: false,
        error: `${provider} web servis bağlantısı iş ortaklığı / test hesabı onayı aşamasındadır. Şu an doğrudan API kesimi yalnızca EDM Bilişim üzerinden aktiftir.`,
        code: "PROVIDER_NOT_ACTIVE"
      });
      return null;
    }
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password || username.length > 120 || password.length > 200) {
      res.status(400).json({ ok: false, error: "EDM kullanıcı adı ve şifresi gereklidir (Ayarlar sekmesi)." });
      return null;
    }
    const env: EdmEnv = req.body?.environment === "LIVE" ? "LIVE" : "TEST";
    return { username, password, env };
  };
  const fail = (res: Response, err: any) => {
    if (err instanceof EdmError) return res.json({ ok: false, error: err.message, errorCode: err.code });
    return res.status(502).json({
      ok: false,
      error: err?.name === "AbortError" ? "EDM sunucusu zamanında yanıt vermedi." : "EDM sunucusuna ulaşılamadı."
    });
  };

  app.post("/api/edm/test-connection", async (req, res) => {
    const g = await guard(req, res, "edm", 6);
    if (!g) return;
    try {
      await withSession(g.env, g.username, g.password, "MKS baglanti testi", async () => true);
      res.json({ ok: true, environment: g.env, message: g.env === "LIVE" ? "EDM canlı ortamına giriş başarılı." : "EDM test ortamına giriş başarılı." });
    } catch (err) {
      fail(res, err);
    }
  });

  app.post("/api/edm/check-user", async (req, res) => {
    const g = await guard(req, res, "edmcu", 20);
    if (!g) return;
    const identifier = String(req.body?.identifier || "").replace(/\D/g, "");
    if (identifier.length !== 10 && identifier.length !== 11) {
      return res.status(400).json({ ok: false, error: "10 haneli VKN veya 11 haneli TCKN girin." });
    }
    try {
      const text = await withSession(g.env, g.username, g.password, "MKS mukellef sorgusu", async sid => {
        const r = await soap(g.env, "CheckUserRequest", `${requestHeader(sid, "MKS mukellef sorgusu")}<USER xmlns=""><IDENTIFIER>${identifier}</IDENTIFIER></USER>`);
        if (!r.ok) throw faultOf(r.text, "Mükellef sorgusu başarısız.");
        return r.text;
      });
      const users = [...text.matchAll(/<USER[^>]*>([\s\S]*?)<\/USER>/g)].map(m => ({ alias: pick(m[1], "ALIAS"), title: pick(m[1], "TITLE"), unit: pick(m[1], "UNIT") }));
      const inbox = users.filter(u => u.unit === "PK" && u.alias);
      res.json({ ok: true, environment: g.env, isEInvoiceUser: inbox.length > 0, title: (inbox[0] || users[0])?.title || "", aliases: inbox.map(u => u.alias).slice(0, 10) });
    } catch (err) {
      fail(res, err);
    }
  });

  // Gerçek fatura gönderimi: UBL-TR üretir, EDM üzerinden GİB'e iletir. EDM belgeyi mali mühürle imzalar ve numarayı atar.
  app.post("/api/edm/send-invoice", async (req, res) => {
    const g = await guard(req, res, "edmsend", 12);
    if (!g) return;
    const inv = req.body?.invoice as EdmInvoiceInput;
    const invalid = validateInvoice(inv);
    if (invalid) return res.status(400).json({ ok: false, error: invalid });
    try {
      const ubl = buildUblInvoice(inv);
      const isArchive = inv.docType === "EARSIV";
      const senderVkn = String(inv.sender.taxNo).replace(/\D/g, "");
      const receiverVkn = String(inv.receiver.taxNo).replace(/\D/g, "");
      const text = await withSession(g.env, g.username, g.password, "MKS fatura gonderimi", async sid => {
        const r = await soap(
          g.env,
          "SendInvoiceRequest",
          `${requestHeader(sid, "MKS fatura gonderimi")}<SENDER xmlns="" vkn="${senderVkn}" alias=""/>` +
            `<RECEIVER xmlns="" vkn="${receiverVkn}" alias="${isArchive ? "" : esc(inv.receiverAlias || "")}"/>` +
            `<INVOICE xmlns="" TRXID="0"><HEADER><INTERNETSALES>false</INTERNETSALES><EARCHIVE>${isArchive}</EARCHIVE></HEADER>` +
            `<CONTENT>${Buffer.from(ubl.xml, "utf8").toString("base64")}</CONTENT></INVOICE>`,
          90_000
        );
        if (!r.ok) throw faultOf(r.text, "Fatura gönderilemedi.");
        return r.text;
      });
      const sent = parseInvoices(text)[0];
      res.json({
        ok: true,
        environment: g.env,
        invoiceNo: sent?.id || "",
        uuid: sent?.uuid || ubl.uuid,
        status: sent?.status || "",
        statusDescription: sent?.statusDescription || "",
        payableAmount: ubl.payable,
        netTotal: ubl.netTotal,
        taxTotal: ubl.taxTotal,
        issueDate: ubl.issueDate,
        profile: ubl.profile
      });
    } catch (err) {
      fail(res, err);
    }
  });

  // Gelen (IN) / giden (OUT) fatura listesi — yalnızca başlık bilgileri
  app.post("/api/edm/invoices", async (req, res) => {
    const g = await guard(req, res, "edmlist", 15);
    if (!g) return;
    const direction = req.body?.direction === "OUT" ? "OUT" : "IN";
    const isDate = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const end = isDate(req.body?.endDate) ? req.body.endDate : new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const start = isDate(req.body?.startDate) ? req.body.startDate : new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    try {
      const text = await withSession(g.env, g.username, g.password, "MKS fatura listesi", async sid => {
        const r = await soap(
          g.env,
          "GetInvoiceRequest",
          `${requestHeader(sid, "MKS fatura listesi")}<INVOICE_SEARCH_KEY xmlns=""><LIMIT>100</LIMIT><START_DATE>${start}</START_DATE><END_DATE>${end}</END_DATE>` +
            `<READ_INCLUDED>true</READ_INCLUDED><DIRECTION>${direction}</DIRECTION></INVOICE_SEARCH_KEY><HEADER_ONLY xmlns="">Y</HEADER_ONLY>`,
          90_000
        );
        if (!r.ok) throw faultOf(r.text, "Fatura listesi alınamadı.");
        return r.text;
      });
      res.json({ ok: true, environment: g.env, direction, startDate: start, endDate: end, invoices: parseInvoices(text) });
    } catch (err) {
      fail(res, err);
    }
  });

  // e-Arşiv fatura iptali (e-Fatura iptal edilemez; iade faturası veya ticari faturada red gerekir)
  app.post("/api/edm/cancel-invoice", async (req, res) => {
    const g = await guard(req, res, "edmcancel", 10);
    if (!g) return;
    const uuid = String(req.body?.uuid || "").trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(uuid)) return res.status(400).json({ ok: false, error: "Geçersiz fatura kimliği." });
    try {
      await withSession(g.env, g.username, g.password, "MKS fatura iptali", async sid => {
        const r = await soap(g.env, "CancelInvoiceRequest", `${requestHeader(sid, "MKS fatura iptali")}<INVOICE TRXID="0" UUID="${uuid}" xmlns=""/>`, 90_000);
        if (!r.ok) throw faultOf(r.text, "Fatura iptal edilemedi.");
        return r.text;
      });
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  // Gelen TİCARİ faturaya yanıt: KABUL / RED (EDM mali mühürle imzalar)
  app.post("/api/edm/respond-invoice", async (req, res) => {
    const g = await guard(req, res, "edmresp", 10);
    if (!g) return;
    const invoiceId = String(req.body?.invoiceId || "").trim();
    if (!/^[A-Za-z0-9]{16}$/.test(invoiceId)) return res.status(400).json({ ok: false, error: "Geçersiz fatura numarası." });
    const status = req.body?.accept === true ? "KABUL" : "RED";
    try {
      await withSession(g.env, g.username, g.password, "MKS fatura yaniti", async sid => {
        const r = await soap(
          g.env,
          "SendInvoiceResponseWithServerSignRequest",
          `${requestHeader(sid, "MKS fatura yaniti")}<STATUS xmlns="">${status}</STATUS><INVOICE TRXID="0" ID="${invoiceId}" xmlns=""/>`,
          90_000
        );
        if (!r.ok) throw faultOf(r.text, "Yanıt gönderilemedi.");
        return r.text;
      });
      res.json({ ok: true, status });
    } catch (err) {
      fail(res, err);
    }
  });

  // Tek faturanın içeriği (alıcı + satırlar) — iade faturası hazırlamak için
  app.post("/api/edm/invoice-detail", async (req, res) => {
    const g = await guard(req, res, "edmdet", 20);
    if (!g) return;
    const uuid = String(req.body?.uuid || "").trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(uuid)) return res.status(400).json({ ok: false, error: "Geçersiz fatura kimliği." });
    const direction = req.body?.direction === "OUT" ? "OUT" : "IN";
    try {
      const text = await withSession(g.env, g.username, g.password, "MKS fatura icerigi", async sid => {
        const r = await soap(
          g.env,
          "GetInvoiceRequest",
          `${requestHeader(sid, "MKS fatura icerigi")}<INVOICE_SEARCH_KEY xmlns=""><UUID>${uuid}</UUID><READ_INCLUDED>true</READ_INCLUDED><DIRECTION>${direction}</DIRECTION></INVOICE_SEARCH_KEY>` +
            `<HEADER_ONLY xmlns="">N</HEADER_ONLY><INVOICE_CONTENT_TYPE xmlns="">XML</INVOICE_CONTENT_TYPE>`,
          90_000
        );
        if (!r.ok) throw faultOf(r.text, "Fatura getirilemedi.");
        return r.text;
      });
      const b64 = (text.match(/<CONTENT[^>]*>([^<]+)<\/CONTENT>/) || [])[1] || "";
      const xml = b64 ? Buffer.from(b64, "base64").toString("utf8") : "";
      if (!xml.includes("Invoice")) return res.json({ ok: false, error: "Fatura içeriği okunamadı." });
      const d = parseUbl(xml);
      res.json({ ok: true, ...d, invoiceNo: d.invoiceNo || parseInvoices(text)[0]?.id || "" });
    } catch (err) {
      fail(res, err);
    }
  });

  // Tek faturanın görüntüsü (HTML) — gelen ya da giden
  app.post("/api/edm/invoice-html", async (req, res) => {
    const g = await guard(req, res, "edmhtml", 20);
    if (!g) return;
    const uuid = String(req.body?.uuid || "").trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(uuid)) return res.status(400).json({ ok: false, error: "Geçersiz fatura kimliği." });
    const direction = req.body?.direction === "OUT" ? "OUT" : "IN";
    try {
      const text = await withSession(g.env, g.username, g.password, "MKS fatura goruntuleme", async sid => {
        const r = await soap(
          g.env,
          "GetInvoiceRequest",
          `${requestHeader(sid, "MKS fatura goruntuleme")}<INVOICE_SEARCH_KEY xmlns=""><UUID>${uuid}</UUID><READ_INCLUDED>true</READ_INCLUDED><DIRECTION>${direction}</DIRECTION></INVOICE_SEARCH_KEY>` +
            `<HEADER_ONLY xmlns="">N</HEADER_ONLY><INVOICE_CONTENT_TYPE xmlns="">HTML</INVOICE_CONTENT_TYPE>`,
          90_000
        );
        if (!r.ok) throw faultOf(r.text, "Fatura getirilemedi.");
        return r.text;
      });
      const b64 = (text.match(/<CONTENT[^>]*>([^<]+)<\/CONTENT>/) || [])[1] || "";
      if (!b64) return res.json({ ok: false, error: "Fatura içeriği bulunamadı." });
      res.json({ ok: true, html: Buffer.from(b64, "base64").toString("utf8") });
    } catch (err) {
      fail(res, err);
    }
  });
}
