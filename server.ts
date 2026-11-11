import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import {
  analyzeFieldPolygonSatellite,
  isCopernicusConfigured,
  lookupTkgmParcelByCoord,
} from "./server/copernicusService";

dotenv.config();

let lastEnvMtimeMs = 0;
function reloadDotenvIfChanged(): void {
  try {
    const envPath = path.join(process.cwd(), ".env");
    const stat = fs.statSync(envPath);
    if (stat.mtimeMs > lastEnvMtimeMs) {
      lastEnvMtimeMs = stat.mtimeMs;
      dotenv.config({ override: true });
    }
  } catch {
    // .env file optional in Cloud Run / container environments
  }
}

const FIREBASE_PROJECT_ID = (process.env.FIREBASE_PROJECT_ID || "muhendiskayitsistemi").trim();
const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts: Record<string, string> | null = null;
let certsExpiresAt = 0;

async function getFirebasePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && now < certsExpiresAt) {
    return cachedCerts;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Google X509 sertifikaları alınamadı (${res.status})`);
  }

  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600_000;

  cachedCerts = (await res.json()) as Record<string, string>;
  certsExpiresAt = now + ttlMs;
  return cachedCerts;
}

interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
}

async function verifyFirebaseIdToken(
  idToken: string,
  allowOfflineDevFallback: boolean
): Promise<VerifiedFirebaseUser | null> {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;

    const nowSec = Math.floor(Date.now() / 1000);
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

      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(`${headerB64}.${payloadB64}`);
      verifier.end();

      const signatureValid = verifier.verify(certPem, Buffer.from(sigB64, "base64url"));
      if (!signatureValid) return null;
    } catch (certErr) {
      if (!allowOfflineDevFallback) {
        console.error("Firebase JWT sertifika doğrulama hatası:", certErr);
        return null;
      }
    }

    return {
      uid: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined
    };
  } catch {
    return null;
  }
}

function isLoopbackAddress(addr: string | undefined): boolean {
  if (!addr) return false;
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

function buildCorsOptions(): cors.CorsOptions {
  const customOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const staticAllowed = new Set([
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
      // Same-origin / native WebView / server-to-server requests without Origin header
      if (!origin) return callback(null, true);
      if (staticAllowed.has(origin)) return callback(null, true);
      if (/^https:\/\/m-hendis-kay-t-sistemi-[a-z0-9.-]+\.run\.app$/i.test(origin)) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV !== "production" && /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS origin izinli değil"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  };
}

async function startServer() {
  const app = express();
  const PORT = process.env.K_SERVICE ? Number(process.env.PORT) || 8080 : 3000;
  const isDev = process.env.NODE_ENV !== "production";

  app.use(express.json({ limit: "12mb" }));
  app.use(cors(buildCorsOptions()));

  // Kullanıcı UID veya IP bazlı hız sınırlayıcı (dakikada maks 25 istek)
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const checkRateLimit = (bucketKey: string, maxRequests = 25, windowMs = 60_000): boolean => {
    const now = Date.now();
    if (rateLimitMap.size > 5000) {
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

  // AI Generation Endpoint (Server-side, Kimlik Doğrulamalı)
  app.post("/api/generate", async (req, res) => {
    const remoteIp = req.socket.remoteAddress;
    const forwardedIp = process.env.K_SERVICE
      ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()
      : "";
    const clientIp = forwardedIp || remoteIp || "unknown";
    const isLocalLoopback = isDev && isLoopbackAddress(remoteIp) && !forwardedIp;

    // 1. Firebase Auth ID Token Doğrulaması
    const authHeader = String(req.headers.authorization || "");
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    let verifiedUser: VerifiedFirebaseUser | null = null;
    if (bearerToken) {
      verifiedUser = await verifyFirebaseIdToken(bearerToken, isLocalLoopback);
    }

    if (!verifiedUser && !(isLocalLoopback && process.env.ALLOW_UNAUTH_LOCAL_AI === "true")) {
      return res.status(401).json({
        error: "Yapay zeka servisini kullanmak için geçerli bir MKS oturumu gereklidir.",
        code: "UNAUTHORIZED"
      });
    }

    const rateKey = verifiedUser ? `uid:${verifiedUser.uid}` : `ip:${clientIp}`;
    if (!checkRateLimit(rateKey)) {
      return res.status(429).json({
        error: "Çok fazla istek gönderildi. Lütfen bir dakika bekleyip tekrar deneyin.",
        code: "RATE_LIMIT_EXCEEDED"
      });
    }

    try {
      const { model: modelName, contents, config } = req.body || {};
      if (!contents) {
        return res.status(400).json({ error: "İçerik (contents) alanı zorunludur.", code: "INVALID_PAYLOAD" });
      }

      // 1. Öncelik: OmniRoute Yerel Köprüsü (Yalnızca OMNIROUTE_TOKEN .env'de tanımlıysa denenir)
      const omniToken = (process.env.OMNIROUTE_TOKEN || "").trim();
      const omniUrl = (process.env.OMNIROUTE_URL || "http://127.0.0.1:20128/v1/chat/completions").trim();

      if (omniToken) {
        const messages: any[] = [];
        let hasImage = false;

        if (config?.systemInstruction) {
          const sysInst = config.systemInstruction;
          if (typeof sysInst === "string" && sysInst.trim()) {
            messages.push({ role: "system", content: sysInst.trim() });
          } else if (sysInst?.parts) {
            const txt = sysInst.parts.map((p: any) => p?.text || "").join("\n").trim();
            if (txt) messages.push({ role: "system", content: txt });
          }
        }

        const partsToOpenAI = (partsList: any[]) => {
          const oaParts: any[] = [];
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

        const candidateModels = hasImage
          ? ["gemini/gemini-3-flash-preview", "gemini/gemini-3.7-flash", "gemini/gemini-3.1-pro-preview"]
          : ["gemini/gemini-3-flash-preview", "auto/best-fast", "free", "video-metin"];

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
              const omniData: any = await omniResp.json();
              const replyText = (omniData?.choices?.[0]?.message?.content || "").trim();
              if (replyText) {
                return res.json({ text: replyText, model: mName });
              }
            }
          } catch {
            // Sonraki modeli veya doğrudan Gemini SDK'yı dene
          }
        }
      }

      // 2. Yedek: Doğrudan GEMINI_API_KEY (tanımlıysa)
      const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "").trim();
      if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey.length < 10) {
        return res.status(500).json({
          error: "Yapay zeka servisine ulaşılamadı (OmniRoute veya GEMINI_API_KEY aktif değil).",
          code: "MISSING_API_KEY"
        });
      }

      const ai = new GoogleGenAI({ apiKey });
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
    } catch (error: any) {
      const safeMessage = error?.message || "Bilinmeyen bir hata oluştu";
      const safeCode = error?.code || "AI_GENERATION_FAILED";
      console.error("AI Sunucu Hatası:", safeMessage);
      res.status(500).json({
        error: String(safeMessage),
        code: String(safeCode)
      });
    }
  });

  // Uygulama Sürüm & Güncelleme Bildirimi Uç Noktası (Telefon + Masaüstü + Web)
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
      title: "MKS v8.2.1 Masaüstü Canlı Güncelleme & Kurumsal ERP Paketi",
      notes: "Masaüstü uygulaması pencere kontrol çubuğuna canlı güncelleme butonu, temel ERP vitrin önceliği ve kurumsal marka paketi eklendi."
    };

    const candidatePaths = [
      path.join(process.cwd(), "dist", "version.json"),
      path.join(process.cwd(), "public", "version.json")
    ];

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) {
          const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
          if (parsed && typeof parsed === "object" && parsed.version) {
            return res.json({ ...fallbackVersion, ...parsed });
          }
        }
      } catch {
        // Bozuk dosya durumunda güvenli varsayılana dön
      }
    }

    res.json(fallbackVersion);
  });

  // Sağlık Durumu Uç Noktası (Hassas anahtar bilgisi sızdırmaz)
  app.get("/api/check-ai", (_req, res) => {
    const hasConfiguredProvider = Boolean(
      (process.env.OMNIROUTE_TOKEN || "").trim() ||
      (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "").trim()
    );
    res.json({
      status: hasConfiguredProvider ? "ready" : "unconfigured",
      authRequired: true,
      env: process.env.NODE_ENV || "development"
    });
  });

  // --- TKGM Ada/Parsel ve Koordinat Sorgulama Uç Noktası (Uygulama İçi, Yönlendirmesiz) ---
  app.post("/api/tkgm/parcel", async (req, res) => {
    const forwardedIp = process.env.K_SERVICE
      ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()
      : "";
    const clientIp = forwardedIp || req.socket.remoteAddress || "unknown";
    if (!checkRateLimit(`tkgm:${clientIp}`, 30, 60_000)) {
      return res.status(429).json({ error: "Çok fazla parsel sorgusu gönderildi, lütfen bekleyin." });
    }
    try {
      const lat = Number(req.body?.lat);
      const lng = Number(req.body?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return res.status(400).json({ error: "Geçerli enlem ve boylam (lat, lng) gereklidir." });
      }
      const result = await lookupTkgmParcelByCoord(lat, lng);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || "TKGM sorgusu sırasında hata oluştu."
      });
    }
  });

  // --- Copernicus Sentinel-2 Çok Katmanlı Uydu Analizi (NDVI + NDMI + Çamur/Yüzey Islaklığı) ---
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
    const forwardedIp = process.env.K_SERVICE
      ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()
      : "";
    const clientIp = forwardedIp || remoteIp || "unknown";
    const isLocalLoopback = isDev && isLoopbackAddress(remoteIp) && !forwardedIp;

    const authHeader = String(req.headers.authorization || "");
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    let verifiedUser: VerifiedFirebaseUser | null = null;
    if (bearerToken) {
      verifiedUser = await verifyFirebaseIdToken(bearerToken, isLocalLoopback);
    }

    if (!verifiedUser && !isLocalLoopback) {
      return res.status(401).json({
        error: "Uydu analizi için geçerli bir MKS oturumu gereklidir.",
        code: "UNAUTHORIZED"
      });
    }

    const rateKey = verifiedUser ? `sat:${verifiedUser.uid}` : `sat_ip:${clientIp}`;
    if (!checkRateLimit(rateKey, 15, 60_000)) {
      return res.status(429).json({
        error: "Dakikada en fazla 15 uydu analizi isteği gönderilebilir.",
        code: "RATE_LIMIT_EXCEEDED"
      });
    }

    try {
      reloadDotenvIfChanged();
      const polygonGeoJson = req.body?.polygonGeoJson || req.body?.geometry || req.body?.feature;
      const analysis = await analyzeFieldPolygonSatellite(polygonGeoJson);
      return res.json(analysis);
    } catch (err: any) {
      const status = Number(err?.status) || 500;
      return res.status(status).json({
        error: err?.message || "Uydu analizi oluşturulurken hata meydana geldi.",
        code: err?.code || "SATELLITE_ANALYSIS_FAILED"
      });
    }
  });

  // Vite middleware for development
  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is listening on port ${PORT}`);
  });
}

startServer();
