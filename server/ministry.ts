/**
 * Tarım ve Orman Bakanlığı Resmi Servisler Köprüsü (BKTS · GTS · B-Reçete).
 * - Gürkom / Bilnex / EDM Bilişim ile aynı kurumsal web servis mimarisini uygular.
 * - Bayi şifresi ve Web Servis Key No sunucu loglarına veya veritabanına yazılmaz; yalnızca canlı istek anında kullanılır.
 * - Asla sahte başarı üretmez: HTTP / SOAP / JSON yanıtını şeffaf biçimde teşhis ve önizleme ile döner.
 */
import type { Express, Request, Response } from "express";
import crypto from "crypto";

export type MinistrySystem = "BKTS" | "GTS" | "BRECETE";
export type MinistryEnv = "LIVE" | "TEST";
export type BktsAction = "PaydasSorgula" | "AlimBildirimi" | "SatisBildirimi" | "SatisIptalBildirimi";
export type GtsAction = "GtsBaglantiTesti" | "GtsMalKabulBildirimi" | "GtsCiftciSatisBildirimi" | "GtsIadeBildirimi";
export type BReceteAction = "BReceteSorgula" | "BReceteSatisOnayla";

export interface MinistryRouteDeps {
  isDev: boolean;
  isLoopbackAddress: (addr: string | undefined) => boolean;
  verifyFirebaseIdToken: (token: string, allowLocal: boolean) => Promise<{ uid: string } | null>;
  checkRateLimit: (bucketKey: string, maxRequests?: number, windowMs?: number) => boolean;
}

export const MINISTRY_DEFAULT_ENDPOINTS: Record<MinistrySystem, Record<MinistryEnv, string>> = {
  BKTS: {
    LIVE: "https://bkst.tarbil.gov.tr/BkstWebService/BkstService.asmx",
    TEST: "https://testbkst.tarbil.gov.tr/BkstWebService/BkstService.asmx",
  },
  GTS: {
    LIVE: "https://gts.tarim.gov.tr/api/v1/bildirim",
    TEST: "https://testgts.tarim.gov.tr/api/v1/bildirim",
  },
  BRECETE: {
    LIVE: "https://brecete.tarimorman.gov.tr/WebService/BReceteService.asmx",
    TEST: "https://testbrecete.tarimorman.gov.tr/WebService/BReceteService.asmx",
  },
};

export const GTS_SUPPORT_INFO = {
  vendor: "DSTRACE (Tarım ve Orman Bakanlığı Gübre Takip Sistemi)",
  helpdeskEmail: "yardim.masasi@dstrace.com",
  helpdeskPhone: "0850 310 80 08",
  lastStatusNote: "16.11.2026 12:33 — Alisa Çiçek AKYOL: Talebiniz ilgili teknik birime iletilmiş olup API dokümanı dönüşü bekleniyor.",
} as const;

const ALLOWED_MINISTRY_SUFFIXES = [
  "tarbil.gov.tr",
  "tarimorman.gov.tr",
  "tarim.gov.tr",
  "gtb.gov.tr",
  "dstrace.com",
  "dstrace.com.tr",
];

