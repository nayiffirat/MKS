/**
 * Çoklu e-Fatura / e-Arşiv Özel Entegratör Adaptörleri (Veriban · Park Entegrasyon · Mysoft).
 * Her adaptör EDM ile aynı kurumsal uç nokta sözleşmesini (test-connection, check-user,
 * send-invoice, invoices, invoice-detail, invoice-html, cancel-invoice, respond-invoice) uygular.
 */
import crypto from "crypto";
import { createSingleFileZip, extractZipEntryText } from "./zip";

export type ProviderEnv = "LIVE" | "TEST";
export type MultiProviderId = "VERIBAN" | "PARK_ENTEGRASYON" | "MYSOFT";

export interface ProviderAuth {
  provider: MultiProviderId;
  env: ProviderEnv;
  username: string;
  password: string;
}

export interface RemoteInvoiceSummary {
  id: string;
  externalId?: string;
  uuid: string;
  sender?: string;
  receiver?: string;
  supplier: string;
  customer: string;
  issueDate: string;
  payableAmount: number;
  profile: string;
  status: string;
  statusDescription?: string;
  gibStatusCode?: string;
  gibStatusDescription?: string;
  responseCode: string;
  createdAt?: string;
}

export interface BuiltUblInvoice {
  xml: string;
  uuid: string;
  payable: number;
  netTotal: number;
  taxTotal: number;
  issueDate: string;
  profile: string;
  docType: "EFATURA" | "EARSIV";
  receiverAlias?: string;
  senderTaxNo: string;
  prefix?: string;
}

export class IntegratorError extends Error {
  constructor(message: string, public code = "") {
    super(message);
  }
}

const escXml = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const unescXml = (v: string) =>
  v.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const pickXml = (text: string, tag: string) =>
  unescXml((text.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:\\w+:)?${tag}>`, "i")) || [])[1] || "").trim();

function parseTrMoney(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(norm);
  return Number.isFinite(n) ? n : 0;
}

const UNIT_NAMES: Record<string, string> = {
  C62: "Adet",
  KGM: "Kg",
  GRM: "Gr",
  LTR: "Lt",
  MLT: "Ml",
  TNE: "Ton",
  PA: "Paket",
  BX: "Kutu",
  MTR: "Metre",
};

/** İmzalı UBL-TR XML belgesinden fatura başlığı, alıcı/satıcı ve satırları ayıklar. */
export function parseUblDocument(xml: string) {
  const tag = (s: string, n: string) =>
    (s.match(new RegExp(`<(?:\\w+:)?${n}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${n}>`)) || [])[1] || "";
  const un = (s: string) => unescXml(s.replace(/<[^>]+>/g, "")).trim();
  const party = (block: string) => {
    const p = tag(block, "Party");
    const person = tag(p, "Person");
    return {
      taxNo: (p.match(/schemeID="(?:VKN|TCKN)"[^>]*>\s*(\d+)/) || [])[1] || "",
      name: un(tag(tag(p, "PartyName"), "Name")) || [un(tag(person, "FirstName")), un(tag(person, "FamilyName"))].filter(Boolean).join(" "),
      district: un(tag(p, "CitySubdivisionName")).replace(/^-$/, ""),
      city: un(tag(p, "CityName")).replace(/^-$/, ""),
    };
  };
  const lines = [...xml.matchAll(/<(?:\w+:)?InvoiceLine>([\s\S]*?)<\/(?:\w+:)?InvoiceLine>/g)].map(m => {
    const q = m[1].match(/InvoicedQuantity[^>]*unitCode="([^"]*)"[^>]*>([^<]+)</) || [];
    return {
      name: un(tag(tag(m[1], "Item"), "Name")),
      quantity: Number(q[2]) || 0,
      unit: UNIT_NAMES[q[1] || ""] || "Adet",
      unitPrice: Number(tag(tag(m[1], "Price"), "PriceAmount")) || 0,
      vatRate: Number(tag(m[1], "Percent")) || 0,
    };
  });
  return {
    invoiceNo: un((xml.match(/ProfileID>\s*<(?:\w+:)?ID>([^<]+)</) || [])[1] || tag(xml, "ID")),
    uuid: un(tag(xml, "UUID")),
    profile: un(tag(xml, "ProfileID")),
    issueDate: un(tag(xml, "IssueDate")).slice(0, 10),
    typeCode: un(tag(xml, "InvoiceTypeCode")),
    payableAmount: Number(tag(tag(xml, "LegalMonetaryTotal"), "PayableAmount")) || 0,
    supplier: party(tag(xml, "AccountingSupplierParty")),
    customer: party(tag(xml, "AccountingCustomerParty")),
    lines,
  };
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

function decodeMaybeZipBase64(b64: string, preferExt?: ".xml" | ".html"): string {
  const buf = Buffer.from(b64, "base64");
  if (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) {
    return extractZipEntryText(buf, preferExt)?.text || "";
  }
  return buf.toString("utf8");
}

// ---------------------------------------------------------------------------
// VERİBAN A.Ş. SOAP ADAPTER (efaturatransfer* + earsivtransfer*)
// ---------------------------------------------------------------------------
const VERIBAN_URLS = {
  EFATURA: {
    TEST: "https://efaturatransfertest.veriban.com.tr/IntegrationService.svc",
    LIVE: "https://efaturatransfer.veriban.com.tr/IntegrationService.svc",
  },
  EARSIV: {
    TEST: "https://earsivtransfertest.veriban.com.tr/IntegrationService.svc",
    LIVE: "https://earsivtransfer.veriban.com.tr/IntegrationService.svc",
  },
} as const;

async function veribanSoap(url: string, action: string, innerBody: string, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${action}"`,
      },
      body:
        `<?xml version="1.0" encoding="utf-8"?>` +
        `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">` +
        `<s:Body>${innerBody}</s:Body></s:Envelope>`,
      signal: controller.signal,
    });
    return { ok: resp.ok, text: await resp.text() };
  } finally {
    clearTimeout(timer);
  }
}

function veribanFault(text: string, fallback: string): IntegratorError {
  const desc = pickXml(text, "FaultDescription") || pickXml(text, "Description") || pickXml(text, "faultstring");
  const code = pickXml(text, "FaultCode") || pickXml(text, "faultcode");
  return new IntegratorError(desc || fallback, code);
}

