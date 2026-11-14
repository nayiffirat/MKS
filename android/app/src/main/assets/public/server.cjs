"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_crypto2 = __toESM(require("crypto"), 1);

// server/edm.ts
var import_crypto = __toESM(require("crypto"), 1);
var EDM_URLS = {
  TEST: "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc",
  LIVE: "https://portal2.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc"
};
var APP_NAME = "MKS";
var esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
var unesc = (v) => v.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
var pick = (text, tag) => unesc((text.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`)) || [])[1] || "");
var attr = (attrs, name) => unesc((attrs.match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1] || "");
var r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
var money = (n) => r2(n).toFixed(2);
function requestHeader(sessionId, reason) {
  return `<REQUEST_HEADER xmlns=""><SESSION_ID>${esc(sessionId)}</SESSION_ID><CLIENT_TXN_ID>${import_crypto.default.randomUUID()}</CLIENT_TXN_ID><ACTION_DATE>${(/* @__PURE__ */ new Date()).toISOString()}</ACTION_DATE><REASON>${esc(reason)}</REASON><APPLICATION_NAME>${APP_NAME}</APPLICATION_NAME><HOSTNAME>${APP_NAME}</HOSTNAME><CHANNEL_NAME>${APP_NAME}</CHANNEL_NAME><COMPRESSED>N</COMPRESSED></REQUEST_HEADER>`;
}
async function soap(env, action, inner, timeoutMs = 45e3) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(EDM_URLS[env], {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${action}"` },
      body: `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><${action} xmlns="http://tempuri.org/">${inner}</${action}></s:Body></s:Envelope>`,
      signal: controller.signal
    });
    return { ok: resp.ok, text: await resp.text() };
  } finally {
    clearTimeout(timer);
  }
}
var EdmError = class extends Error {
  constructor(message, code = "") {
    super(message);
    this.code = code;
  }
  code;
};
var faultOf = (text, fallback) => new EdmError(pick(text, "ERROR_LONG_DES") || pick(text, "ERROR_SHORT_DES") || pick(text, "faultstring") || fallback, pick(text, "ERROR_CODE"));
async function withSession(env, username, password, reason, fn) {
  const login = await soap(env, "LoginRequest", `${requestHeader("0", reason)}<USER_NAME xmlns="">${esc(username)}</USER_NAME><PASSWORD xmlns="">${esc(password)}</PASSWORD>`, 25e3);
  const sid = pick(login.text, "SESSION_ID");
  if (!login.ok || !sid) throw faultOf(login.text, "EDM giri\u015Fi ba\u015Far\u0131s\u0131z.");
  try {
    return await fn(sid);
  } finally {
    void soap(env, "LogoutRequest", requestHeader(sid, reason), 1e4).catch(() => {
    });
  }
}
var UNIT_CODES = {
  adet: "C62",
  ad: "C62",
  kg: "KGM",
  kilogram: "KGM",
  gr: "GRM",
  g: "GRM",
  gram: "GRM",
  lt: "LTR",
  l: "LTR",
  litre: "LTR",
  ml: "MLT",
  ton: "TNE",
  paket: "PA",
  kutu: "BX",
  koli: "BX",
  m: "MTR",
  metre: "MTR"
  // çuval, şişe vb. GİB listesinde yok: adet (C62) gider
};
var unitCode = (u) => UNIT_CODES[String(u || "").trim().toLocaleLowerCase("tr-TR")] || "C62";
function partyXml(p) {
  const taxNo = String(p.taxNo || "").replace(/\D/g, "");
  const isPerson = taxNo.length === 11;
  const name = (p.name || "").trim();
  const parts = name.split(/\s+/);
  const family = parts.length > 1 ? parts.pop() : name;
  const first = parts.join(" ") || name;
  return `<cac:Party><cac:PartyIdentification><cbc:ID schemeID="${isPerson ? "TCKN" : "VKN"}">${taxNo}</cbc:ID></cac:PartyIdentification>` + (isPerson ? "" : `<cac:PartyName><cbc:Name>${esc(name)}</cbc:Name></cac:PartyName>`) + `<cac:PostalAddress><cbc:StreetName>${esc(p.address || "")}</cbc:StreetName><cbc:CitySubdivisionName>${esc(p.district || "-")}</cbc:CitySubdivisionName><cbc:CityName>${esc(p.city || "-")}</cbc:CityName><cac:Country><cbc:IdentificationCode>TR</cbc:IdentificationCode><cbc:Name>T\xFCrkiye</cbc:Name></cac:Country></cac:PostalAddress><cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>${esc(p.taxOffice || "")}</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>` + (p.phone || p.email ? `<cac:Contact>${p.phone ? `<cbc:Telephone>${esc(p.phone)}</cbc:Telephone>` : ""}${p.email ? `<cbc:ElectronicMail>${esc(p.email)}</cbc:ElectronicMail>` : ""}</cac:Contact>` : "") + (isPerson ? `<cac:Person><cbc:FirstName>${esc(first)}</cbc:FirstName><cbc:FamilyName>${esc(family)}</cbc:FamilyName></cac:Person>` : "") + `</cac:Party>`;
}
function buildUblInvoice(inv) {
  const uuid = import_crypto.default.randomUUID();
  const now = /* @__PURE__ */ new Date();
  const trNow = new Date(now.getTime() + 3 * 36e5).toISOString();
  const issueDate = /^\d{4}-\d{2}-\d{2}$/.test(inv.issueDate || "") ? inv.issueDate : trNow.slice(0, 10);
  const issueTime = trNow.slice(11, 19);
  const isReturn = inv.invoiceType === "IADE";
  const profile = inv.docType === "EARSIV" ? "EARSIVFATURA" : inv.scenario === "TICARIFATURA" && !isReturn ? "TICARIFATURA" : "TEMELFATURA";
  const billingRef = isReturn ? `<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${esc(String(inv.refInvoiceNo || "").trim())}</cbc:ID><cbc:IssueDate>${inv.refInvoiceDate}</cbc:IssueDate><cbc:DocumentTypeCode>IADE</cbc:DocumentTypeCode></cac:InvoiceDocumentReference></cac:BillingReference>` : "";
  const lines = inv.lines.map((l, i) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unitPrice) || 0;
    const rate = Number(l.vatRate) || 0;
    const net = r2(qty * price);
    const tax = r2(net * rate / 100);
    return { no: i + 1, name: l.name, qty, price, rate, net, tax, unit: unitCode(l.unit) };
  });
  const byRate = /* @__PURE__ */ new Map();
  for (const l of lines) {
    const g = byRate.get(l.rate) || { base: 0, tax: 0 };
    g.base = r2(g.base + l.net);
    g.tax = r2(g.tax + l.tax);
    byRate.set(l.rate, g);
  }
  const netTotal = r2(lines.reduce((s, l) => s + l.net, 0));
  const taxTotal = r2(lines.reduce((s, l) => s + l.tax, 0));
  const payable = r2(netTotal + taxTotal);
  const amt = (n) => `currencyID="TRY">${money(n)}`;
  const subtotal = (base, tax, rate) => `<cac:TaxSubtotal><cbc:TaxableAmount ${amt(base)}</cbc:TaxableAmount><cbc:TaxAmount ${amt(tax)}</cbc:TaxAmount><cbc:CalculationSequenceNumeric>1</cbc:CalculationSequenceNumeric><cbc:Percent>${rate}</cbc:Percent><cac:TaxCategory>${rate === 0 ? `<cbc:TaxExemptionReasonCode>351</cbc:TaxExemptionReasonCode><cbc:TaxExemptionReason>KDV istisna olmayan di\u011Fer</cbc:TaxExemptionReason>` : ""}<cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2 UBL-Invoice-2.1.xsd"><cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>TR1.2</cbc:CustomizationID><cbc:ProfileID>${profile}</cbc:ProfileID><cbc:ID>ABC2009123456789</cbc:ID><cbc:CopyIndicator>false</cbc:CopyIndicator><cbc:UUID>${uuid}</cbc:UUID><cbc:IssueDate>${issueDate}</cbc:IssueDate><cbc:IssueTime>${issueTime}</cbc:IssueTime><cbc:InvoiceTypeCode>${isReturn ? "IADE" : "SATIS"}</cbc:InvoiceTypeCode>${inv.note ? `<cbc:Note>${esc(inv.note)}</cbc:Note>` : ""}<cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode><cbc:LineCountNumeric>${lines.length}</cbc:LineCountNumeric>${billingRef}<cac:AccountingSupplierParty>${partyXml(inv.sender)}</cac:AccountingSupplierParty><cac:AccountingCustomerParty>${partyXml(inv.receiver)}</cac:AccountingCustomerParty><cac:TaxTotal><cbc:TaxAmount ${amt(taxTotal)}</cbc:TaxAmount>${[...byRate.entries()].map(([rate, g]) => subtotal(g.base, g.tax, rate)).join("")}</cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount ${amt(netTotal)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount ${amt(netTotal)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount ${amt(payable)}</cbc:TaxInclusiveAmount><cbc:AllowanceTotalAmount ${amt(0)}</cbc:AllowanceTotalAmount><cbc:PayableAmount ${amt(payable)}</cbc:PayableAmount></cac:LegalMonetaryTotal>` + lines.map(
    (l) => `<cac:InvoiceLine><cbc:ID>${l.no}</cbc:ID><cbc:InvoicedQuantity unitCode="${l.unit}">${l.qty}</cbc:InvoicedQuantity><cbc:LineExtensionAmount ${amt(l.net)}</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount ${amt(l.tax)}</cbc:TaxAmount>${subtotal(l.net, l.tax, l.rate)}</cac:TaxTotal><cac:Item><cbc:Name>${esc(l.name)}</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="TRY">${(Math.round(l.price * 1e6) / 1e6).toString()}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`
  ).join("") + `</Invoice>`;
  return { xml, uuid, payable, netTotal, taxTotal, issueDate, profile };
}
function validateInvoice(inv) {
  if (!inv || inv.docType !== "EFATURA" && inv.docType !== "EARSIV") return "Belge t\xFCr\xFC e-Fatura veya e-Ar\u015Fiv olmal\u0131d\u0131r.";
  const sTax = String(inv.sender?.taxNo || "").replace(/\D/g, "");
  const rTax = String(inv.receiver?.taxNo || "").replace(/\D/g, "");
  if (sTax.length !== 10 && sTax.length !== 11) return "Ayarlar'da bayi VKN/TCKN (10 veya 11 hane) girilmelidir.";
  if (!String(inv.sender?.name || "").trim()) return "Ayarlar'da firma \xFCnvan\u0131 girilmelidir.";
  if (rTax.length !== 10 && rTax.length !== 11) return "Al\u0131c\u0131 VKN (10 hane) veya TCKN (11 hane) girilmelidir.";
  if (!String(inv.receiver?.name || "").trim()) return "Al\u0131c\u0131 ad\u0131 / \xFCnvan\u0131 girilmelidir.";
  if (inv.invoiceType === "IADE") {
    if (!/^[A-Za-z0-9]{3,16}$/.test(String(inv.refInvoiceNo || "").trim())) return "\u0130ade edilen faturan\u0131n numaras\u0131 gerekli.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(inv.refInvoiceDate || ""))) return "\u0130ade edilen faturan\u0131n tarihi gerekli.";
  }
  if (!Array.isArray(inv.lines) || inv.lines.length === 0 || inv.lines.length > 200) return "En az bir fatura sat\u0131r\u0131 gereklidir.";
  for (const l of inv.lines) {
    if (!String(l?.name || "").trim()) return "Her sat\u0131rda \xFCr\xFCn ad\u0131 olmal\u0131d\u0131r.";
    if (!(Number(l.quantity) > 0)) return `"${l.name}" i\xE7in miktar s\u0131f\u0131rdan b\xFCy\xFCk olmal\u0131d\u0131r.`;
    if (!(Number(l.unitPrice) >= 0)) return `"${l.name}" i\xE7in birim fiyat ge\xE7ersiz.`;
    if (![0, 1, 8, 10, 18, 20].includes(Number(l.vatRate))) return `"${l.name}" i\xE7in KDV oran\u0131 ge\xE7ersiz.`;
  }
  return null;
}
function parseInvoices(text) {
  return [...text.matchAll(/<INVOICE\b([^>]*)>([\s\S]*?)<\/INVOICE>/g)].map((m) => ({
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
var UNIT_NAMES = { C62: "Adet", KGM: "Kg", GRM: "Gr", LTR: "Lt", MLT: "Ml", TNE: "Ton", PA: "Paket", BX: "Kutu", MTR: "Metre" };
function parseUbl(xml) {
  const tag = (s, n) => (s.match(new RegExp(`<(?:\\w+:)?${n}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${n}>`)) || [])[1] || "";
  const un = (s) => s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
  const party = (block) => {
    const p = tag(block, "Party");
    const person = tag(p, "Person");
    return {
      taxNo: (p.match(/schemeID="(?:VKN|TCKN)"[^>]*>\s*(\d+)/) || [])[1] || "",
      name: un(tag(tag(p, "PartyName"), "Name")) || [un(tag(person, "FirstName")), un(tag(person, "FamilyName"))].filter(Boolean).join(" "),
      district: un(tag(p, "CitySubdivisionName")).replace(/^-$/, ""),
      city: un(tag(p, "CityName")).replace(/^-$/, "")
    };
  };
  const lines = [...xml.matchAll(/<(?:\w+:)?InvoiceLine>([\s\S]*?)<\/(?:\w+:)?InvoiceLine>/g)].map((m) => {
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
function registerEdmRoutes(app, deps) {
  const guard = async (req, res, bucket, perMinute) => {
    const remoteIp = req.socket.remoteAddress;
    const forwardedIp = process.env.K_SERVICE ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "";
    const isLocalLoopback = deps.isDev && deps.isLoopbackAddress(remoteIp) && !forwardedIp;
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const user = token ? await deps.verifyFirebaseIdToken(token, isLocalLoopback) : null;
    if (!user && !isLocalLoopback) {
      res.status(401).json({ ok: false, error: "Oturum do\u011Frulanamad\u0131. L\xFCtfen tekrar giri\u015F yap\u0131n." });
      return null;
    }
    const key = user ? `${bucket}:${user.uid}` : `${bucket}_ip:${forwardedIp || remoteIp || "unknown"}`;
    if (!deps.checkRateLimit(key, perMinute, 6e4)) {
      res.status(429).json({ ok: false, error: "\xC7ok fazla istek g\xF6nderildi, bir dakika bekleyin." });
      return null;
    }
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password || username.length > 120 || password.length > 200) {
      res.status(400).json({ ok: false, error: "EDM kullan\u0131c\u0131 ad\u0131 ve \u015Fifresi gereklidir (Ayarlar sekmesi)." });
      return null;
    }
    const env = req.body?.environment === "LIVE" ? "LIVE" : "TEST";
    return { username, password, env };
  };
  const fail = (res, err) => {
    if (err instanceof EdmError) return res.json({ ok: false, error: err.message, errorCode: err.code });
    return res.status(502).json({
      ok: false,
      error: err?.name === "AbortError" ? "EDM sunucusu zaman\u0131nda yan\u0131t vermedi." : "EDM sunucusuna ula\u015F\u0131lamad\u0131."
    });
  };
  app.post("/api/edm/test-connection", async (req, res) => {
    const g = await guard(req, res, "edm", 6);
    if (!g) return;
    try {
      await withSession(g.env, g.username, g.password, "MKS baglanti testi", async () => true);
      res.json({ ok: true, environment: g.env, message: g.env === "LIVE" ? "EDM canl\u0131 ortam\u0131na giri\u015F ba\u015Far\u0131l\u0131." : "EDM test ortam\u0131na giri\u015F ba\u015Far\u0131l\u0131." });
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
      const text = await withSession(g.env, g.username, g.password, "MKS mukellef sorgusu", async (sid) => {
        const r = await soap(g.env, "CheckUserRequest", `${requestHeader(sid, "MKS mukellef sorgusu")}<USER xmlns=""><IDENTIFIER>${identifier}</IDENTIFIER></USER>`);
        if (!r.ok) throw faultOf(r.text, "M\xFCkellef sorgusu ba\u015Far\u0131s\u0131z.");
        return r.text;
      });
      const users = [...text.matchAll(/<USER[^>]*>([\s\S]*?)<\/USER>/g)].map((m) => ({ alias: pick(m[1], "ALIAS"), title: pick(m[1], "TITLE"), unit: pick(m[1], "UNIT") }));
      const inbox = users.filter((u) => u.unit === "PK" && u.alias);
      res.json({ ok: true, environment: g.env, isEInvoiceUser: inbox.length > 0, title: (inbox[0] || users[0])?.title || "", aliases: inbox.map((u) => u.alias).slice(0, 10) });
    } catch (err) {
      fail(res, err);
    }
  });
  app.post("/api/edm/send-invoice", async (req, res) => {
    const g = await guard(req, res, "edmsend", 12);
    if (!g) return;
    const inv = req.body?.invoice;
    const invalid = validateInvoice(inv);
    if (invalid) return res.status(400).json({ ok: false, error: invalid });
    try {
      const ubl = buildUblInvoice(inv);
      const isArchive = inv.docType === "EARSIV";
      const senderVkn = String(inv.sender.taxNo).replace(/\D/g, "");
      const receiverVkn = String(inv.receiver.taxNo).replace(/\D/g, "");
      const text = await withSession(g.env, g.username, g.password, "MKS fatura gonderimi", async (sid) => {
        const r = await soap(
          g.env,
          "SendInvoiceRequest",
          `${requestHeader(sid, "MKS fatura gonderimi")}<SENDER xmlns="" vkn="${senderVkn}" alias=""/><RECEIVER xmlns="" vkn="${receiverVkn}" alias="${isArchive ? "" : esc(inv.receiverAlias || "")}"/><INVOICE xmlns="" TRXID="0"><HEADER><INTERNETSALES>false</INTERNETSALES><EARCHIVE>${isArchive}</EARCHIVE></HEADER><CONTENT>${Buffer.from(ubl.xml, "utf8").toString("base64")}</CONTENT></INVOICE>`,
          9e4
        );
        if (!r.ok) throw faultOf(r.text, "Fatura g\xF6nderilemedi.");
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
  app.post("/api/edm/invoices", async (req, res) => {
    const g = await guard(req, res, "edmlist", 15);
    if (!g) return;
    const direction = req.body?.direction === "OUT" ? "OUT" : "IN";
    const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const end = isDate(req.body?.endDate) ? req.body.endDate : new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    const start = isDate(req.body?.startDate) ? req.body.startDate : new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    try {
      const text = await withSession(g.env, g.username, g.password, "MKS fatura listesi", async (sid) => {
        const r = await soap(
          g.env,
          "GetInvoiceRequest",
          `${requestHeader(sid, "MKS fatura listesi")}<INVOICE_SEARCH_KEY xmlns=""><LIMIT>100</LIMIT><START_DATE>${start}</START_DATE><END_DATE>${end}</END_DATE><READ_INCLUDED>true</READ_INCLUDED><DIRECTION>${direction}</DIRECTION></INVOICE_SEARCH_KEY><HEADER_ONLY xmlns="">Y</HEADER_ONLY>`,
          9e4
        );
        if (!r.ok) throw faultOf(r.text, "Fatura listesi al\u0131namad\u0131.");
        return r.text;
      });
      res.json({ ok: true, environment: g.env, direction, startDate: start, endDate: end, invoices: parseInvoices(text) });
    } catch (err) {
      fail(res, err);
    }
  });
  app.post("/api/edm/cancel-invoice", async (req, res) => {
    const g = await guard(req, res, "edmcancel", 10);
    if (!g) return;
    const uuid = String(req.body?.uuid || "").trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(uuid)) return res.status(400).json({ ok: false, error: "Ge\xE7ersiz fatura kimli\u011Fi." });
    try {
      await withSession(g.env, g.username, g.password, "MKS fatura iptali", async (sid) => {
        const r = await soap(g.env, "CancelInvoiceRequest", `${requestHeader(sid, "MKS fatura iptali")}<INVOICE TRXID="0" UUID="${uuid}" xmlns=""/>`, 9e4);
        if (!r.ok) throw faultOf(r.text, "Fatura iptal edilemedi.");
        return r.text;
      });
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });
  app.post("/api/edm/respond-invoice", async (req, res) => {
    const g = await guard(req, res, "edmresp", 10);
    if (!g) return;
    const invoiceId = String(req.body?.invoiceId || "").trim();
    if (!/^[A-Za-z0-9]{16}$/.test(invoiceId)) return res.status(400).json({ ok: false, error: "Ge\xE7ersiz fatura numaras\u0131." });
    const status = req.body?.accept === true ? "KABUL" : "RED";
    try {
      await withSession(g.env, g.username, g.password, "MKS fatura yaniti", async (sid) => {
        const r = await soap(
          g.env,
          "SendInvoiceResponseWithServerSignRequest",
          `${requestHeader(sid, "MKS fatura yaniti")}<STATUS xmlns="">${status}</STATUS><INVOICE TRXID="0" ID="${invoiceId}" xmlns=""/>`,
          9e4
        );
        if (!r.ok) throw faultOf(r.text, "Yan\u0131t g\xF6nderilemedi.");
        return r.text;
      });
      res.json({ ok: true, status });
    } catch (err) {
      fail(res, err);
    }
  });
  app.post("/api/edm/invoice-detail", async (req, res) => {
    const g = await guard(req, res, "edmdet", 20);
    if (!g) return;
    const uuid = String(req.body?.uuid || "").trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(uuid)) return res.status(400).json({ ok: false, error: "Ge\xE7ersiz fatura kimli\u011Fi." });
    const direction = req.body?.direction === "OUT" ? "OUT" : "IN";
    try {
      const text = await withSession(g.env, g.username, g.password, "MKS fatura icerigi", async (sid) => {
        const r = await soap(
          g.env,
          "GetInvoiceRequest",
          `${requestHeader(sid, "MKS fatura icerigi")}<INVOICE_SEARCH_KEY xmlns=""><UUID>${uuid}</UUID><READ_INCLUDED>true</READ_INCLUDED><DIRECTION>${direction}</DIRECTION></INVOICE_SEARCH_KEY><HEADER_ONLY xmlns="">N</HEADER_ONLY><INVOICE_CONTENT_TYPE xmlns="">XML</INVOICE_CONTENT_TYPE>`,
          9e4
        );
        if (!r.ok) throw faultOf(r.text, "Fatura getirilemedi.");
        return r.text;
      });
      const b64 = (text.match(/<CONTENT[^>]*>([^<]+)<\/CONTENT>/) || [])[1] || "";
      const xml = b64 ? Buffer.from(b64, "base64").toString("utf8") : "";
      if (!xml.includes("Invoice")) return res.json({ ok: false, error: "Fatura i\xE7eri\u011Fi okunamad\u0131." });
      const d = parseUbl(xml);
      res.json({ ok: true, ...d, invoiceNo: d.invoiceNo || parseInvoices(text)[0]?.id || "" });
    } catch (err) {
      fail(res, err);
    }
  });
  app.post("/api/edm/invoice-html", async (req, res) => {
    const g = await guard(req, res, "edmhtml", 20);
    if (!g) return;
    const uuid = String(req.body?.uuid || "").trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(uuid)) return res.status(400).json({ ok: false, error: "Ge\xE7ersiz fatura kimli\u011Fi." });
    const direction = req.body?.direction === "OUT" ? "OUT" : "IN";
    try {
      const text = await withSession(g.env, g.username, g.password, "MKS fatura goruntuleme", async (sid) => {
        const r = await soap(
          g.env,
          "GetInvoiceRequest",
          `${requestHeader(sid, "MKS fatura goruntuleme")}<INVOICE_SEARCH_KEY xmlns=""><UUID>${uuid}</UUID><READ_INCLUDED>true</READ_INCLUDED><DIRECTION>${direction}</DIRECTION></INVOICE_SEARCH_KEY><HEADER_ONLY xmlns="">N</HEADER_ONLY><INVOICE_CONTENT_TYPE xmlns="">HTML</INVOICE_CONTENT_TYPE>`,
          9e4
        );
        if (!r.ok) throw faultOf(r.text, "Fatura getirilemedi.");
        return r.text;
      });
      const b64 = (text.match(/<CONTENT[^>]*>([^<]+)<\/CONTENT>/) || [])[1] || "";
      if (!b64) return res.json({ ok: false, error: "Fatura i\xE7eri\u011Fi bulunamad\u0131." });
      res.json({ ok: true, html: Buffer.from(b64, "base64").toString("utf8") });
    } catch (err) {
      fail(res, err);
    }
  });
}

// server.ts
var import_cors = __toESM(require("cors"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_genai = require("@google/genai");

// server/copernicusService.ts
var import_bbox = __toESM(require("@turf/bbox"), 1);
var import_area = __toESM(require("@turf/area"), 1);
var CDSE_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
var CDSE_CATALOG_URL = "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search";
var CDSE_PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process";
var cachedAccessToken = null;
var cachedTokenExpiresAtMs = 0;
function isCopernicusConfigured() {
  const clientId = (process.env.CDSE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.CDSE_CLIENT_SECRET || "").trim();
  return clientId.length > 8 && clientSecret.length > 8 && !clientId.includes("BURAYA_") && !clientSecret.includes("BURAYA_");
}
async function getCdseAccessToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedAccessToken && now < cachedTokenExpiresAtMs - 45e3) {
    return cachedAccessToken;
  }
  const clientId = (process.env.CDSE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.CDSE_CLIENT_SECRET || "").trim();
  if (!isCopernicusConfigured()) {
    throw Object.assign(
      new Error(
        "Copernicus API anahtarlar\u0131 (.env -> CDSE_CLIENT_ID / CDSE_CLIENT_SECRET) hen\xFCz tan\u0131mlanmam\u0131\u015F."
      ),
      { code: "CDSE_MISSING_CREDENTIALS", status: 503 }
    );
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret
  });
  const resp = await fetch(CDSE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });
  if (!resp.ok) {
    throw Object.assign(
      new Error(`Copernicus OAuth2 kimlik do\u011Frulamas\u0131 ba\u015Far\u0131s\u0131z (HTTP ${resp.status}).`),
      { code: "CDSE_AUTH_FAILED", status: 502 }
    );
  }
  const data = await resp.json();
  if (!data?.access_token) {
    throw Object.assign(new Error("Copernicus token yan\u0131t\u0131 ge\xE7ersiz."), {
      code: "CDSE_INVALID_TOKEN",
      status: 502
    });
  }
  const expiresInSec = Number(data.expires_in) || 600;
  cachedAccessToken = String(data.access_token);
  cachedTokenExpiresAtMs = now + expiresInSec * 1e3;
  return cachedAccessToken;
}
var EVALSCRIPT_NDVI_V3 = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask === 0) {
    return [0, 0, 0, 0];
  }
  const scl = sample.SCL;
  if (scl === 3 || scl === 8 || scl === 9 || scl === 10) {
    return [0.55, 0.58, 0.62, 0.55];
  }
  const denom = sample.B08 + sample.B04;
  const ndvi = denom === 0 ? 0 : (sample.B08 - sample.B04) / denom;

  if (ndvi < 0.20) {
    return [0.86, 0.18, 0.18, 0.88]; // K\u0131rm\u0131z\u0131: \xC7\u0131plak toprak / \u015Eiddetli stres
  } else if (ndvi < 0.40) {
    return [0.95, 0.68, 0.12, 0.88]; // Turuncu-Sar\u0131: Geli\u015Fim gerili\u011Fi
  } else if (ndvi < 0.60) {
    return [0.38, 0.82, 0.28, 0.88]; // A\xE7\u0131k Ye\u015Fil: Orta geli\u015Fim
  } else {
    return [0.06, 0.52, 0.22, 0.92]; // Koyu Ye\u015Fil: Sa\u011Fl\u0131kl\u0131 ve g\xFCr bitki \xF6rt\xFCs\xFC
  }
}`;
var EVALSCRIPT_NDMI_V3 = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B8A", "B11", "SCL", "dataMask"] }],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask === 0) {
    return [0, 0, 0, 0];
  }
  const scl = sample.SCL;
  if (scl === 3 || scl === 8 || scl === 9 || scl === 10) {
    return [0.55, 0.58, 0.62, 0.55];
  }
  const denom = sample.B8A + sample.B11;
  const ndmi = denom === 0 ? 0 : (sample.B8A - sample.B11) / denom;

  if (ndmi < -0.10) {
    return [0.91, 0.28, 0.12, 0.88]; // K\u0131rm\u0131z\u0131-Turuncu: Kuru / Ciddi su stresi
  } else if (ndmi < 0.10) {
    return [0.96, 0.78, 0.15, 0.88]; // Sar\u0131: Nem azal\u0131yor / Sulama zaman\u0131 yakla\u015F\u0131yor
  } else if (ndmi < 0.30) {
    return [0.22, 0.72, 0.96, 0.88]; // A\xE7\u0131k Mavi: Dengeli nem / Yeni sulanm\u0131\u015F
  } else {
    return [0.09, 0.32, 0.82, 0.92]; // Koyu Mavi: Y\xFCksek su doygunlu\u011Fu
  }
}`;
var EVALSCRIPT_WETNESS_V3 = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B03", "B8A", "B11", "B12", "SCL", "dataMask"] }],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask === 0) {
    return [0, 0, 0, 0];
  }
  const scl = sample.SCL;
  if (scl === 3 || scl === 8 || scl === 9 || scl === 10) {
    return [0.55, 0.58, 0.62, 0.55];
  }

  const mndwiDenom = sample.B03 + sample.B11;
  const mndwi = mndwiDenom === 0 ? -1 : (sample.B03 - sample.B11) / mndwiDenom;

  const swirDenom = sample.B8A + sample.B12;
  const swirMoisture = swirDenom === 0 ? -1 : (sample.B8A - sample.B12) / swirDenom;

  // 1. G\xF6llenme / Su Birikintisi
  if (mndwi > 0.10 || scl === 6) {
    return [0.42, 0.16, 0.85, 0.92]; // Mor / Lacivert: Su Birikintisi / G\xF6llenme
  }

  // 2. \xC7amur Riski / A\u015F\u0131r\u0131 Islak Y\xFCzey (Trakt\xF6r Batabilir)
  if (swirMoisture > 0.28 && sample.B12 < 0.13) {
    return [0.02, 0.52, 0.78, 0.90]; // Koyu Mavi / Camg\xF6be\u011Fi: Islak / \xC7amur Riski
  }

  // 3. Tav\u0131nda / Nemli Toprak
  if (swirMoisture >= 0.10 && swirMoisture <= 0.28) {
    return [0.08, 0.72, 0.58, 0.88]; // Turkuaz-Ye\u015Fil: Tav\u0131nda / Nemli
  }

  // 4. Kuru Toprak (B12 >= 0.24 ve d\xFC\u015F\xFCk nem indeksi veya kalan kuru y\xFCzey)
  if (sample.B12 >= 0.24 && swirMoisture < 0.10) {
    return [0.76, 0.48, 0.18, 0.88]; // Toprak Kahverengisi / Kehribar: Kuru Toprak
  }

  return [0.82, 0.58, 0.26, 0.85]; // Hafif Kuru Y\xFCzey
}`;
async function findLatestSentinel2Pass(geometry, token, lookbackDays = 30) {
  const now = /* @__PURE__ */ new Date();
  const from = new Date(now.getTime() - lookbackDays * 864e5);
  const datetimeInterval = `${from.toISOString()}/${now.toISOString()}`;
  const searchCatalog = async (maxCloud) => {
    const payload = {
      collections: ["sentinel-2-l2a"],
      datetime: datetimeInterval,
      intersects: geometry,
      limit: 20,
      filter: {
        op: "<=",
        args: [{ property: "eo:cloud_cover" }, maxCloud]
      },
      "filter-lang": "cql2-json"
    };
    const res = await fetch(CDSE_CATALOG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const plainRes = await fetch(CDSE_CATALOG_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          collections: ["sentinel-2-l2a"],
          datetime: datetimeInterval,
          intersects: geometry,
          limit: 30
        })
      });
      if (!plainRes.ok) {
        throw Object.assign(
          new Error(`Uydu katalo\u011Fu sorgulanamad\u0131 (HTTP ${plainRes.status}).`),
          { code: "CDSE_CATALOG_ERROR", status: 502 }
        );
      }
      const plainData = await plainRes.json();
      const features2 = Array.isArray(plainData?.features) ? plainData.features : [];
      return features2.filter(
        (f) => Number(f?.properties?.["eo:cloud_cover"] ?? 100) <= maxCloud
      );
    }
    const data = await res.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    return features.filter(
      (f) => Number(f?.properties?.["eo:cloud_cover"] ?? 100) <= maxCloud
    );
  };
  let candidates = await searchCatalog(20);
  let usedFallbackCloudThreshold = false;
  if (candidates.length === 0) {
    usedFallbackCloudThreshold = true;
    candidates = await searchCatalog(45);
  }
  if (candidates.length === 0) {
    throw Object.assign(
      new Error(
        "Son 30 g\xFCn i\xE7inde bu parsel \xFCzerinde bulutsuz/uygun Sentinel-2 uydu ge\xE7i\u015Fi bulunamad\u0131."
      ),
      { code: "NO_CLEAR_SATELLITE_PASS", status: 404 }
    );
  }
  candidates.sort((a, b) => {
    const ta = new Date(a?.properties?.datetime || 0).getTime();
    const tb = new Date(b?.properties?.datetime || 0).getTime();
    return tb - ta;
  });
  const best = candidates[0];
  return {
    sceneId: String(best.id || "sentinel-2-l2a"),
    captureDatetime: String(best.properties?.datetime || (/* @__PURE__ */ new Date()).toISOString()),
    cloudCover: Math.round(Number(best.properties?.["eo:cloud_cover"] ?? 0) * 10) / 10,
    usedFallbackCloudThreshold
  };
}
async function renderProcessLayerBase64(geometry, captureDatetime, maxCloudCoverage, evalscript, width, height, token) {
  const parsedCaptureMs = new Date(captureDatetime).getTime();
  let fromIso;
  let toIso;
  if (Number.isFinite(parsedCaptureMs)) {
    fromIso = new Date(parsedCaptureMs - 30 * 6e4).toISOString();
    toIso = new Date(parsedCaptureMs + 30 * 6e4).toISOString();
  } else {
    const captureDay = captureDatetime.slice(0, 10);
    fromIso = `${captureDay}T00:00:00Z`;
    toIso = `${captureDay}T23:59:59Z`;
  }
  const body = {
    input: {
      bounds: {
        geometry,
        properties: {
          crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
        }
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: fromIso,
              to: toIso
            },
            maxCloudCoverage: Math.min(100, Math.max(20, Math.ceil(maxCloudCoverage + 5))),
            mosaickingOrder: "leastCC"
          }
        }
      ]
    },
    output: {
      width,
      height,
      responses: [
        {
          identifier: "default",
          format: {
            type: "image/png"
          }
        }
      ]
    },
    evalscript
  };
  const resp = await fetch(CDSE_PROCESS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "image/png",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    throw Object.assign(
      new Error(`Sentinel Process API g\xF6r\xFCnt\xFC \xFCretemedi (HTTP ${resp.status}).`),
      { code: "CDSE_PROCESS_ERROR", status: 502 }
    );
  }
  const arrayBuffer = await resp.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:image/png;base64,${base64}`;
}
async function analyzeFieldPolygonSatellite(rawGeoJson) {
  const geom = rawGeoJson?.type === "Feature" ? rawGeoJson.geometry : rawGeoJson;
  if (!geom || geom.type !== "Polygon" || !Array.isArray(geom.coordinates) || !Array.isArray(geom.coordinates[0]) || geom.coordinates[0].length < 4) {
    throw Object.assign(
      new Error("Ge\xE7erli bir WGS84 (EPSG:4326) tarla poligonu g\xF6nderilmelidir (en az 3 k\xF6\u015Fe)."),
      { code: "INVALID_POLYGON", status: 400 }
    );
  }
  const feature = { type: "Feature", properties: {}, geometry: geom };
  const areaM2 = (0, import_area.default)(feature);
  if (areaM2 < 100) {
    throw Object.assign(
      new Error("\xC7izilen poligon \xE7ok k\xFC\xE7\xFCk (en az 0.1 dekar olmal\u0131d\u0131r)."),
      { code: "POLYGON_TOO_SMALL", status: 400 }
    );
  }
  if (areaM2 > 5e7) {
    throw Object.assign(
      new Error("Tek seferde en fazla 50.000 dekar b\xFCy\xFCkl\xFC\u011F\xFCnde parsel analiz edilebilir."),
      { code: "POLYGON_TOO_LARGE", status: 400 }
    );
  }
  const rawBbox = (0, import_bbox.default)(feature);
  const typedBbox = [
    Number(rawBbox[0].toFixed(7)),
    Number(rawBbox[1].toFixed(7)),
    Number(rawBbox[2].toFixed(7)),
    Number(rawBbox[3].toFixed(7))
  ];
  const dekar = Math.round(areaM2 / 1e3 * 100) / 100;
  const lonSpan = Math.max(2e-4, typedBbox[2] - typedBbox[0]);
  const latSpan = Math.max(2e-4, typedBbox[3] - typedBbox[1]);
  const midLatRad = (typedBbox[1] + typedBbox[3]) / 2 * Math.PI / 180;
  const metricRatio = lonSpan * Math.cos(midLatRad) / latSpan;
  let width = 512;
  let height = 512;
  if (metricRatio >= 1) {
    width = 640;
    height = Math.max(256, Math.min(640, Math.round(640 / metricRatio)));
  } else {
    height = 640;
    width = Math.max(256, Math.min(640, Math.round(640 * metricRatio)));
  }
  const token = await getCdseAccessToken(false);
  const pass = await findLatestSentinel2Pass(geom, token, 30);
  const [ndviPngDataUrl, ndmiPngDataUrl, wetnessPngDataUrl] = await Promise.all([
    renderProcessLayerBase64(geom, pass.captureDatetime, pass.cloudCover, EVALSCRIPT_NDVI_V3, width, height, token),
    renderProcessLayerBase64(geom, pass.captureDatetime, pass.cloudCover, EVALSCRIPT_NDMI_V3, width, height, token),
    renderProcessLayerBase64(geom, pass.captureDatetime, pass.cloudCover, EVALSCRIPT_WETNESS_V3, width, height, token)
  ]);
  return {
    captureDatetime: pass.captureDatetime,
    cloudCover: pass.cloudCover,
    sceneId: pass.sceneId,
    usedFallbackCloudThreshold: pass.usedFallbackCloudThreshold,
    bbox: typedBbox,
    dekar,
    layers: {
      ndviPngDataUrl,
      ndmiPngDataUrl,
      wetnessPngDataUrl
    }
  };
}
async function lookupTkgmParcelByCoord(lat, lng) {
  const cleanLat = Number(lat.toFixed(6));
  const cleanLng = Number(lng.toFixed(6));
  const tkgmEndpoints = [
    `https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/parsel/${cleanLat}/${cleanLng}/`,
    `https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api/parsel/${cleanLat}/${cleanLng}/`
  ];
  for (const url of tkgmEndpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "MKS-MuhendisKayitSistemi/4.0"
        },
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const props = data?.properties || data;
        if (props && (props.parselNo || props.ParselNo || props.adaNo || props.ilAd)) {
          let alanM2 = Number(
            String(props.alan || props.Alan || "0").replace(/\./g, "").replace(",", ".")
          );
          if ((!alanM2 || isNaN(alanM2)) && data?.geometry) {
            try {
              alanM2 = (0, import_area.default)({ type: "Feature", properties: {}, geometry: data.geometry });
            } catch {
              alanM2 = 0;
            }
          }
          return {
            source: "TKGM_CBS",
            il: props.ilAd || props.Il || "",
            ilce: props.ilceAd || props.Ilce || "",
            mahalle: props.mahalleAd || props.Mahalle || "",
            ada: String(props.adaNo ?? props.Ada ?? "0"),
            parsel: String(props.parselNo ?? props.ParselNo ?? ""),
            alanM2: Math.round(alanM2 * 100) / 100,
            alanDekar: Math.round(alanM2 / 1e3 * 100) / 100,
            nitelik: props.nitelik || props.Nitelik || "Tarla / Arazi",
            mevkii: props.mevkii || props.Mevkii || "",
            pafta: props.pafta || props.Pafta || "",
            ozet: props.ozet || "",
            lat: cleanLat,
            lng: cleanLng,
            geometry: data?.geometry || null
          };
        }
      }
    } catch {
    }
  }
  try {
    const delta = 5e-4;
    const bboxStr = `${cleanLng - delta},${cleanLat - delta},${cleanLng + delta},${cleanLat + delta}`;
    const wmsUrl = `https://megsiswms.tkgm.gov.tr/tkgm.mahalli/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=TKGM.MAHALLI.PARSEL&QUERY_LAYERS=TKGM.MAHALLI.PARSEL&SRS=EPSG:4326&BBOX=${bboxStr}&WIDTH=101&HEIGHT=101&X=50&Y=50&INFO_FORMAT=application/json`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    const wmsRes = await fetch(wmsUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (wmsRes.ok) {
      const wmsJson = await wmsRes.json().catch(() => null);
      const feat = wmsJson?.features?.[0];
      if (feat?.properties) {
        const p = feat.properties;
        let alanM2 = Number(
          String(p.ALAN || p.alan || "0").replace(/\./g, "").replace(",", ".")
        );
        if ((!alanM2 || isNaN(alanM2)) && feat.geometry) {
          try {
            alanM2 = (0, import_area.default)(feat);
          } catch {
            alanM2 = 0;
          }
        }
        return {
          source: "TKGM_WMS",
          il: p.ILAD || p.ilAd || "",
          ilce: p.ILCEAD || p.ilceAd || "",
          mahalle: p.MAHALLEAD || p.mahalleAd || "",
          ada: String(p.ADANO ?? p.adaNo ?? "-"),
          parsel: String(p.PARSELNO ?? p.parselNo ?? "-"),
          alanM2: Math.round(alanM2 * 100) / 100,
          alanDekar: Math.round(alanM2 / 1e3 * 100) / 100,
          nitelik: p.NITELIK || p.nitelik || "Tar\u0131m Arazisi",
          mevkii: p.MEVKII || p.mevkii || "",
          pafta: p.PAFTA || p.pafta || "",
          lat: cleanLat,
          lng: cleanLng,
          geometry: feat.geometry || null
        };
      }
    }
  } catch {
  }
  let il = "";
  let ilce = "";
  let mahalle = "";
  let displayName = "";
  try {
    const nomController = new AbortController();
    const nomTimer = setTimeout(() => nomController.abort(), 8e3);
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${cleanLat}&lon=${cleanLng}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "MKS-MuhendisKayitSistemi/4.0",
          "Accept-Language": "tr"
        },
        signal: nomController.signal
      }
    );
    clearTimeout(nomTimer);
    if (nomRes.ok) {
      const nom = await nomRes.json();
      const addr = nom?.address || {};
      il = addr.province || addr.state || "";
      ilce = addr.town || addr.county || addr.city_district || addr.municipality || "";
      mahalle = addr.village || addr.suburb || addr.neighbourhood || addr.hamlet || "";
      displayName = nom?.display_name || "";
    }
  } catch {
  }
  return {
    source: "KONUM_IDARI",
    il,
    ilce,
    mahalle,
    ada: "",
    parsel: "",
    alanM2: 0,
    alanDekar: 0,
    nitelik: "Tar\u0131m Alan\u0131 (\u0130dari Konum Do\u011Fruland\u0131)",
    mevkii: displayName,
    pafta: "",
    lat: cleanLat,
    lng: cleanLng,
    geometry: null,
    note: "TKGM anl\u0131k servis h\u0131z s\u0131n\u0131r\u0131nda oldu\u011Fu i\xE7in idari mahalle/k\xF6y bilgisi getirildi. 'Parselleri \xC7iz' katman\u0131n\u0131 a\xE7arak parsel s\u0131n\u0131rlar\u0131n\u0131 harita \xFCst\xFCnde g\xF6rebilir ve tek t\u0131kla \xE7izebilirsiniz."
  };
}