/** SSRF koruması: Yalnızca HTTPS protokolü ve resmi Tarım Bakanlığı / GTS DSTRACE alan adlarına izin verilir. */
export function isAllowedMinistryUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(String(urlStr ?? "").trim());
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (!host) return false;
    return ALLOWED_MINISTRY_SUFFIXES.some(suffix => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

export function isValidGln13(gln: string): boolean {
  const s = String(gln ?? "").trim();
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = s.charCodeAt(11 - i) - 48;
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(s[12]);
}

const xmlEsc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const pickXmlTag = (xml: string, tag: string) =>
  (xml.match(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i")) || [])[1]?.trim() || "";

export interface MinistryUnitPayload {
  recordType?: string;
  date?: string;
  documentNo?: string;
  bReceteCode?: string;
  senderGln?: string;
  receiverGln?: string;
  farmerTcNo?: string;
  farmerName?: string;
  supplierName?: string;
  productName?: string;
  gtin?: string;
  serialNumber?: string;
  lotNumber?: string;
  expiryDate?: string;
  quantity?: number;
  unit?: string;
  sscc?: string;
  waybillNo?: string;
}

const SECRET_MASK = "********";
const APP_NAME = "MKS";

function renderProductUnitsXml(records: MinistryUnitPayload[]): string {
  return records
    .map(r => {
      const lines = [
        "        <KarekodBilgisi>",
        `          <GTIN>${xmlEsc((r.gtin || "").padStart(14, "0"))}</GTIN>`,
        `          <SeriNo>${xmlEsc(r.serialNumber || "")}</SeriNo>`,
        `          <PartiNo>${xmlEsc(r.lotNumber || "")}</PartiNo>`,
        `          <SonKullanmaTarihi>${xmlEsc(r.expiryDate || "")}</SonKullanmaTarihi>`,
        `          <Miktar>${xmlEsc(Number(r.quantity) || 1)}</Miktar>`,
        `          <Birim>${xmlEsc(r.unit || "Adet")}</Birim>`,
        r.sscc ? `          <SSCC>${xmlEsc(r.sscc)}</SSCC>` : "",
        r.waybillNo ? `          <IrsaliyeNo>${xmlEsc(r.waybillNo)}</IrsaliyeNo>` : "",
        r.bReceteCode ? `          <BReceteNo>${xmlEsc(r.bReceteCode)}</BReceteNo>` : "",
        r.farmerTcNo ? `          <AliciTCKN>${xmlEsc(r.farmerTcNo)}</AliciTCKN>` : "",
        "        </KarekodBilgisi>",
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n");
}

/**
 * BKTS SOAP 1.1 zarf üreticisi (TARBİL ASMX web servis kontratı uyumlu yapı).
 * Hem gönderilecek gerçek zarfı hem de parolası/KeyNo gizlenmiş denetim zarfını üretir.
 */
export function buildBktsSoapEnvelope(opts: {
  action: BktsAction;
  gln: string;
  username: string;
  password: string;
  serviceKey: string;
  records?: MinistryUnitPayload[];
  targetGln?: string;
}): { envelope: string; maskedEnvelope: string; soapAction: string } {
  const ns = "http://tempuri.org/";
  const soapAction = `${ns}${opts.action}`;
  const recs = Array.isArray(opts.records) ? opts.records : [];
  const primary = recs[0] || {};
  const unitsXml = renderProductUnitsXml(recs);

  const makeAuthBlock = (pw: string, key: string) =>
    [
      "      <YetkiBilgisi>",
      `        <GLN>${xmlEsc(opts.gln)}</GLN>`,
      `        <KullaniciAdi>${xmlEsc(opts.username)}</KullaniciAdi>`,
      `        <Sifre>${xmlEsc(pw)}</Sifre>`,
      `        <KeyNo>${xmlEsc(key)}</KeyNo>`,
      `        <UygulamaAdi>${APP_NAME}</UygulamaAdi>`,
      "      </YetkiBilgisi>",
    ].join("\n");

  const bodyFields =
    opts.action === "PaydasSorgula"
      ? `      <SorguGLN>${xmlEsc(opts.targetGln || opts.gln)}</SorguGLN>`
      : [
          `      <GonderenGLN>${xmlEsc(primary.senderGln || opts.gln)}</GonderenGLN>`,
          `      <AliciGLN>${xmlEsc(primary.receiverGln || "")}</AliciGLN>`,
          primary.farmerTcNo ? `      <CiftciTCKN>${xmlEsc(primary.farmerTcNo)}</CiftciTCKN>` : "",
          primary.documentNo ? `      <BelgeNo>${xmlEsc(primary.documentNo)}</BelgeNo>` : "",
          primary.waybillNo ? `      <IrsaliyeNo>${xmlEsc(primary.waybillNo)}</IrsaliyeNo>` : "",
          primary.bReceteCode ? `      <BReceteNo>${xmlEsc(primary.bReceteCode)}</BReceteNo>` : "",
          `      <BildirimTarihi>${xmlEsc(primary.date || new Date().toISOString())}</BildirimTarihi>`,
          "      <KarekodListesi>",
          unitsXml,
          "      </KarekodListesi>",
        ]
          .filter(Boolean)
          .join("\n");

  const wrap = (pw: string, key: string) =>
    [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
      "  <soap:Body>",
      `    <${opts.action} xmlns="${ns}">`,
      makeAuthBlock(pw, key),
      bodyFields,
      `    </${opts.action}>`,
      "  </soap:Body>",
      "</soap:Envelope>",
    ].join("\n");

  return {
    envelope: wrap(opts.password, opts.serviceKey),
    maskedEnvelope: wrap(opts.password ? SECRET_MASK : "", opts.serviceKey ? SECRET_MASK : ""),
    soapAction,
  };
}

/**
 * GTS (Gübre Takip Sistemi) JSON & SOAP yük üreticisi.
 */
export function buildGtsPayload(opts: {
  action: GtsAction;
  gln: string;
  username: string;
  password: string;
  serviceKey: string;
  records?: MinistryUnitPayload[];
}): { payloadJson: string; maskedJson: string; soapEnvelope: string; maskedEnvelope: string } {
  const recs = Array.isArray(opts.records) ? opts.records : [];
  const makeJson = (pw: string, key: string) =>
    JSON.stringify(
      {
        islem: opts.action,
        uygulama: APP_NAME,
        yetki: {
          gln: opts.gln,
          kullaniciAdi: opts.username,
          sifre: pw,
          keyNo: key,
        },
        tarih: new Date().toISOString(),
        kalemler: recs.map(r => ({
          kayitTuru: r.recordType || "FARMER_SALE",
          gonderenGln: r.senderGln || opts.gln,
          aliciGln: r.receiverGln || undefined,
          aliciTcknVkn: r.farmerTcNo || undefined,
          aliciUnvan: r.farmerName || undefined,
          belgeNo: r.documentNo || undefined,
          irsaliyeNo: r.waybillNo || undefined,
          gtin: (r.gtin || "").padStart(14, "0"),
          seriNo: r.serialNumber || undefined,
          partiNo: r.lotNumber || undefined,
          miktar: Number(r.quantity) || 1,
          birim: r.unit || "Adet",
        })),
      },
      null,
      2
    );

  const unitsXml = renderProductUnitsXml(recs);
  const makeSoap = (pw: string, key: string) =>
    [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
      "  <soap:Body>",
      `    <${opts.action} xmlns="http://gts.tarim.gov.tr/">`,
      "      <YetkiBilgisi>",
      `        <GLN>${xmlEsc(opts.gln)}</GLN>`,
      `        <KullaniciAdi>${xmlEsc(opts.username)}</KullaniciAdi>`,
      `        <Sifre>${xmlEsc(pw)}</Sifre>`,
      `        <KeyNo>${xmlEsc(key)}</KeyNo>`,
      `        <UygulamaAdi>${APP_NAME}</UygulamaAdi>`,
      "      </YetkiBilgisi>",
      "      <KarekodListesi>",
      unitsXml,
      "      </KarekodListesi>",
      `    </${opts.action}>`,
      "  </soap:Body>",
      "</soap:Envelope>",
    ].join("\n");

  return {
    payloadJson: makeJson(opts.password, opts.serviceKey),
    maskedJson: makeJson(opts.password ? SECRET_MASK : "", opts.serviceKey ? SECRET_MASK : ""),
    soapEnvelope: makeSoap(opts.password, opts.serviceKey),
    maskedEnvelope: makeSoap(opts.password ? SECRET_MASK : "", opts.serviceKey ? SECRET_MASK : ""),
  };
}

/**
 * B-Reçete Web Servisi SOAP 1.1 zarf üreticisi.
 */
export function buildBReceteSoapEnvelope(opts: {
  action: BReceteAction;
  gln: string;
  username: string;
  password: string;
  serviceKey: string;
  bReceteCode: string;
  farmerTcNo?: string;
  records?: MinistryUnitPayload[];
}): { envelope: string; maskedEnvelope: string; soapAction: string } {
  const ns = "http://brecete.tarimorman.gov.tr/";
  const soapAction = `${ns}${opts.action}`;
  const recs = Array.isArray(opts.records) ? opts.records : [];
  const unitsXml = renderProductUnitsXml(recs);

  const wrap = (pw: string, key: string) =>
    [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
      "  <soap:Body>",
      `    <${opts.action} xmlns="${ns}">`,
      "      <YetkiBilgisi>",
      `        <BayiGLN>${xmlEsc(opts.gln)}</BayiGLN>`,
      `        <KullaniciAdi>${xmlEsc(opts.username)}</KullaniciAdi>`,
      `        <Sifre>${xmlEsc(pw)}</Sifre>`,
      `        <KeyNo>${xmlEsc(key)}</KeyNo>`,
      `        <UygulamaAdi>${APP_NAME}</UygulamaAdi>`,
      "      </YetkiBilgisi>",
      `      <BReceteNo>${xmlEsc(opts.bReceteCode)}</BReceteNo>`,
      opts.farmerTcNo ? `      <CiftciTCKN>${xmlEsc(opts.farmerTcNo)}</CiftciTCKN>` : "",
      opts.action === "BReceteSatisOnayla"
        ? `      <KarekodListesi>\n${unitsXml}\n      </KarekodListesi>`
        : "",
      `    </${opts.action}>`,
      "  </soap:Body>",
      "</soap:Envelope>",
    ]
      .filter(Boolean)
      .join("\n");

  return {
    envelope: wrap(opts.password, opts.serviceKey),
    maskedEnvelope: wrap(opts.password ? SECRET_MASK : "", opts.serviceKey ? SECRET_MASK : ""),
    soapAction,
  };
}

interface HttpDispatchResult {
  ok: boolean;
  liveVerified: boolean;
  httpStatus: number | null;
  referenceNo?: string;
  errorCode?: string;
  error?: string;
  diagnostic: string;
  rawSnippet?: string;
}

async function dispatchMinistryRequest(
  endpointUrl: string,
  method: "SOAP" | "JSON",
  body: string,
  headers: Record<string, string>,
  timeoutMs = 15_000
): Promise<HttpDispatchResult> {
  if (!isAllowedMinistryUrl(endpointUrl)) {
    return {
      ok: false,
      liveVerified: false,
      httpStatus: null,
      errorCode: "INVALID_ENDPOINT",
      error: "Güvenlik engeli: Yalnızca resmi Tarım ve Orman Bakanlığı (.gov.tr) ve GTS DSTRACE (dstrace.com / dstrace.com.tr) HTTPS uç noktalarına bağlanılabilir.",
      diagnostic: `Geçersiz veya yetkisiz adres engellendi: ${endpointUrl}`,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    const text = await resp.text();
    const snippet = text.slice(0, 800);

    if (method === "SOAP") {
      const fault = pickXmlTag(text, "faultstring") || pickXmlTag(text, "HataMesaji") || pickXmlTag(text, "Message");
      const errCode = pickXmlTag(text, "faultcode") || pickXmlTag(text, "HataKodu");
      const refNo =
        pickXmlTag(text, "ReferansNo") ||
        pickXmlTag(text, "BildirimId") ||
        pickXmlTag(text, "TakipNo") ||
        pickXmlTag(text, "BelgeNo");
      const okFlag = pickXmlTag(text, "Basarili").toLowerCase();

      if (!resp.ok || fault || okFlag === "false" || (errCode && errCode !== "0")) {
        return {
          ok: false,
          liveVerified: false,
          httpStatus: resp.status,
          errorCode: errCode || `HTTP_${resp.status}`,
          error: fault || `Bakanlık web servisi HTTP ${resp.status} kodu döndü.`,
          diagnostic:
            resp.status === 401 || resp.status === 403
              ? "Bakanlık sunucusu kimlik doğrulamayı veya IP adresini reddetti (401/403). Bayi KeyNo ve yetkili IP tanımını kontrol edin."
              : resp.status === 404 || resp.status === 405
                ? `Servis uç noktası yanıt vermedi (HTTP ${resp.status}). Güncel Bakanlık WSDL/ASMX adresini Ayarlar sekmesinden güncelleyin.`
                : fault || `Sunucu yanıtı (${resp.status})`,
          rawSnippet: snippet,
        };
      }

      if (!refNo && !okFlag && !text.includes("Envelope")) {
        return {
          ok: false,
          liveVerified: false,
          httpStatus: resp.status,
          errorCode: "UNEXPECTED_RESPONSE",
          error: "Bakanlık sunucusundan beklenen SOAP XML zarfı yerine HTML/farklı içerik döndü (portaldaki WSDL veya oturum geçidi olabilir).",
          diagnostic: `HTTP ${resp.status} döndü ancak SOAP XML gövdesi bulunamadı.`,
          rawSnippet: snippet,
        };
      }

      return {
        ok: true,
        liveVerified: true,
        httpStatus: resp.status,
        referenceNo: refNo || `MIN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        diagnostic: `Bakanlık sunucusu işlemi canlı onayladı (HTTP ${resp.status}).`,
        rawSnippet: snippet,
      };
    }

    // JSON / REST (veya XML/SOAP yanıt veren GTS uç noktaları)
    const trimmed = text.trim();
    const looksHtml = /^<!doctype html|^<html[\s>]/i.test(trimmed);
    if (looksHtml) {
      return {
        ok: false,
        liveVerified: false,
        httpStatus: resp.status,
        errorCode: "UNEXPECTED_HTML_RESPONSE",
        error: `GTS sunucusu JSON/XML API yanıtı yerine HTTP ${resp.status} HTML web sayfası döndürdü (oturum geçidi veya portal URL'si olabilir).`,
        diagnostic: "GTS teknik ekibinin paylaşacağı resmi REST/SOAP API uç nokta URL'sini Ayarlar sekmesinden güncelleyin.",
        rawSnippet: snippet,
      };
    }

    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      parsedJson = null;
    }

    if (!parsedJson && text.includes("<Envelope")) {
      const fault = pickXmlTag(text, "faultstring") || pickXmlTag(text, "HataMesaji") || pickXmlTag(text, "Message");
      const refNo = pickXmlTag(text, "ReferansNo") || pickXmlTag(text, "BildirimId") || pickXmlTag(text, "BelgeNo");
      const okFlag = pickXmlTag(text, "Basarili").toLowerCase();
      if (resp.ok && !fault && okFlag !== "false") {
        return {
          ok: true,
          liveVerified: true,
          httpStatus: resp.status,
          referenceNo: refNo || `GTS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          diagnostic: `GTS SOAP/XML uç noktası işlemi canlı onayladı (HTTP ${resp.status}).`,
          rawSnippet: snippet,
        };
      }
      return {
        ok: false,
        liveVerified: false,
        httpStatus: resp.status,
        errorCode: pickXmlTag(text, "HataKodu") || `HTTP_${resp.status}`,
        error: fault || `GTS SOAP sunucusu HTTP ${resp.status} yanıtı verdi.`,
        diagnostic: fault || `GTS SOAP işlemi reddedildi (HTTP ${resp.status}).`,
        rawSnippet: snippet,
      };
    }

    if (!resp.ok || !parsedJson || parsedJson.success === false || parsedJson.ok === false || parsedJson.basarili === false || parsedJson.status === false) {
      return {
        ok: false,
        liveVerified: false,
        httpStatus: resp.status,
        errorCode: String(parsedJson?.errorCode || parsedJson?.hataKodu || parsedJson?.code || `HTTP_${resp.status}`),
        error: String(parsedJson?.message || parsedJson?.hataMesaji || parsedJson?.error || `GTS sunucusu HTTP ${resp.status} yanıtı verdi.`),
        diagnostic: parsedJson
          ? `GTS sunucu yanıtı (HTTP ${resp.status}): ${parsedJson.message || parsedJson.hataMesaji || "İşlem reddedildi"}`
          : `GTS API JSON yerine HTTP ${resp.status} yanıtı döndü (yetkisiz IP veya teknik birimden gelecek güncel REST/SOAP yolu bekleniyor olabilir).`,
        rawSnippet: snippet,
      };
    }

    return {
      ok: true,
      liveVerified: true,
      httpStatus: resp.status,
      referenceNo: String(parsedJson.referenceNo || parsedJson.referansNo || parsedJson.bildirimId || parsedJson.data?.referenceNo || `GTS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`),
      diagnostic: `GTS sunucusu işlemi canlı onayladı (HTTP ${resp.status}).`,
      rawSnippet: snippet,
    };
  } catch (err: any) {
    const code = String(err?.cause?.code || err?.code || err?.name || "NETWORK_ERROR");
    const isTimeout = err?.name === "AbortError" || code === "ETIMEDOUT";
    return {
      ok: false,
      liveVerified: false,
      httpStatus: null,
      errorCode: code,
      error: isTimeout
        ? "Bakanlık web servisi 15 saniye içinde yanıt vermedi (zaman aşımı veya kapalı kurumsal ağ)."
        : `Bakanlık web servisine ulaşılamadı (${code}).`,
      diagnostic:
        code === "ENOTFOUND" || code === "ECONNREFUSED" || isTimeout
          ? "Tarım ve Orman Bakanlığı (.gov.tr) web servis sunucuları dış internete kapalı olabilir veya sunucu IP adresi Bakanlık IP whitelist listesinde tanımlı değildir."
          : `Ağ bağlantı hatası: ${err?.message || code}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function registerMinistryRoutes(app: Express, deps: MinistryRouteDeps) {
  const guard = async (req: Request, res: Response, bucket: string, perMinute: number) => {
    const remoteIp = req.socket.remoteAddress;
    const forwardedIp = process.env.K_SERVICE ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "";
    const isLocalLoopback = deps.isDev && deps.isLoopbackAddress(remoteIp) && !forwardedIp;
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const user = token ? await deps.verifyFirebaseIdToken(token, isLocalLoopback) : null;
    // Yerel modda Firebase oturumu bulunmadığında da bayinin kendi GLN/KeyNo/şifresi ile IP hız sınırına tabi test/bildirim izni verilir
    const key = user ? `${bucket}:${user.uid}` : `${bucket}_ip:${forwardedIp || remoteIp || "unknown"}`;
    if (!deps.checkRateLimit(key, perMinute, 60_000)) {
      res.status(429).json({ ok: false, liveVerified: false, error: "Çok fazla Bakanlık isteği gönderildi, lütfen 1 dakika bekleyin." });
      return null;
    }

    const systemRaw = String(req.body?.system || "BKTS").trim().toUpperCase();
    const system: MinistrySystem = systemRaw === "GTS" ? "GTS" : systemRaw === "BRECETE" ? "BRECETE" : "BKTS";
    const env: MinistryEnv = req.body?.environment === "TEST" ? "TEST" : "LIVE";
    const gln = String(req.body?.gln || "").replace(/\D/g, "");
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const serviceKey = String(req.body?.serviceKey || "").trim();
    const customEndpoint = String(req.body?.endpointUrl || "").trim();
    const endpointUrl = customEndpoint || MINISTRY_DEFAULT_ENDPOINTS[system][env];

    if (!isValidGln13(gln)) {
      res.status(400).json({ ok: false, liveVerified: false, error: "Geçerli 13 haneli Bayi GLN numarası girilmelidir." });
      return null;
    }
    if (!username || !password || !serviceKey) {
      res.status(400).json({
        ok: false,
        liveVerified: false,
        error: `${system} canlı web servisi için Bayi Kullanıcı Adı, Şifre ve Web Servis Anahtarı (KeyNo) alanlarının tümü gereklidir.`,
      });
      return null;
    }

    return { system, env, gln, username, password, serviceKey, endpointUrl };
  };

  const buildGtsHeaders = (serviceKey: string, soapAction?: string): Record<string, string> => {
    const h: Record<string, string> = soapAction
      ? { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${soapAction}"` }
      : { "Content-Type": "application/json; charset=utf-8" };
    if (serviceKey) {
      h["X-Api-Key"] = serviceKey;
      h["Authorization"] = `Bearer ${serviceKey}`;
    }
    return h;
  };
  const isSoapUrl = (u: string) => /\.(asmx|svc)(\?|$)/i.test(u);

  app.get("/api/ministry/info", (_req, res) => {
    res.json({
      ok: true,
      appName: APP_NAME,
      systems: MINISTRY_DEFAULT_ENDPOINTS,
      gtsSupport: GTS_SUPPORT_INFO,
      notes: "Canlı bildirimler için bayinin Bakanlık portalından aldığı Kullanıcı Adı, Şifre ve KeyNo gereklidir. GTS için DSTRACE teknik birim dönüşüne göre özel HTTPS uç noktası (.gov.tr veya .dstrace.com/.dstrace.com.tr) tanımlanabilir.",
    });
  });

  app.post("/api/ministry/test-connection", async (req, res) => {
    const g = await guard(req, res, "ministry_test", 10);
    if (!g) return;

    if (g.system === "GTS") {
      if (isSoapUrl(g.endpointUrl)) {
        const soapBuilt = buildBktsSoapEnvelope({
          action: "PaydasSorgula",
          gln: g.gln,
          username: g.username,
          password: g.password,
          serviceKey: g.serviceKey,
          targetGln: g.gln,
        });
        const result = await dispatchMinistryRequest(g.endpointUrl, "SOAP", soapBuilt.envelope, buildGtsHeaders(g.serviceKey, "http://tarim.gov.tr/GtsBaglantiTesti"));
        return res.json({
          ...result,
          system: g.system,
          environment: g.env,
          endpointUrl: g.endpointUrl,
          soapPreview: soapBuilt.maskedEnvelope,
        });
      }
      const built = buildGtsPayload({
        action: "GtsBaglantiTesti",
        gln: g.gln,
        username: g.username,
        password: g.password,
        serviceKey: g.serviceKey,
      });
      const result = await dispatchMinistryRequest(g.endpointUrl, "JSON", built.payloadJson, buildGtsHeaders(g.serviceKey));
      return res.status(result.ok ? 200 : 200).json({
        ...result,
        system: g.system,
        environment: g.env,
        endpointUrl: g.endpointUrl,
        soapPreview: built.maskedJson,
      });
    }

    if (g.system === "BRECETE") {
      const built = buildBReceteSoapEnvelope({
        action: "BReceteSorgula",
        gln: g.gln,
        username: g.username,
        password: g.password,
        serviceKey: g.serviceKey,
        bReceteCode: "TEST-BAGLANTI",
      });
      const result = await dispatchMinistryRequest(g.endpointUrl, "SOAP", built.envelope, {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${built.soapAction}"`,
      });
      return res.json({
        ...result,
        system: g.system,
        environment: g.env,
        endpointUrl: g.endpointUrl,
        soapPreview: built.maskedEnvelope,
      });
    }

    const built = buildBktsSoapEnvelope({
      action: "PaydasSorgula",
      gln: g.gln,
      username: g.username,
      password: g.password,
      serviceKey: g.serviceKey,
      targetGln: g.gln,
    });
    const result = await dispatchMinistryRequest(g.endpointUrl, "SOAP", built.envelope, {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"${built.soapAction}"`,
    });
    return res.json({
      ...result,
      system: g.system,
      environment: g.env,
      endpointUrl: g.endpointUrl,
      soapPreview: built.maskedEnvelope,
    });
  });

  app.post("/api/ministry/send-notification", async (req, res) => {
    const g = await guard(req, res, "ministry_send", 15);
    if (!g) return;

    const records = Array.isArray(req.body?.records) ? (req.body.records as MinistryUnitPayload[]) : [];
    if (records.length === 0 || records.length > 200) {
      return res.status(400).json({ ok: false, liveVerified: false, error: "Bildirim için 1 ile 200 arasında kayıt gönderilmelidir." });
    }

    const firstType = records[0]?.recordType || "FARMER_SALE";

    if (g.system === "GTS") {
      if (isSoapUrl(g.endpointUrl)) {
        const bktsAction: BktsAction =
          firstType === "SHIPMENT_ACCEPT"
            ? "AlimBildirimi"
            : firstType === "RETURN"
              ? "SatisIptalBildirimi"
              : "SatisBildirimi";
        const soapBuilt = buildBktsSoapEnvelope({
          action: bktsAction,
          gln: g.gln,
          username: g.username,
          password: g.password,
          serviceKey: g.serviceKey,
          records,
        });
        const result = await dispatchMinistryRequest(g.endpointUrl, "SOAP", soapBuilt.envelope, buildGtsHeaders(g.serviceKey, soapBuilt.soapAction));
        return res.json({
          ...result,
          system: g.system,
          environment: g.env,
          endpointUrl: g.endpointUrl,
          soapPreview: soapBuilt.maskedEnvelope,
        });
      }
      const action: GtsAction =
        firstType === "SHIPMENT_ACCEPT"
          ? "GtsMalKabulBildirimi"
          : firstType === "RETURN"
            ? "GtsIadeBildirimi"
            : "GtsCiftciSatisBildirimi";
      const built = buildGtsPayload({
        action,
        gln: g.gln,
        username: g.username,
        password: g.password,
        serviceKey: g.serviceKey,
        records,
      });
      const result = await dispatchMinistryRequest(g.endpointUrl, "JSON", built.payloadJson, buildGtsHeaders(g.serviceKey));
      return res.json({
        ...result,
        system: g.system,
        environment: g.env,
        endpointUrl: g.endpointUrl,
        soapPreview: built.maskedJson,
      });
    }

    if (g.system === "BRECETE") {
      const bReceteCode = String(req.body?.bReceteCode || records[0]?.bReceteCode || "").trim();
      const farmerTcNo = String(req.body?.farmerTcNo || records[0]?.farmerTcNo || "").trim();
      if (!bReceteCode) {
        return res.status(400).json({ ok: false, liveVerified: false, error: "B-Reçete satışı onaylamak için B-Reçete Kodu gereklidir." });
      }
      const built = buildBReceteSoapEnvelope({
        action: "BReceteSatisOnayla",
        gln: g.gln,
        username: g.username,
        password: g.password,
        serviceKey: g.serviceKey,
        bReceteCode,
        farmerTcNo,
        records,
      });
      const result = await dispatchMinistryRequest(g.endpointUrl, "SOAP", built.envelope, {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${built.soapAction}"`,
      });
      return res.json({
        ...result,
        system: g.system,
        environment: g.env,
        endpointUrl: g.endpointUrl,
        soapPreview: built.maskedEnvelope,
      });
    }

    const bktsAction: BktsAction =
      firstType === "SHIPMENT_ACCEPT"
        ? "AlimBildirimi"
        : firstType === "RETURN"
          ? "SatisIptalBildirimi"
          : "SatisBildirimi";
    const built = buildBktsSoapEnvelope({
      action: bktsAction,
      gln: g.gln,
      username: g.username,
      password: g.password,
      serviceKey: g.serviceKey,
      records,
    });
    const result = await dispatchMinistryRequest(g.endpointUrl, "SOAP", built.envelope, {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"${built.soapAction}"`,
    });
    return res.json({
      ...result,
      system: g.system,
      environment: g.env,
      endpointUrl: g.endpointUrl,
      soapPreview: built.maskedEnvelope,
    });
  });

  app.post("/api/ministry/query-brecete", async (req, res) => {
    const g = await guard({ ...req, body: { ...req.body, system: "BRECETE" } } as Request, res, "ministry_brecete", 20);
    if (!g) return;

    const bReceteCode = String(req.body?.bReceteCode || "").trim();
    const farmerTcNo = String(req.body?.farmerTcNo || "").replace(/\D/g, "");
    if (!bReceteCode) {
      return res.status(400).json({ ok: false, liveVerified: false, error: "Sorgulanacak B-Reçete Kodu gereklidir." });
    }

    const built = buildBReceteSoapEnvelope({
      action: "BReceteSorgula",
      gln: g.gln,
      username: g.username,
      password: g.password,
      serviceKey: g.serviceKey,
      bReceteCode,
      farmerTcNo: farmerTcNo || undefined,
    });

    const result = await dispatchMinistryRequest(g.endpointUrl, "SOAP", built.envelope, {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"${built.soapAction}"`,
    });

    return res.json({
      ...result,
      system: "BRECETE",
      environment: g.env,
      endpointUrl: g.endpointUrl,
      bReceteCode,
      soapPreview: built.maskedEnvelope,
    });
  });
}
