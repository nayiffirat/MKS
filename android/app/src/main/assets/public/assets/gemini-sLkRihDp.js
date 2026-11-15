import{d as k,A as d,aL as p}from"./index-B5InnLCr.js";const y="gemini-3-flash-preview",c=async(i,r,n)=>{const s=JSON.stringify({model:i,contents:r,config:n});let t=null;try{k.currentUser&&(t=await k.currentUser.getIdToken())}catch{t=null}const o={"Content-Type":"application/json",...t?{Authorization:`Bearer ${t}`}:{}},m=Array.from(new Set([...d?[`${d}/api/generate`]:[],"/api/generate",`${p}/api/generate`,"http://127.0.0.1:3000/api/generate"]));let a="Yapay zeka servisine ulaşılamadı.";for(const u of m)try{const e=await fetch(u,{method:"POST",headers:o,body:s});if(!e.ok){a=(await e.json().catch(()=>({}))).error||`HTTP ${e.status}`;continue}const l=await e.json();if(l&&typeof l.text=="string"&&l.text.trim())return l.text}catch(e){a=(e==null?void 0:e.message)||String(e)}throw console.error("MKS AI Proxy Error:",a),new Error(a)},g=async(i,r,n,s)=>{const t=`Sen Türkiye'nin en deneyimli, uzman Ziraat Mühendisi ve MKS (Mühendis Kayıt Sistemi) Yapay Zeka Karar Destek Danışmanısın (T.C. Tarım ve Orman Bakanlığı Resmi BKÜ Kataloğu, TAGEM teknik bültenleri ve Ziraat Fakültesi doktrinlerine %100 hakimsin).
Sana sorulan tarımsal veya işletme/stok/cari/finans sorularına son derece detaylı, sayısal kanıtlara dayalı, doğrudan sahada ve bayide aksiyon alınabilir net ve Türkçe yanıtlar ver.

Eğer soru bitki hastalıkları, zararlılar, gübreleme, tank karışımı veya ilaçlama hakkındaysa şu başlıkları kullan:
1. **Teşhis & Eşik Özeti**: Etmenin biyolojik tanımı ve Ekonomik Zarar Eşiği (EZE).
2. **Kültürel ve Biyolojik Önlemler**: İlaçsız çözüm, havalandırma, budama, sulama, ekim nöbeti.
3. **Kimyasal Mücadele & Depo / BKÜ Eşleşmesi**: Resmi ruhsatlı etken maddeler, direnç yönetimi (IRAC/FRAC/HRAC) ve varsa bayinin kendi deposundaki uygun mevcut ilaçlar (stok adediyle).
4. **Dozaj, Tank Karışımı & PHI (Hasat Arası Süre)**: Uygulama zamanı, su pH/sertlik ve güvenli bekleme süresi.

Eğer soru MKS içindeki stoklar, SKT takibi, çiftçi borçları, tahsilat önceliği, kasa durumu veya finansal analiz hakkındaysa aşağıdaki canlı işletme verilerini ve RAG eşleşmelerini baz alarak isim, miktar ve net TL/döviz rakamlarıyla yanıt ver; somut aksiyon listesi öner.
${r?`
İlgili Bitki Bağlamı:
${r}`:""}
${n?`
CANLI MKS İŞLETME, DEPO VE RESMİ BKÜ VERİLERİ:
${n}`:""}`,m=[...(s||[]).filter(a=>a.text&&a.text.trim()).slice(-8).map(a=>({role:a.role==="ai"?"model":"user",parts:[{text:a.text.slice(0,2e3)}]})),{role:"user",parts:[{text:i}]}];return await c(y,m,{systemInstruction:t})},E=async(i,r="image/jpeg",n)=>{const s=`Sen uzman bir Bitki Koruma Ziraat Mühendisisin. Gönderilen yaprak/bitki fotoğrafını detaylı analiz et.

Lütfen aşağıdaki formatta tamamen geçerli bir JSON yanıtı döndür (JSON kod bloğu markdown olmadan, doğrudan JSON string olarak):
{
  "cropName": "Tespit edilen bitki adı (Örn: Domates, Pamuk, Buğday...)",
  "problemType": "HASTALIK" veya "ZARARLI" veya "YABANCI_OT" veya "BESLEME" veya "SAĞLIKLI" veya "BULUNAMADI",
  "name": "Hastalık/Zararlı Türkçe Adı ve Latince İsmi (Örn: Erken Yaprak Yanıklığı - Alternaria solani)",
  "confidence": "%95",
  "description": "Görseldeki semptomların detaylı yapay zeka analizi ve leke/hasar tanımı.",
  "culturalControls": ["Kültürel önlem 1", "Kültürel önlem 2"],
  "activeIngredients": ["Aktif Madde 1 (örn. Azoxystrobin)", "Aktif Madde 2"],
  "commercialNames": ["Örnek İlaç 1", "Örnek İlaç 2"],
  "solutionDescription": "Uygulama zamanı, dozu ve dikkat edilmesi gereken noktalar.",
  "phiDays": "Hasat arası bekleme süresi (örn: 7 gün)"
}

${n?`Kullanıcı Notu/Bitki Bilgisi: ${n}`:""}`,t=i.replace(/^data:image\/\w+;base64,/,"");return await c(y,[{role:"user",parts:[{text:s},{inlineData:{mimeType:r,data:t}}]}])};export{y as D,g as a,E as b,c as g};
