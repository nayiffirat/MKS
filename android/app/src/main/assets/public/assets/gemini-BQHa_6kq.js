import{Y as k,A as c}from"./index-rjvFXrhA.js";const m="gemini-3-flash-preview",d=async(n,t,r)=>{const i=JSON.stringify({model:n,contents:t,config:r});let e=null;try{k.currentUser&&(e=await k.currentUser.getIdToken())}catch{e=null}const o={"Content-Type":"application/json",...e?{Authorization:`Bearer ${e}`}:{}},u=Array.from(new Set([`${c}/api/generate`,"/api/generate","http://127.0.0.1:3000/api/generate"]));let l="Yapay zeka servisine ulaşılamadı.";for(const y of u)try{const a=await fetch(y,{method:"POST",headers:o,body:i});if(!a.ok){l=(await a.json().catch(()=>({}))).error||`HTTP ${a.status}`;continue}const s=await a.json();if(s&&typeof s.text=="string"&&s.text.trim())return s.text}catch(a){l=(a==null?void 0:a.message)||String(a)}throw console.error("MKS AI Proxy Error:",l),new Error(l)},v=async(n,t,r)=>{const e=[{role:"user",parts:[{text:`${`Sen Türkiye'nin en deneyimli, uzman Ziraat Mühendisi ve MKS (Mühendis Kayıt Sistemi) Yapay Zeka Danışmanısın (TARGEM / TAGEM ve Ziraat Fakültesi teknik kaynaklarına %100 hakimsin).
Sana sorulan tarımsal veya işletme/stok/finans sorularına son derece detaylı, akademik ama çiftçi ve ziraat mühendisinin doğrudan sahada ve bayide uygulayabileceği pratik, net ve Türkçe yanıtlar ver.

Eğer soru bitki hastalıkları, zararlılar, gübreleme veya ilaçlama hakkındaysa şu başlıkları kullan:
1. **Teşhis & Durum Özeti**: Sorunun teknik ve fizyolojik tanımı.
2. **Kültürel ve Biyolojik Önlemler**: İlaçsız çözüm, havalandırma, budama, sulama, ekim nöbeti.
3. **Kimyasal Mücadele & Etken Maddeler**: Türkiye'de ruhsatlı resmi etken maddeler (Aktif maddeler), depodaki mevcut uygun ilaçlar ve örnek ticari isimler.
4. **Dozaj & PHI (Hasat Arası Süre)**: Uygulama zamanı ve güvenlik kuralları.
5. **Kritik Uyarılar**: Hava sıcaklığı, rüzgar, pH, tank karışım uyarıları.

Eğer soru MKS içindeki stoklar, çiftçi borçları, kasa durumu veya finansal analiz hakkındaysa aşağıdaki canlı işletme verilerini baz alarak net rakamlarla yanıt ver.
${t?`
İlgili Bitki Bağlamı: ${t}`:""}
${r?`
CANLI MKS İŞLETME & DEPO VERİLERİ:
${r}`:""}`}

Kullanıcı Sorusu: ${n}`}]}];return await d(m,e)},A=async(n,t="image/jpeg",r)=>{const i=`Sen uzman bir Bitki Koruma Ziraat Mühendisisin. Gönderilen yaprak/bitki fotoğrafını detaylı analiz et.

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

${r?`Kullanıcı Notu/Bitki Bilgisi: ${r}`:""}`,e=n.replace(/^data:image\/\w+;base64,/,"");return await d(m,[{role:"user",parts:[{text:i},{inlineData:{mimeType:t,data:e}}]}])};export{m as D,v as a,A as b,d as g};