async function withVeribanSession<T>(
  service: "EFATURA" | "EARSIV",
  auth: ProviderAuth,
  fn: (sid: string, url: string) => Promise<T>
): Promise<T> {
  const url = VERIBAN_URLS[service][auth.env];
  const lr = await veribanSoap(
    url,
    "Login",
    `<Login xmlns="http://tempuri.org/"><userName>${escXml(auth.username)}</userName><password>${escXml(auth.password)}</password></Login>`,
    25_000
  );
  const sid = pickXml(lr.text, "LoginResult");
  if (!lr.ok || !sid) throw veribanFault(lr.text, "Veriban girişi başarısız (kullanıcı adı veya şifreyi kontrol edin).");
  try {
    return await fn(sid, url);
  } finally {
    void veribanSoap(url, "Logout", `<Logout xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode></Logout>`, 10_000).catch(() => {});
  }
}

function normalizeVeribanStatus(stateCode: string, stateName: string, answerName = ""): string {
  const joined = `${stateName} ${answerName}`.toLocaleLowerCase("tr-TR");
  if (/iptal/.test(joined) || stateCode === "6") return "CANCELLED";
  if (/kabul/.test(joined)) return "ACCEPTED";
  if (/red|hata|başarısız|basarisiz/.test(joined) || stateCode === "4") return "FAILED";
  if (/iletildi|tamam|başarı|basari/.test(joined) || stateCode === "5") return "SUCCEEDED";
  return stateName || "PROCESSING";
}

// ---------------------------------------------------------------------------
// PARK ENTEGRASYON REST ADAPTER (apitest / api.parkentegrasyon.com.tr)
// ---------------------------------------------------------------------------
const PARK_BASE = {
  TEST: "https://apitest.parkentegrasyon.com.tr",
  LIVE: "https://api.parkentegrasyon.com.tr",
} as const;