// server.ts
import_dotenv.default.config();
var lastEnvMtimeMs = 0;
function reloadDotenvIfChanged() {
  try {
    const envPath = import_path.default.join(process.cwd(), ".env");
    const stat = import_fs.default.statSync(envPath);
    if (stat.mtimeMs > lastEnvMtimeMs) {
      lastEnvMtimeMs = stat.mtimeMs;
      import_dotenv.default.config({ override: true });
    }
  } catch {
  }
}
var FIREBASE_PROJECT_ID = (process.env.FIREBASE_PROJECT_ID || "muhendiskayitsistemi").trim();
var GOOGLE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
var cachedCerts = null;
var certsExpiresAt = 0;
async function getFirebasePublicCerts(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && now < certsExpiresAt) {
    return cachedCerts;
  }
  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Google X509 sertifikalar\u0131 al\u0131namad\u0131 (${res.status})`);
  }
  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1e3 : 36e5;
  cachedCerts = await res.json();
  certsExpiresAt = now + ttlMs;
  return cachedCerts;
}
async function verifyFirebaseIdToken(idToken, allowOfflineDevFallback) {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;
    const nowSec = Math.floor(Date.now() / 1e3);
    if (payload.aud !== FIREBASE_PROJECT_ID) return null;
    if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
    if (typeof payload.sub !== "string" || payload.sub.length === 0 || payload.sub.length > 128) return null;
    if (typeof payload.exp !== "number" || payload.exp < nowSec - 30) return null;
    if (typeof payload.iat !== "number" || payload.iat > nowSec + 60) return null;
    try {
      let certs = await getFirebasePublicCerts(false);
      let certPem = certs[header.kid];
      if (!certPem) {
        certs = await getFirebasePublicCerts(true);
        certPem = certs[header.kid];
      }
      if (!certPem) return null;
      const verifier = import_crypto2.default.createVerify("RSA-SHA256");
      verifier.update(`${headerB64}.${payloadB64}`);
      verifier.end();
      const signatureValid = verifier.verify(certPem, Buffer.from(sigB64, "base64url"));
      if (!signatureValid) return null;
    } catch (certErr) {
      if (!allowOfflineDevFallback) {
        console.error("Firebase JWT sertifika do\u011Frulama hatas\u0131:", certErr);
        return null;
      }
    }
    return {
      uid: payload.sub,
      email: typeof payload.email === "string" ? payload.email : void 0
    };
  } catch {
    return null;
  }
}
function isLoopbackAddress(addr) {
  if (!addr) return false;
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}
function buildCorsOptions() {
  const customOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const staticAllowed = /* @__PURE__ */ new Set([
    "capacitor://localhost",
    "ionic://localhost",
    "http://localhost",
    "https://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "https://m-hendis-kay-t-sistemi-65385039239.europe-west3.run.app",
    `https://${FIREBASE_PROJECT_ID}.web.app`,
    `https://${FIREBASE_PROJECT_ID}.firebaseapp.com`,
    ...customOrigins
  ]);
  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (staticAllowed.has(origin)) return callback(null, true);
      if (/^https:\/\/m-hendis-kay-t-sistemi-[a-z0-9.-]+\.run\.app$/i.test(origin)) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV !== "production" && /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS origin izinli de\u011Fil"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  };
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = process.env.K_SERVICE ? Number(process.env.PORT) || 8080 : 3e3;
  const isDev = process.env.NODE_ENV !== "production";
  app.use(import_express.default.json({ limit: "12mb" }));
  app.use((0, import_cors.default)(buildCorsOptions()));
  const rateLimitMap = /* @__PURE__ */ new Map();
  const checkRateLimit = (bucketKey, maxRequests = 25, windowMs = 6e4) => {
    const now = Date.now();
    if (rateLimitMap.size > 5e3) {
      for (const [k, v] of rateLimitMap.entries()) {
        if (now > v.resetTime) rateLimitMap.delete(k);
      }
    }
    const record = rateLimitMap.get(bucketKey);
    if (!record || now > record.resetTime) {
      rateLimitMap.set(bucketKey, { count: 1, resetTime: now + windowMs });
      return true;
    }
    if (record.count >= maxRequests) return false;
    record.count += 1;
    return true;
  };
  app.post("/api/generate", async (req, res) => {
    const remoteIp = req.socket.remoteAddress;
    const forwardedIp = process.env.K_SERVICE ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "";
    const clientIp = forwardedIp || remoteIp || "unknown";
    const isLocalLoopback = isDev && isLoopbackAddress(remoteIp) && !forwardedIp;
    const authHeader = String(req.headers.authorization || "");
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    let verifiedUser = null;
    if (bearerToken) {
      verifiedUser = await verifyFirebaseIdToken(bearerToken, isLocalLoopback);
    }
    if (!verifiedUser && !(isLocalLoopback && process.env.ALLOW_UNAUTH_LOCAL_AI === "true")) {
      return res.status(401).json({
        error: "Yapay zeka servisini kullanmak i\xE7in ge\xE7erli bir MKS oturumu gereklidir.",
        code: "UNAUTHORIZED"
      });
    }
    const rateKey = verifiedUser ? `uid:${verifiedUser.uid}` : `ip:${clientIp}`;
    if (!checkRateLimit(rateKey)) {
      return res.status(429).json({
        error: "\xC7ok fazla istek g\xF6nderildi. L\xFCtfen bir dakika bekleyip tekrar deneyin.",
        code: "RATE_LIMIT_EXCEEDED"
      });
    }
    try {
      const { model: modelName, contents, config } = req.body || {};
      if (!contents) {
        return res.status(400).json({ error: "\u0130\xE7erik (contents) alan\u0131 zorunludur.", code: "INVALID_PAYLOAD" });
      }
      const omniToken = (process.env.OMNIROUTE_TOKEN || "").trim();
      const omniUrl = (process.env.OMNIROUTE_URL || "http://127.0.0.1:20128/v1/chat/completions").trim();
      if (omniToken) {
        const messages = [];
        let hasImage = false;
        if (config?.systemInstruction) {
          const sysInst = config.systemInstruction;
          if (typeof sysInst === "string" && sysInst.trim()) {
            messages.push({ role: "system", content: sysInst.trim() });
          } else if (sysInst?.parts) {
            const txt = sysInst.parts.map((p) => p?.text || "").join("\n").trim();
            if (txt) messages.push({ role: "system", content: txt });
          }
        }
        const partsToOpenAI = (partsList) => {
          const oaParts = [];
          for (const p of partsList) {
            if (typeof p === "string") {
              oaParts.push({ type: "text", text: p });
            } else if (p && typeof p === "object") {
              if (p.text) {
                oaParts.push({ type: "text", text: String(p.text) });
              } else if (p.inlineData?.data) {
                hasImage = true;
                const b64 = String(p.inlineData.data).trim();
                const mime = String(p.inlineData.mimeType || "image/jpeg").trim();
                const url = b64.startsWith("data:") ? b64 : `data:${mime};base64,${b64}`;
                oaParts.push({ type: "image_url", image_url: { url } });
              }
            }
          }
          if (!hasImage && oaParts.length === 1 && oaParts[0].type === "text") {
            return oaParts[0].text;
          }
          return oaParts;
        };
        if (typeof contents === "string") {
          messages.push({ role: "user", content: contents });
        } else if (Array.isArray(contents)) {
          if (contents.length > 0 && (contents[0]?.parts || contents[0]?.role)) {
            for (const item of contents) {
              const role = item.role === "model" ? "assistant" : item.role || "user";
              messages.push({ role, content: item.parts ? partsToOpenAI(item.parts) : item.content });
            }
          } else {
            messages.push({ role: "user", content: partsToOpenAI(contents) });
          }
        } else if (contents && typeof contents === "object") {
          const role = contents.role === "model" ? "assistant" : contents.role || "user";
          messages.push({ role, content: partsToOpenAI(contents.parts || [contents]) });
        }
        const candidateModels = hasImage ? ["gemini/gemini-3-flash-preview", "gemini/gemini-3.7-flash", "gemini/gemini-3.1-pro-preview"] : ["gemini/gemini-3-flash-preview", "auto/best-fast", "free", "video-metin"];
        for (const mName of candidateModels) {
          try {
            const omniResp = await fetch(omniUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${omniToken}`
              },
              body: JSON.stringify({
                model: mName,
                messages,
                temperature: 0.35,
                max_tokens: 2200
              })
            });
            if (omniResp.ok) {
              const omniData = await omniResp.json();
              const replyText = (omniData?.choices?.[0]?.message?.content || "").trim();
              if (replyText) {
                return res.json({ text: replyText, model: mName });
              }
            }
          } catch {
          }
        }
      }
      const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "").trim();
      if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey.length < 10) {
        return res.status(500).json({
          error: "Yapay zeka servisine ula\u015F\u0131lamad\u0131 (OmniRoute veya GEMINI_API_KEY aktif de\u011Fil).",
          code: "MISSING_API_KEY"
        });
      }
      const ai = new import_genai.GoogleGenAI({ apiKey });
      let normalizedContents = contents;
      if (Array.isArray(contents) && contents.length > 0 && !contents[0].parts && !contents[0].role) {
        normalizedContents = { role: "user", parts: contents };
      }
      const response = await ai.models.generateContent({
        model: modelName || "gemini-3-flash-preview",
        contents: normalizedContents,
        config
      });
      const text = typeof response.text === "function" ? await response.text() : response.text;
      res.json({ text: String(text || "") });
    } catch (error) {
      const safeMessage = error?.message || "Bilinmeyen bir hata olu\u015Ftu";
      const safeCode = error?.code || "AI_GENERATION_FAILED";
      console.error("AI Sunucu Hatas\u0131:", safeMessage);
      res.status(500).json({
        error: String(safeMessage),
        code: String(safeCode)
      });
    }
  });
  app.get("/api/version", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const fallbackVersion = {
      version: "8.2.1",
      build: 28,
      desktopVersion: "8.2.1.0",
      desktopBuild: 28,
      desktopDownloadUrl: "/downloads/MKS_Masaustu_Kurulum.exe",
      androidDownloadUrl: "/downloads/MKS_Android.apk",
      releasedAt: "2026-11-11",
      title: "MKS v8.2.1 Masa\xFCst\xFC Canl\u0131 G\xFCncelleme & Kurumsal ERP Paketi",
      notes: "Masa\xFCst\xFC uygulamas\u0131 pencere kontrol \xE7ubu\u011Funa canl\u0131 g\xFCncelleme butonu, temel ERP vitrin \xF6nceli\u011Fi ve kurumsal marka paketi eklendi."
    };
    const candidatePaths = [
      import_path.default.join(process.cwd(), "dist", "version.json"),
      import_path.default.join(process.cwd(), "public", "version.json")
    ];
    for (const p of candidatePaths) {
      try {
        if (import_fs.default.existsSync(p)) {
          const parsed = JSON.parse(import_fs.default.readFileSync(p, "utf8"));
          if (parsed && typeof parsed === "object" && parsed.version) {
            return res.json({ ...fallbackVersion, ...parsed });
          }
        }
      } catch {
      }
    }
    res.json(fallbackVersion);
  });
  app.get("/api/check-ai", (_req, res) => {
    const hasConfiguredProvider = Boolean(
      (process.env.OMNIROUTE_TOKEN || "").trim() || (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "").trim()
    );
    res.json({
      status: hasConfiguredProvider ? "ready" : "unconfigured",
      authRequired: true,
      env: process.env.NODE_ENV || "development"
    });
  });
  registerEdmRoutes(app, { isDev, isLoopbackAddress, verifyFirebaseIdToken, checkRateLimit });
  app.post("/api/tkgm/parcel", async (req, res) => {
    const forwardedIp = process.env.K_SERVICE ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "";
    const clientIp = forwardedIp || req.socket.remoteAddress || "unknown";
    if (!checkRateLimit(`tkgm:${clientIp}`, 30, 6e4)) {
      return res.status(429).json({ error: "\xC7ok fazla parsel sorgusu g\xF6nderildi, l\xFCtfen bekleyin." });
    }
    try {
      const lat = Number(req.body?.lat);
      const lng = Number(req.body?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return res.status(400).json({ error: "Ge\xE7erli enlem ve boylam (lat, lng) gereklidir." });
      }
      const result = await lookupTkgmParcelByCoord(lat, lng);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({
        error: err?.message || "TKGM sorgusu s\u0131ras\u0131nda hata olu\u015Ftu."
      });
    }
  });
  app.get("/api/satellite/status", (_req, res) => {
    reloadDotenvIfChanged();
    res.json({
      configured: isCopernicusConfigured(),
      provider: "Copernicus Data Space Ecosystem (Sentinel-2 L2A)",
      layers: ["NDVI", "NDMI", "WETNESS"]
    });
  });
  app.post("/api/satellite/analyze", async (req, res) => {
    const remoteIp = req.socket.remoteAddress;
    const forwardedIp = process.env.K_SERVICE ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "";
    const clientIp = forwardedIp || remoteIp || "unknown";
    const isLocalLoopback = isDev && isLoopbackAddress(remoteIp) && !forwardedIp;
    const authHeader = String(req.headers.authorization || "");
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    let verifiedUser = null;
    if (bearerToken) {
      verifiedUser = await verifyFirebaseIdToken(bearerToken, isLocalLoopback);
    }
    if (!verifiedUser && !isLocalLoopback) {
      return res.status(401).json({
        error: "Uydu analizi i\xE7in ge\xE7erli bir MKS oturumu gereklidir.",
        code: "UNAUTHORIZED"
      });
    }
    const rateKey = verifiedUser ? `sat:${verifiedUser.uid}` : `sat_ip:${clientIp}`;
    if (!checkRateLimit(rateKey, 15, 6e4)) {
      return res.status(429).json({
        error: "Dakikada en fazla 15 uydu analizi iste\u011Fi g\xF6nderilebilir.",
        code: "RATE_LIMIT_EXCEEDED"
      });
    }
    try {
      reloadDotenvIfChanged();
      const polygonGeoJson = req.body?.polygonGeoJson || req.body?.geometry || req.body?.feature;
      const analysis = await analyzeFieldPolygonSatellite(polygonGeoJson);
      return res.json(analysis);
    } catch (err) {
      const status = Number(err?.status) || 500;
      return res.status(status).json({
        error: err?.message || "Uydu analizi olu\u015Fturulurken hata meydana geldi.",
        code: err?.code || "SATELLITE_ANALYSIS_FAILED"
      });
    }
  });
  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is listening on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