async function parkToken(auth: ProviderAuth): Promise<{ base: string; token: string }> {
  const base = PARK_BASE[auth.env];
  const resp = await fetch(`${base}/v1/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: auth.username, password: auth.password }),
    signal: AbortSignal.timeout(25_000),
  });
  const json = (await resp.json().catch(() => null)) as any;
  const token = json?.data?.accessToken;
  if (!resp.ok || !token) {
    throw new IntegratorError(json?.error?.message || "Park Entegrasyon girişi başarısız.", String(json?.error?.code || resp.status));
  }
  return { base, token };
}

async function parkJson(base: string, token: string, path: string, init: RequestInit = {}) {
  const resp = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(45_000),
  });
  const text = await resp.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { ok: resp.ok, status: resp.status, json, text };
}

async function resolveParkRecordId(base: string, token: string, uuid: string, direction: "IN" | "OUT"): Promise<{ id: string; isEArchive: boolean } | null> {
  if (direction === "OUT") {
    const outInv = await parkJson(base, token, `/v1/einvoices/outbox?uuid=${encodeURIComponent(uuid)}&size=1`);
    const item = outInv.json?.data?.contents?.[0];
    if (item?.id) return { id: String(item.id), isEArchive: false };
    const outArch = await parkJson(base, token, `/v1/earchives?uuid=${encodeURIComponent(uuid)}&size=1`);
    const archItem = outArch.json?.data?.contents?.[0];
    if (archItem?.id) return { id: String(archItem.id), isEArchive: true };
  } else {
    const inInv = await parkJson(base, token, `/v1/einvoices/inbox?uuid=${encodeURIComponent(uuid)}&size=1`);
    const item = inInv.json?.data?.contents?.[0];
    if (item?.id) return { id: String(item.id), isEArchive: false };
  }
  return null;
}

// ---------------------------------------------------------------------------
// MYSOFT REST API ADAPTER (edocumentapi.mytest.tr / mysoft.com.tr)
// ---------------------------------------------------------------------------
const MYSOFT_BASE = {
  TEST: "https://edocumentapi.mytest.tr",
  LIVE: "https://edocumentapi.mysoft.com.tr",
} as const;

async function mysoftToken(auth: ProviderAuth): Promise<{ base: string; token: string }> {
  const base = MYSOFT_BASE[auth.env];
  const form = new URLSearchParams({
    client_id: auth.username,
    client_secret: auth.password,
    grant_type: "client_credentials",
  });
  const resp = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    signal: AbortSignal.timeout(25_000),
  });
  const json = (await resp.json().catch(() => null)) as any;
  const token = json?.access_token;
  if (!resp.ok || !token) {
    throw new IntegratorError(
      json?.error_description || json?.error || "Mysoft OAuth2 bağlantısı başarısız (Client ID ve Client Secret bilgisini kontrol edin).",
      String(resp.status)
    );
  }
  return { base, token };
}

async function mysoftReq(base: string, token: string, path: string, method: "GET" | "POST", body?: unknown) {
  const resp = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(45_000),
  });
  const text = await resp.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { ok: resp.ok, status: resp.status, json, text };
}

// ---------------------------------------------------------------------------
// UNIFIED PROVIDER DISPATCH
// ---------------------------------------------------------------------------
export const MULTI_ACTIVE_PROVIDERS = new Set<string>(["EDM", "VERIBAN", "PARK_ENTEGRASYON", "MYSOFT"]);

export async function adapterTestConnection(auth: ProviderAuth) {
  if (auth.provider === "VERIBAN") {
    return withVeribanSession("EFATURA", auth, async (sid, url) => {
      const credit = await veribanSoap(
        url,
        "GetCreditCount",
        `<GetCreditCount xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode></GetCreditCount>`,
        15_000
      );
      const count = pickXml(credit.text, "GetCreditCountResult");
      const envTr = auth.env === "LIVE" ? "canlı" : "test";
      return {
        ok: true,
        environment: auth.env,
        message: `Veriban ${envTr} ortamına giriş başarılı.${count ? ` (Kalan kontör: ${count})` : ""}`,
      };
    });
  }

  if (auth.provider === "PARK_ENTEGRASYON") {
    await parkToken(auth);
    return {
      ok: true,
      environment: auth.env,
      message: auth.env === "LIVE" ? "Park Entegrasyon canlı ortamına giriş başarılı." : "Park Entegrasyon test ortamına giriş başarılı.",
    };
  }

  const { base, token } = await mysoftToken(auth);
  let companyHint = "";
  let creditHint = "";
  try {
    const [co, cr] = await Promise.all([
      mysoftReq(base, token, "/api/GeneralCard/getUserCompanyInfo", "GET").catch(() => null),
      mysoftReq(base, token, "/api/Tenant/getCreditInfo", "POST", {}).catch(() => null),
    ]);
    const firstCo = Array.isArray(co?.json?.data) ? co.json.data[0] : null;
    if (firstCo?.name) {
      companyHint = ` (${String(firstCo.name)}${firstCo.identifierNumber ? ` · ${firstCo.identifierNumber}` : ""})`;
    }
    const rem = cr?.json?.data?.remainingCredit ?? cr?.json?.data?.credit ?? firstCo?.eDocumentRemainingCredit;
    if (rem !== undefined && rem !== null) creditHint = ` (Kalan kontör: ${rem})`;
  } catch {
    /* optional metadata */
  }
  return {
    ok: true,
    environment: auth.env,
    message: `${auth.env === "LIVE" ? "Mysoft canlı" : "Mysoft test"} ortamına OAuth2 bağlantısı başarılı${companyHint}.${creditHint}`,
  };
}

export async function adapterCheckUser(auth: ProviderAuth, identifier: string) {
  if (auth.provider === "VERIBAN") {
    return withVeribanSession("EFATURA", auth, async (sid, url) => {
      const r = await veribanSoap(
        url,
        "GetCustomerAliasListWithRegisterNumber",
        `<GetCustomerAliasListWithRegisterNumber xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode><customerRegisterNumber>${escXml(identifier)}</customerRegisterNumber></GetCustomerAliasListWithRegisterNumber>`
      );
      if (!r.ok && !r.text.includes("GetCustomerAliasListWithRegisterNumberResponse")) {
        throw veribanFault(r.text, "Veriban mükellef sorgusu başarısız.");
      }
      const items = [...r.text.matchAll(/<CustomerData\b[^>]*>([\s\S]*?)<\/CustomerData>/g)].map(m => ({
        alias: pickXml(m[1], "Alias"),
        title: pickXml(m[1], "Title"),
        type: pickXml(m[1], "Type"),
        docType: pickXml(m[1], "DocumentType"),
      }));
      const pk = items.filter(x => x.alias && (!x.docType || /INVOICE|FATURA/i.test(x.docType)));
      return {
        ok: true,
        environment: auth.env,
        isEInvoiceUser: pk.length > 0,
        title: (pk[0] || items[0])?.title || "",
        aliases: pk.map(x => x.alias).slice(0, 10),
      };
    });
  }

  if (auth.provider === "PARK_ENTEGRASYON") {
    const { base, token } = await parkToken(auth);
    const res = await parkJson(base, token, `/v1/resources/gib-users?identifier=${encodeURIComponent(identifier)}`);
    if (!res.ok) throw new IntegratorError(res.json?.error?.message || "Park Entegrasyon mükellef sorgusu başarısız.");
    const list: any[] = Array.isArray(res.json?.data) ? res.json.data : [];
    const exact = list.filter(x => String(x.identifier || "").trim() === identifier && x.active !== false && x.unit === "PK" && (!x.documentType || x.documentType === "INVOICE"));
    return {
      ok: true,
      environment: auth.env,
      isEInvoiceUser: exact.length > 0,
      title: exact[0]?.title || "",
      aliases: exact.map(x => String(x.alias)).filter(Boolean).slice(0, 10),
    };
  }

  const { base, token } = await mysoftToken(auth);
  const gibRes = await mysoftReq(
    base,
    token,
    `/api/GeneralCard/getGibAccountModel?vknTckn=${encodeURIComponent(identifier)}`,
    "GET"
  ).catch(() => null);
  const gibData = gibRes?.json?.data;
  const gibAliasesRaw: any[] = Array.isArray(gibData?.gibAccountAliasList) ? gibData.gibAccountAliasList : [];
  const activePkAliases = gibAliasesRaw
    .filter(
      a =>
        a &&
        !a.aliasDeleteDate &&
        (a.aliasType === 1 || a.aliasType === undefined || a.aliasType === null) &&
        (a.gibDocumentType === 1 || a.gibDocumentType === undefined || a.gibDocumentType === null)
    )
    .map(a => String(a.alias || ""))
    .filter(Boolean);

  let title = String(gibData?.gibAccountName || "");
  if (!title || activePkAliases.length === 0) {
    const tpRes = await mysoftReq(
      base,
      token,
      `/api/Taxpayer/getTaxPayerDetailInfo?identifierNumber=${encodeURIComponent(identifier)}`,
      "GET"
    ).catch(() => null);
    const tp = tpRes?.json?.data;
    if (!title && tp) {
      title = String(
        tp.tradeName ||
          tp.identityTitle ||
          [tp.firstName, tp.lastName].filter(Boolean).join(" ") ||
          ""
      );
    }
  }

  return {
    ok: true,
    environment: auth.env,
    isEInvoiceUser: Boolean(!gibData?.isPassive && activePkAliases.length > 0),
    title,
    aliases: activePkAliases.slice(0, 10),
  };
}

/**
 * Çoklu entegratörlerin (Park Entegrasyon, Veriban, Mysoft) UBL-TR 1.2 Schematron / XSD
 * kontrollerini eksiksiz geçmesi için standart UBLExtensions, SendingType, embedded XSLT
 * ve Signature düğümlerini ekler (EDM şablonunu değiştirmez).
 */
function ensureStandardUblExtensionsAndSignature(built: BuiltUblInvoice): { xml: string; invoiceNo: string } {
  const rawPfx = String(built.prefix || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const pfx = rawPfx.length === 3 ? rawPfx : built.docType === "EARSIV" ? "MKA" : "MKS";
  const year = /^\d{4}/.test(built.issueDate) ? built.issueDate.slice(0, 4) : String(new Date().getFullYear());
  const seq9 = String((Date.now() % 1_000_000) * 1000 + crypto.randomInt(0, 1000)).padStart(9, "0");
  const invoiceNo = `${pfx}${year}${seq9}`;
  let xml = built.xml.replace("<cbc:ID>ABC2009123456789</cbc:ID>", `<cbc:ID>${invoiceNo}</cbc:ID>`);
  if (!xml.includes("<ext:UBLExtensions")) {
    xml = xml.replace(
      "<cbc:UBLVersionID>",
      "<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions><cbc:UBLVersionID>"
    );
  }
  if (!xml.includes("<cac:Signature")) {
    const xslt =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:inv="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">` +
      `<xsl:output method="html" encoding="UTF-8"/><xsl:template match="/"><html><head><meta charset="utf-8"/><title>e-Fatura</title>` +
      `<style>body{font-family:system-ui,sans-serif;font-size:12px;color:#111;margin:20px}h2{margin:0 0 6px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}th{background:#f1f5f9}.grid{display:flex;gap:16px;margin:10px 0}.box{flex:1;border:1px solid #cbd5e1;padding:8px 10px;border-radius:6px}.num{text-align:right}</style>` +
      `</head><body>` +
      `<h2><xsl:value-of select="//inv:Invoice/cbc:ProfileID"/> · <xsl:value-of select="//inv:Invoice/cbc:ID"/></h2>` +
      `<div><b>Tarih:</b> <xsl:value-of select="//inv:Invoice/cbc:IssueDate"/> | <b>Tip:</b> <xsl:value-of select="//inv:Invoice/cbc:InvoiceTypeCode"/> | <b>ETTN:</b> <xsl:value-of select="//inv:Invoice/cbc:UUID"/></div>` +
      `<div class="grid">` +
      `<div class="box"><b>SATICI</b><br/><xsl:value-of select="//inv:Invoice/cac:AccountingSupplierParty//cbc:Name"/><br/>VKN/TCKN: <xsl:value-of select="//inv:Invoice/cac:AccountingSupplierParty//cac:PartyIdentification/cbc:ID"/><br/><xsl:value-of select="//inv:Invoice/cac:AccountingSupplierParty//cbc:CitySubdivisionName"/> / <xsl:value-of select="//inv:Invoice/cac:AccountingSupplierParty//cbc:CityName"/></div>` +
      `<div class="box"><b>ALICI</b><br/><xsl:value-of select="//inv:Invoice/cac:AccountingCustomerParty//cbc:Name"/><xsl:value-of select="//inv:Invoice/cac:AccountingCustomerParty//cbc:FirstName"/>&#160;<xsl:value-of select="//inv:Invoice/cac:AccountingCustomerParty//cbc:FamilyName"/><br/>VKN/TCKN: <xsl:value-of select="//inv:Invoice/cac:AccountingCustomerParty//cac:PartyIdentification/cbc:ID"/><br/><xsl:value-of select="//inv:Invoice/cac:AccountingCustomerParty//cbc:CitySubdivisionName"/> / <xsl:value-of select="//inv:Invoice/cac:AccountingCustomerParty//cbc:CityName"/></div>` +
      `</div>` +
      `<table><tr><th>Ürün / Hizmet</th><th class="num">Miktar</th><th class="num">Birim Fiyat</th><th class="num">KDV %</th><th class="num">KDV Tutarı</th><th class="num">Mal/Hizmet Tutarı</th></tr>` +
      `<xsl:for-each select="//inv:Invoice/cac:InvoiceLine"><tr><td><xsl:value-of select="cac:Item/cbc:Name"/></td><td class="num"><xsl:value-of select="cbc:InvoicedQuantity"/></td><td class="num"><xsl:value-of select="cac:Price/cbc:PriceAmount"/></td><td class="num"><xsl:value-of select="cac:TaxTotal/cac:TaxSubtotal/cbc:Percent"/>%</td><td class="num"><xsl:value-of select="cac:TaxTotal/cbc:TaxAmount"/></td><td class="num"><xsl:value-of select="cbc:LineExtensionAmount"/></td></tr></xsl:for-each>` +
      `</table>` +
      `<div style="text-align:right"><b>Ara Toplam:</b> <xsl:value-of select="//inv:Invoice/cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount"/> TRY<br/><b>Toplam KDV:</b> <xsl:value-of select="//inv:Invoice/cac:TaxTotal/cbc:TaxAmount"/> TRY<br/><b>Ödenecek Tutar:</b> <xsl:value-of select="//inv:Invoice/cac:LegalMonetaryTotal/cbc:PayableAmount"/> TRY</div>` +
      `<xsl:if test="//inv:Invoice/cbc:Note"><div><b>Not:</b> <xsl:value-of select="//inv:Invoice/cbc:Note"/></div></xsl:if>` +
      `</body></html></xsl:template></xsl:stylesheet>`;
    const xsltB64 = Buffer.from(xslt, "utf8").toString("base64");
    const sendingRef =
      built.docType === "EARSIV"
        ? `<cac:AdditionalDocumentReference><cbc:ID>${escXml(built.uuid)}</cbc:ID><cbc:IssueDate>${escXml(built.issueDate)}</cbc:IssueDate><cbc:DocumentTypeCode>SendingType</cbc:DocumentTypeCode><cbc:DocumentType>KAGIT</cbc:DocumentType></cac:AdditionalDocumentReference>`
        : "";
    const xsltRef =
      `<cac:AdditionalDocumentReference><cbc:ID>${escXml(built.uuid)}</cbc:ID><cbc:IssueDate>${escXml(built.issueDate)}</cbc:IssueDate>` +
      `<cbc:DocumentType>XSLT</cbc:DocumentType><cac:Attachment>` +
      `<cbc:EmbeddedDocumentBinaryObject characterSetCode="UTF-8" encodingCode="Base64" filename="${escXml(built.uuid)}.xslt" mimeCode="application/xml">${xsltB64}</cbc:EmbeddedDocumentBinaryObject>` +
      `</cac:Attachment></cac:AdditionalDocumentReference>`;
    const scheme = built.senderTaxNo.length === 11 ? "TCKN" : "VKN";
    const sigBlock =
      `<cac:Signature><cbc:ID schemeID="VKN_TCKN">${escXml(built.senderTaxNo)}</cbc:ID>` +
      `<cac:SignatoryParty><cac:PartyIdentification><cbc:ID schemeID="${scheme}">${escXml(built.senderTaxNo)}</cbc:ID></cac:PartyIdentification>` +
      `<cac:PostalAddress><cbc:StreetName>Merkez</cbc:StreetName><cbc:CitySubdivisionName>MERKEZ</cbc:CitySubdivisionName><cbc:CityName>ANKARA</cbc:CityName><cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country></cac:PostalAddress>` +
      `</cac:SignatoryParty><cac:DigitalSignatureAttachment><cac:ExternalReference><cbc:URI>#Signature_${escXml(built.uuid)}</cbc:URI></cac:ExternalReference></cac:DigitalSignatureAttachment></cac:Signature>`;
    xml = xml.replace("<cac:AccountingSupplierParty>", `${sendingRef}${xsltRef}${sigBlock}<cac:AccountingSupplierParty>`);
  }
  return { xml, invoiceNo };
}

export async function adapterSendInvoice(auth: ProviderAuth, built: BuiltUblInvoice) {
  const { xml: xmlText, invoiceNo: generatedNo } = ensureStandardUblExtensionsAndSignature(built);
  const zipBuf = createSingleFileZip(`${built.uuid}.xml`, Buffer.from(xmlText, "utf8"));
  const zipB64 = zipBuf.toString("base64");

  if (auth.provider === "VERIBAN") {
    const hash = crypto.createHash("md5").update(zipBuf).digest("hex");
    const service = built.docType === "EARSIV" ? "EARSIV" : "EFATURA";
    return withVeribanSession(service, auth, async (sid, url) => {
      const transferXml =
        service === "EARSIV"
          ? `<transferFile><FileDataType>XML_INZIP</FileDataType><FileNameWithExtension>${built.uuid}.zip</FileNameWithExtension><BinaryData>${zipB64}</BinaryData><BinaryDataHash>${hash}</BinaryDataHash><InvoiceTransportationType>ELEKTRONIK</InvoiceTransportationType><IsInvoiceCreatedAtDelivery>false</IsInvoiceCreatedAtDelivery><IsInternetSalesInvoice>false</IsInternetSalesInvoice></transferFile>`
          : `<transferFile><FileDataType>XML_INZIP</FileDataType><FileNameWithExtension>${built.uuid}.zip</FileNameWithExtension><BinaryData>${zipB64}</BinaryData><BinaryDataHash>${hash}</BinaryDataHash><CustomerAlias>${escXml(built.receiverAlias || "")}</CustomerAlias><IsDirectSend>true</IsDirectSend></transferFile>`;
      const r = await veribanSoap(
        url,
        "TransferSalesInvoiceFile",
        `<TransferSalesInvoiceFile xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode>${transferXml}</TransferSalesInvoiceFile>`,
        90_000
      );
      const completed = pickXml(r.text, "OperationCompleted").toLowerCase();
      if (!r.ok || completed === "false") {
        throw veribanFault(r.text, "Veriban fatura gönderilemedi.");
      }
      const transferId = pickXml(r.text, "TransferFileUniqueId");
      let stateName = pickXml(r.text, "Description") || "PROCESSING";
      if (transferId) {
        const tfAction = service === "EARSIV" ? "GetTransferFileStatus" : "GetTransferSalesInvoiceFileStatus";
        for (let attempt = 0; attempt < 3; attempt++) {
          const tf = await veribanSoap(
            url,
            tfAction,
            `<${tfAction} xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode><transferFileUniqueId>${escXml(transferId)}</transferFileUniqueId></${tfAction}>`,
            15_000
          ).catch(() => ({ text: "" }));
          const sc = pickXml(tf.text, "StateCode");
          const tfState = pickXml(tf.text, "StateName") || pickXml(tf.text, "Description");
          if (tfState) stateName = tfState;
          if (sc === "4") {
            throw new IntegratorError(pickXml(tf.text, "StateDescription") || tfState || "Veriban fatura şema kontrolünden geçemedi.", "4");
          }
          if (sc === "5" || !sc || attempt === 2) break;
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      const st = await veribanSoap(
        url,
        "GetSalesInvoiceStatusWithInvoiceUUID",
        `<GetSalesInvoiceStatusWithInvoiceUUID xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode><invoiceUUID>${escXml(built.uuid)}</invoiceUUID></GetSalesInvoiceStatusWithInvoiceUUID>`,
        15_000
      ).catch(() => ({ text: "" }));
      const invoiceNo = pickXml(st.text, "InvoiceNumber") || generatedNo;
      stateName = pickXml(st.text, "StateName") || stateName;
      return {
        ok: true,
        environment: auth.env,
        invoiceNo,
        uuid: built.uuid,
        status: stateName,
        statusDescription: stateName,
        payableAmount: built.payable,
        netTotal: built.netTotal,
        taxTotal: built.taxTotal,
        issueDate: built.issueDate,
        profile: built.profile,
      };
    });
  }

  if (auth.provider === "PARK_ENTEGRASYON") {
    const { base, token } = await parkToken(auth);
    const isArch = built.docType === "EARSIV";
    const endpoint = isArch ? "/v1/earchives/ubl" : "/v1/einvoices/ubl";
    const pfx = (built.prefix || "").trim().toUpperCase();
    const seriePrefix = pfx.length === 3 && pfx !== "MKS" ? pfx : isArch ? "EAR" : "EFT";
    const payload = {
      assignNumber: true,
      seriePrefix,
      compressed: true,
      documentAction: "SEND",
      content: zipB64,
    };
    const r = await parkJson(base, token, endpoint, { method: "POST", body: JSON.stringify(payload) });
    const dataErr = r.json?.data?.error;
    if (!r.ok || r.json?.error || dataErr) {
      const msg =
        r.json?.error?.message ||
        dataErr?.message ||
        (typeof dataErr === "string" ? dataErr : "") ||
        "Park Entegrasyon fatura gönderemedi.";
      throw new IntegratorError(msg, String(r.json?.error?.code || dataErr?.code || r.status));
    }
    const d = r.json?.data || {};
    return {
      ok: true,
      environment: auth.env,
      invoiceNo: String(d.documentNo || d.invoiceNumber || ""),
      uuid: String(d.uuid || built.uuid),
      status: String(d.documentStatus?.value || d.status || "IN_PROCESSING"),
      statusDescription: String(d.documentStatus?.label || d.statusDesc || ""),
      payableAmount: built.payable,
      netTotal: built.netTotal,
      taxTotal: built.taxTotal,
      issueDate: built.issueDate,
      profile: built.profile,
    };
  }

  const { base, token } = await mysoftToken(auth);
  const r = await mysoftReq(base, token, "/api/InvoiceOutbox/invoiceOutboxWithUblXml", "POST", {
    invoiceTypeUblString: zipB64,
    eDocumentType: built.docType === "EARSIV" ? "EARSIVFATURA" : "EFATURA",
    prefix: built.prefix || "MYF",
    pkAlias: built.docType === "EFATURA" ? built.receiverAlias || "" : "",
    gbAlias: "",
    xsltName: null,
    isSendWithGeneralXsltIfDefaultNotExists: true,
    tenantIdentifierNumber: null,
    referanceKey: built.uuid,
  });
  if (!r.ok || r.json?.succeed === false || r.json?.isSucceed === false) {
    throw new IntegratorError(r.json?.message || r.json?.errorMessage || "Mysoft fatura gönderemedi.");
  }
  const d = r.json?.data || r.json || {};
  return {
    ok: true,
    environment: auth.env,
    invoiceNo: String(d.invoiceNumber || d.docNo || ""),
    uuid: String(d.ettn || d.invoiceETTN || built.uuid),
    status: String(d.status || "SUCCEEDED"),
    statusDescription: String(r.json?.message || ""),
    payableAmount: built.payable,
    netTotal: built.netTotal,
    taxTotal: built.taxTotal,
    issueDate: built.issueDate,
    profile: built.profile,
  };
}

async function fetchVeribanSummaries(
  url: string,
  sid: string,
  direction: "IN" | "OUT",
  uuids: string[],
  fallbackDate: string,
  defaultProfile: string
): Promise<RemoteInvoiceSummary[]> {
  return mapConcurrent(uuids, 5, async uuid => {
    try {
      const dlAction = direction === "OUT" ? "DownloadSalesInvoiceWithInvoiceUUID" : "DownloadPurchaseInvoiceWithInvoiceUUID";
      const stAction = direction === "OUT" ? "GetSalesInvoiceStatusWithInvoiceUUID" : "GetPurchaseInvoiceStatusWithInvoiceUUID";
      const [dl, st] = await Promise.all([
        veribanSoap(url, dlAction, `<${dlAction} xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode><downloadDataType>XML_INZIP</downloadDataType><invoiceUUID>${escXml(uuid)}</invoiceUUID></${dlAction}>`, 20_000),
        veribanSoap(url, stAction, `<${stAction} xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode><invoiceUUID>${escXml(uuid)}</invoiceUUID></${stAction}>`, 15_000).catch(() => ({ text: "" })),
      ]);
      const b64 = pickXml(dl.text, "FileData");
      const xml = b64 ? decodeMaybeZipBase64(b64, ".xml") : "";
      const ubl = xml ? parseUblDocument(xml) : null;
      const sc = pickXml(st.text, "StateCode");
      const sn = pickXml(st.text, "StateName");
      const ans = pickXml(st.text, "AnswerStateName");
      return {
        id: pickXml(dl.text, "ReferenceCode") || ubl?.invoiceNo || "",
        uuid,
        supplier: ubl?.supplier?.name || "",
        customer: ubl?.customer?.name || "",
        issueDate: ubl?.issueDate || fallbackDate,
        payableAmount: ubl?.payableAmount || 0,
        profile: ubl?.profile || defaultProfile,
        status: normalizeVeribanStatus(sc, sn, ans),
        statusDescription: sn,
        responseCode: ans && !/bekl|yapılmaz/i.test(ans) ? ans : "",
      } satisfies RemoteInvoiceSummary;
    } catch {
      return {
        id: "",
        uuid,
        supplier: "",
        customer: "",
        issueDate: fallbackDate,
        payableAmount: 0,
        profile: defaultProfile,
        status: "SUCCEEDED",
        responseCode: "",
      } satisfies RemoteInvoiceSummary;
    }
  });
}

export async function adapterListInvoices(auth: ProviderAuth, direction: "IN" | "OUT", startDate: string, endDate: string): Promise<RemoteInvoiceSummary[]> {
  if (auth.provider === "VERIBAN") {
    const startIso = `${startDate}T00:00:00`;
    const endIso = `${endDate}T23:59:59`;
    const efaturaList = await withVeribanSession("EFATURA", auth, async (sid, url) => {
      const action = direction === "OUT" ? "GetSalesInvoiceUUIDListWithDate" : "GetPurchaseInvoiceUUIDList";
      const res = await veribanSoap(
        url,
        action,
        `<${action} xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode><startDate>${startIso}</startDate><endDate>${endIso}</endDate></${action}>`
      );
      const uuids = [...res.text.matchAll(/<string>([^<]+)<\/string>/g)].map(m => m[1].trim()).filter(Boolean);
      return fetchVeribanSummaries(url, sid, direction, uuids.slice(0, 15), startDate, "TEMELFATURA");
    });
    if (direction !== "OUT") return efaturaList;
    const earsivList = await withVeribanSession("EARSIV", auth, async (sid, url) => {
      const res = await veribanSoap(
        url,
        "GetSalesInvoiceUUIDListWithCustomerWithDate",
        `<GetSalesInvoiceUUIDListWithCustomerWithDate xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode><dtStartIssueTime>${startIso}</dtStartIssueTime><dtEndIssueTime>${endIso}</dtEndIssueTime></GetSalesInvoiceUUIDListWithCustomerWithDate>`
      );
      const uuids = [...res.text.matchAll(/<string>([^<]+)<\/string>/g)].map(m => m[1].trim()).filter(Boolean);
      return fetchVeribanSummaries(url, sid, "OUT", uuids.slice(0, 10), startDate, "EARSIVFATURA");
    }).catch(() => [] as RemoteInvoiceSummary[]);
    return [...efaturaList, ...earsivList].sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || ""));
  }

  if (auth.provider === "PARK_ENTEGRASYON") {
    const { base, token } = await parkToken(auth);
    const mapParkRow = (x: any, isArchive = false): RemoteInvoiceSummary => ({
      id: String(x.documentNo || ""),
      externalId: x.id !== undefined ? String(x.id) : undefined,
      uuid: String(x.uuid || ""),
      supplier: String(x.accountingSupplier?.name || ""),
      customer: String(x.accountingCustomer?.name || ""),
      issueDate: String(x.issueDate || "").slice(0, 10),
      payableAmount: parseTrMoney(x.amount ?? x.payableAmount),
      profile: isArchive ? "EARSIVFATURA" : String(x.profile || "TEMELFATURA"),
      status: String(x.documentStatus?.value || x.invoiceStatus || x.earchiveStatus || x.statusCodeDesc || "PROCESSING"),
      statusDescription: String(x.documentStatus?.label || x.statusDesc || ""),
      responseCode: String(x.responseDescription || ""),
      createdAt: String(x.createDate || ""),
    });
    if (direction === "IN") {
      const r = await parkJson(base, token, `/v1/einvoices/inbox?dateType=DOCUMENT&startDate=${startDate}&endDate=${endDate}&size=60`);
      if (!r.ok) throw new IntegratorError(r.json?.error?.message || "Park Entegrasyon gelen faturalar alınamadı.");
      const rows: any[] = r.json?.data?.contents || [];
      return rows.map(x => mapParkRow(x, false));
    }
    const [outR, archR] = await Promise.all([
      parkJson(base, token, `/v1/einvoices/outbox?dateType=DOCUMENT&startDate=${startDate}&endDate=${endDate}&size=50`),
      parkJson(base, token, `/v1/earchives?startDate=${startDate}&endDate=${endDate}&size=50`).catch(() => ({ ok: false, json: null })),
    ]);
    if (!outR.ok && !archR.ok) throw new IntegratorError(outR.json?.error?.message || "Park Entegrasyon giden faturalar alınamadı.");
    const list1 = (outR.json?.data?.contents || []).map((x: any) => mapParkRow(x, false));
    const list2 = (archR.json?.data?.contents || []).map((x: any) => mapParkRow(x, true));
    return [...list1, ...list2];
  }

  const { base, token } = await mysoftToken(auth);
  const path =
    direction === "OUT"
      ? "/api/InvoiceOutbox/getInvoiceOutboxWithHeaderInfoList"
      : "/api/InvoiceInbox/getInvoiceInboxWithHeaderInfoListForPeriod";
  const body =
    direction === "OUT"
      ? { startDate, endDate, eDocumentType: null, afterValue: 0, limit: 100 }
      : { startDate: `${startDate} 00:00:00`, endDate: `${endDate} 23:59:59`, afterValue: 0, limit: 100 };
  const r = await mysoftReq(base, token, path, "POST", body);
  if (!r.ok) throw new IntegratorError(r.json?.message || "Mysoft fatura listesi alınamadı.");
  const rows: any[] = Array.isArray(r.json?.data) ? r.json.data : Array.isArray(r.json) ? r.json : [];
  return rows.map(x => ({
    id: String(x.docNo || x.invoiceNumber || ""),
    uuid: String(x.ettn || x.invoiceETTN || x.uuid || ""),
    supplier: direction === "IN" ? String(x.accountName || x.senderName || x.supplierName || "") : String(x.senderName || x.supplierName || ""),
    customer: direction === "OUT" ? String(x.accountName || x.receiverName || x.customerName || "") : String(x.receiverName || x.customerName || ""),
    issueDate: String(x.docDate || x.issueDate || "").slice(0, 10),
    payableAmount: Number(x.payableAmount ?? x.totalAmount) || 0,
    profile: String(x.profile || (x.eDocumentType === "EARSIVFATURA" ? "EARSIVFATURA" : "TEMELFATURA")),
    status: String(x.invoiceStatusText || x.statusText || x.status || "SUCCEEDED"),
    statusDescription: String(x.envelopeStatusDesc || x.invoiceStatusText || ""),
    responseCode: String(x.responseStatus || ""),
  }));
}

export async function adapterInvoiceHtml(auth: ProviderAuth, uuid: string, direction: "IN" | "OUT", externalId?: string): Promise<string> {
  if (auth.provider === "VERIBAN") {
    try {
      return await withVeribanSession("EFATURA", auth, async (sid, url) => {
        const act = direction === "OUT" ? "DownloadSalesInvoiceWithInvoiceUUID" : "DownloadPurchaseInvoiceWithInvoiceUUID";
        const r = await veribanSoap(url, act, `<${act} xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode><downloadDataType>HTML_INZIP</downloadDataType><invoiceUUID>${escXml(uuid)}</invoiceUUID></${act}>`, 45_000);
        const b64 = pickXml(r.text, "FileData");
        const html = b64 ? decodeMaybeZipBase64(b64, ".html") : "";
        if (!html) throw veribanFault(r.text, "Veriban HTML içeriği bulunamadı.");
        return html;
      });
    } catch (err) {
      if (direction === "OUT") {
        return withVeribanSession("EARSIV", auth, async (sid, url) => {
          const r = await veribanSoap(url, "DownloadSalesInvoiceWithInvoiceUUID", `<DownloadSalesInvoiceWithInvoiceUUID xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode><downloadDataType>HTML_INZIP</downloadDataType><invoiceUUID>${escXml(uuid)}</invoiceUUID></DownloadSalesInvoiceWithInvoiceUUID>`, 45_000);
          const b64 = pickXml(r.text, "FileData");
          const html = b64 ? decodeMaybeZipBase64(b64, ".html") : "";
          if (!html) throw err;
          return html;
        });
      }
      throw err;
    }
  }

  if (auth.provider === "PARK_ENTEGRASYON") {
    const { base, token } = await parkToken(auth);
    let recId = externalId;
    let isArch = false;
    if (!recId) {
      const resolved = await resolveParkRecordId(base, token, uuid, direction);
      if (resolved) {
        recId = resolved.id;
        isArch = resolved.isEArchive;
      }
    }
    if (!recId) throw new IntegratorError("Park Entegrasyon fatura kimliği bulunamadı.");
    const dirPath = direction === "OUT" ? "outbox" : "inbox";
    const candidates = isArch
      ? [`/v1/earchives/${recId}/preview/html`, `/v1/einvoices/${dirPath}/${recId}/preview/html`]
      : [`/v1/einvoices/${dirPath}/${recId}/preview/html`, ...(direction === "OUT" ? [`/v1/earchives/${recId}/preview/html`] : [])];
    for (const p of candidates) {
      const r = await fetch(`${base}${p}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
      if (r.ok) {
        const html = await r.text();
        if (html.includes("<")) return html;
      }
    }
    throw new IntegratorError("Fatura HTML önizlemesi alınamadı.");
  }

  const { base, token } = await mysoftToken(auth);
  const path =
    direction === "OUT"
      ? `/api/InvoiceOutbox/getInvoiceOutboxHTMLAsZip?invoiceETTN=${encodeURIComponent(uuid)}`
      : `/api/InvoiceInbox/getInvoiceInboxHTMLAsZip?invoiceETTN=${encodeURIComponent(uuid)}`;
  const r = await mysoftReq(base, token, path, "GET");
  const b64 = r.json?.data?.content || r.json?.data || (typeof r.json === "string" ? r.json : "");
  const html = typeof b64 === "string" && b64 ? decodeMaybeZipBase64(b64, ".html") : r.text;
  if (!html || !html.includes("<")) throw new IntegratorError("Mysoft fatura HTML görüntüsü alınamadı.");
  return html;
}

export async function adapterInvoiceDetail(auth: ProviderAuth, uuid: string, direction: "IN" | "OUT", externalId?: string) {
  let xml = "";
  if (auth.provider === "VERIBAN") {
    xml = await withVeribanSession("EFATURA", auth, async (sid, url) => {
      const act = direction === "OUT" ? "DownloadSalesInvoiceWithInvoiceUUID" : "DownloadPurchaseInvoiceWithInvoiceUUID";
      const r = await veribanSoap(url, act, `<${act} xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode><downloadDataType>XML_INZIP</downloadDataType><invoiceUUID>${escXml(uuid)}</invoiceUUID></${act}>`);
      const b64 = pickXml(r.text, "FileData");
      return b64 ? decodeMaybeZipBase64(b64, ".xml") : "";
    });
    if (!xml.includes("Invoice") && direction === "OUT") {
      xml = await withVeribanSession("EARSIV", auth, async (sid, url) => {
        const r = await veribanSoap(
          url,
          "DownloadSalesInvoiceWithInvoiceUUID",
          `<DownloadSalesInvoiceWithInvoiceUUID xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode><downloadDataType>XML_INZIP</downloadDataType><invoiceUUID>${escXml(uuid)}</invoiceUUID></DownloadSalesInvoiceWithInvoiceUUID>`
        );
        const b64 = pickXml(r.text, "FileData");
        return b64 ? decodeMaybeZipBase64(b64, ".xml") : "";
      }).catch(() => "");
    }
  } else if (auth.provider === "PARK_ENTEGRASYON") {
    const { base, token } = await parkToken(auth);
    let recId = externalId;
    let isArch = false;
    if (!recId) {
      const resolved = await resolveParkRecordId(base, token, uuid, direction);
      if (resolved) {
        recId = resolved.id;
        isArch = resolved.isEArchive;
      }
    }
    const tryDownload = async (id: string, archive: boolean) => {
      const dir = direction === "OUT" ? "outbox" : "inbox";
      const ep = archive ? "/v1/earchives/download/ubl" : `/v1/einvoices/${dir}/download/ubl`;
      const r = await parkJson(base, token, ep, {
        method: "POST",
        body: JSON.stringify([{ id: Number(id) || id }]),
      });
      const b64 = r.json?.data?.content;
      if (r.ok && typeof b64 === "string" && b64) {
        const txt = decodeMaybeZipBase64(b64, ".xml");
        if (txt.includes("Invoice")) return txt;
      }
      return "";
    };
    if (recId) {
      xml = await tryDownload(recId, isArch);
      if ((!xml || (uuid && !xml.toLowerCase().includes(uuid.toLowerCase()))) && direction === "OUT") {
        const resolved = await resolveParkRecordId(base, token, uuid, direction);
        if (resolved) {
          xml = await tryDownload(resolved.id, resolved.isEArchive);
        } else if (!isArch) {
          xml = await tryDownload(recId, true);
        }
      }
    }
  } else {
    const { base, token } = await mysoftToken(auth);
    const p =
      direction === "OUT"
        ? `/api/InvoiceOutbox/getInvoiceOutboxXMLAsZip?invoiceETTN=${encodeURIComponent(uuid)}`
        : `/api/InvoiceInbox/getInvoiceInboxUBLXMLAsZip?invoiceETTN=${encodeURIComponent(uuid)}`;
    const r = await mysoftReq(base, token, p, "GET");
    const b64 = r.json?.data?.content || r.json?.data || "";
    if (typeof b64 === "string" && b64) xml = decodeMaybeZipBase64(b64, ".xml");
  }
  if (!xml.includes("Invoice")) throw new IntegratorError("Fatura XML içeriği okunamadı.");
  const d = parseUblDocument(xml);
  return { ok: true, ...d };
}

export async function adapterCancelInvoice(auth: ProviderAuth, uuid: string) {
  if (auth.provider === "VERIBAN") {
    return withVeribanSession("EARSIV", auth, async (sid, url) => {
      const nowIso = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 19); // Türkiye saati (UTC+3)
      const r = await veribanSoap(
        url,
        "CancelSalesInvoiceWithInvoiceUUID",
        `<CancelSalesInvoiceWithInvoiceUUID xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode><cancelledTime>${nowIso}</cancelledTime><invoiceUUID>${escXml(uuid)}</invoiceUUID></CancelSalesInvoiceWithInvoiceUUID>`
      );
      if (!r.ok || pickXml(r.text, "OperationCompleted").toLowerCase() === "false") {
        throw veribanFault(r.text, "Veriban e-Arşiv faturası iptal edilemedi.");
      }
      return { ok: true };
    });
  }
  if (auth.provider === "PARK_ENTEGRASYON") {
    const { base, token } = await parkToken(auth);
    const r = await parkJson(base, token, "/v1/earchives/cancel", { method: "DELETE", body: JSON.stringify([{ uuid }]) });
    if (!r.ok || r.json?.error) throw new IntegratorError(r.json?.error?.message || "Park Entegrasyon e-Arşiv faturası iptal edilemedi.");
    return { ok: true };
  }
  const { base, token } = await mysoftToken(auth);
  const today = new Date().toISOString().slice(0, 10);
  const r = await mysoftReq(
    base,
    token,
    `/api/InvoiceOutbox/cancelEArchiveInvoice?invoiceETTN=${encodeURIComponent(uuid)}&cancelDate=${today}&cancelType=PORTAL&cancelNote=Iptal`,
    "GET"
  );
  if (!r.ok) throw new IntegratorError(r.json?.message || "Mysoft e-Arşiv iptali başarısız.");
  return { ok: true };
}

export async function adapterRespondInvoice(auth: ProviderAuth, uuidOrId: string, accept: boolean, externalId?: string, note?: string) {
  const cleanNote = (note || "").trim() || (accept ? "Kabul edildi" : "Fatura muhteviyatına itiraz nedeniyle reddedildi");
  if (auth.provider === "VERIBAN") {
    return withVeribanSession("EFATURA", auth, async (sid, url) => {
      const answerType = accept ? "ACCEPTED" : "REJECTED";
      const nowIso = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 19); // Türkiye saati (UTC+3)
      const r = await veribanSoap(
        url,
        "SetPurchaseInvoiceAnswerWithInvoiceUUID",
        `<SetPurchaseInvoiceAnswerWithInvoiceUUID xmlns="http://tempuri.org/"><sessionCode>${escXml(sid)}</sessionCode><answerType>${answerType}</answerType><answerTime>${nowIso}</answerTime><answerNote>${escXml(cleanNote)}</answerNote><isDirectSend>true</isDirectSend><invoiceUUID>${escXml(uuidOrId)}</invoiceUUID></SetPurchaseInvoiceAnswerWithInvoiceUUID>`
      );
      if (!r.ok || pickXml(r.text, "OperationCompleted").toLowerCase() === "false") {
        throw veribanFault(r.text, "Veriban fatura yanıtı gönderilemedi.");
      }
      return { ok: true, status: accept ? "KABUL" : "RED" };
    });
  }
  if (auth.provider === "PARK_ENTEGRASYON") {
    const { base, token } = await parkToken(auth);
    let recId = externalId;
    if (!recId) {
      const res = await resolveParkRecordId(base, token, uuidOrId, "IN");
      recId = res?.id;
    }
    if (!recId) throw new IntegratorError("Park Entegrasyon gelen fatura ID bulunamadı.");
    const r = await parkJson(base, token, `/v1/einvoices/inbox/${recId}/response`, {
      method: "POST",
      body: JSON.stringify({ responseType: accept ? "ACCEPT" : "REJECT", description: cleanNote }),
    });
    if (!r.ok || r.json?.error) throw new IntegratorError(r.json?.error?.message || "Park Entegrasyon yanıt gönderilemedi.");
    return { ok: true, status: accept ? "KABUL" : "RED" };
  }
  const { base, token } = await mysoftToken(auth);
  const path = accept
    ? `/api/InvoiceInbox/acceptInvoice?invoiceETTN=${encodeURIComponent(uuidOrId)}`
    : `/api/InvoiceInbox/denyInvoice?invoiceETTN=${encodeURIComponent(uuidOrId)}&rejectReason=${encodeURIComponent(cleanNote)}`;
  const r = await mysoftReq(base, token, path, "GET");
  if (!r.ok) throw new IntegratorError(r.json?.message || "Mysoft fatura yanıtı başarısız.");
  return { ok: true, status: accept ? "KABUL" : "RED" };
}
