import{f as l,r as dt,l as ct}from"./index-rjvFXrhA.js";import{f as U}from"./format-ChEiFIbp.js";async function xt(Z){const{targetYear:r,farmers:H,inventory:k,prescriptions:$,payments:q,manualDebts:P,myPayments:S,suppliers:_,supplierPurchases:G,accounts:J,expenses:Q,userProfile:a}=Z,i=(a==null?void 0:a.currency)||"TRY",W=$.filter(t=>{if(t.deletedAt)return!1;if(t.date){const e=new Date(t.date).getFullYear();return!isNaN(e)&&e===r}return!1}),X=Q.filter(t=>{if(t.deletedAt)return!1;if(t.date){const e=new Date(t.date).getFullYear();return!isNaN(e)&&e===r}return!1}),m={};let u=0,h=0;W.forEach(t=>{const e=t.type==="RETURN";t.items.forEach(s=>{const d=String(s.quantity||"0").replace(",","."),n=parseFloat(d)||0;if(n<=0)return;const o=k.find(pt=>pt.pesticideId===s.pesticideId),y=s.unitPrice||0,j=s.buyingPrice||(o==null?void 0:o.buyingPrice)||0,x=s.totalPrice||n*y,g=n*j,lt=s.pesticideName||(o==null?void 0:o.pesticideName)||"İsimsiz Ürün",st=(o==null?void 0:o.category)||"Diğer",rt=(o==null?void 0:o.unit)||"Adet";m[s.pesticideId]||(m[s.pesticideId]={name:lt,category:st,unit:rt,qtySold:0,revenue:0,cost:0,profit:0});const f=m[s.pesticideId];e?(f.qtySold-=n,f.revenue-=x,f.cost-=g,u-=x,h-=g):(f.qtySold+=n,f.revenue+=x,f.cost+=g,u+=x,h+=g),f.profit=f.revenue-f.cost})});const tt=u-h,E=X.reduce((t,e)=>t+(e.amount||0),0),c=tt-E,b=[];let z=0,R=0;H.forEach(t=>{if(t.deletedAt)return;let e=0,s=0,d=0;$.forEach(o=>{o.farmerId===t.id&&!o.deletedAt&&o.priceType!=="CASH"&&new Date(o.date).getFullYear()<=r&&(e+=o.totalAmount||0)}),P.forEach(o=>{o.farmerId===t.id&&!o.deletedAt&&new Date(o.date).getFullYear()<=r&&(s+=o.amount||0)}),q.forEach(o=>{o.farmerId===t.id&&!o.deletedAt&&new Date(o.date).getFullYear()<=r&&(d+=o.amount||0)});const n=e+s-d;n>0?(z+=n,b.push({name:t.fullName,phone:t.phoneNumber||"-",balance:n,status:"BORÇLU (ALACAKLIYIZ)"})):n<0&&(R+=Math.abs(n),b.push({name:t.fullName,phone:t.phoneNumber||"-",balance:n,status:"ALACAKLI (BORÇLUYUZ)"}))}),b.sort((t,e)=>e.balance-t.balance);const T=[];let D=0;_.forEach(t=>{if(t.deletedAt)return;let e=0,s=0;G.forEach(n=>{var o,y;if(n.supplierId===t.id&&!n.deletedAt&&new Date(n.date).getFullYear()<=r){const x=n.type==="SALE"||((o=n.note)==null?void 0:o.includes("SATIŞ")),g=n.type==="RETURN"||((y=n.note)==null?void 0:y.includes("İADE"))&&!x;x||g||n.totalAmount&&n.totalAmount<0?s+=Math.abs(n.totalAmount||0):e+=n.totalAmount||0}}),S.forEach(n=>{n.supplierId===t.id&&!n.deletedAt&&n.status!=="CANCELLED"&&new Date(n.issueDate).getFullYear()<=r&&(s+=n.amount||0)});const d=e-s;d!==0&&(d>0&&(D+=d),T.push({name:t.name,phone:t.phoneNumber||"-",balance:d}))});const L=[];let M=0,N=0;k.forEach(t=>{if(t.deletedAt)return;const e=t.quantity,s=e*(t.buyingPrice||0),d=e*(t.sellingPrice||0);M+=s,N+=d,L.push({name:t.pesticideName,category:t.category||"Diğer",stock:e,unit:t.unit||"Adet",costValue:s,retailValue:d})});let C=0;const et=J.map(t=>(C+=t.balance||0,{name:t.name,type:t.type==="CASH"?"Kasa (Nakit)":"Banka / POS",balance:t.balance||0})),K=S.filter(t=>!t.deletedAt&&t.status!=="CANCELLED"),B=K.filter(t=>t.farmerId),I=K.filter(t=>t.supplierId),v=B.reduce((t,e)=>t+(e.amount||0),0),A=I.reduce((t,e)=>t+(e.amount||0),0),p=document.createElement("div");p.style.position="absolute",p.style.left="-9999px",p.style.top="0",p.style.width="850px",p.style.backgroundColor="#ffffff",p.style.padding="36px",p.style.color="#1c1917",p.style.fontFamily="system-ui, -apple-system, sans-serif";const at=((a==null?void 0:a.companyName)||"MKS ZİRAİ SİSTEMLERİ").toLocaleUpperCase("tr-TR"),ot=((a==null?void 0:a.stampTitle)||(a==null?void 0:a.companyName)||"MKS SİSTEMİ").toLocaleUpperCase("tr-TR"),nt=(a==null?void 0:a.stampSubTitle)||(a!=null&&a.title?`${a.title} ${(a==null?void 0:a.fullName)||""}`:(a==null?void 0:a.fullName)||"Ziraat Mühendisi"),it=(a==null?void 0:a.stampTaxInfo)||"Vergi D. - 1234567890",w=(a==null?void 0:a.stampColor)||"#059669",Y=Object.values(m).sort((t,e)=>e.revenue-t.revenue).map((t,e)=>`
      <tr style="background-color: ${e%2===0?"#fafaf9":"#ffffff"}; border-bottom: 1px solid #e7e5e4; font-size: 10px;">
        <td style="padding: 6px 8px; font-weight: 700;">${t.name}</td>
        <td style="padding: 6px 8px; color: #57534e;">${t.category}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace;">${t.qtySold} ${t.unit}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 600;">${l(t.revenue,i)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #78716c;">${l(t.cost,i)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: ${t.profit>=0?"#059669":"#dc2626"};">
          ${t.profit>=0?"+":""}${l(t.profit,i)}
        </td>
      </tr>
    `).join(""),O=b.slice(0,30).map((t,e)=>`
    <tr style="background-color: ${e%2===0?"#fafaf9":"#ffffff"}; border-bottom: 1px solid #e7e5e4; font-size: 10px;">
      <td style="padding: 6px 8px; font-weight: 700;">${t.name}</td>
      <td style="padding: 6px 8px; color: #78716c;">${t.phone}</td>
      <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: ${t.balance>0?"#059669":"#dc2626"};">${t.status}</td>
      <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: ${t.balance>0?"#059669":"#dc2626"};">
        ${l(t.balance,i)}
      </td>
    </tr>
  `).join(""),V=T.map((t,e)=>`
    <tr style="background-color: ${e%2===0?"#fafaf9":"#ffffff"}; border-bottom: 1px solid #e7e5e4; font-size: 10px;">
      <td style="padding: 6px 8px; font-weight: 700;">${t.name}</td>
      <td style="padding: 6px 8px; color: #78716c;">${t.phone}</td>
      <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: #dc2626;">
        ${l(t.balance,i)}
      </td>
    </tr>
  `).join(""),F=et.map((t,e)=>`
    <tr style="background-color: ${e%2===0?"#fafaf9":"#ffffff"}; border-bottom: 1px solid #e7e5e4; font-size: 10px;">
      <td style="padding: 6px 8px; font-weight: 700;">${t.name}</td>
      <td style="padding: 6px 8px; color: #57534e;">${t.type}</td>
      <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: ${t.balance>=0?"#059669":"#dc2626"};">
        ${l(t.balance,i)}
      </td>
    </tr>
  `).join("");p.innerHTML=`
    <!-- HEADER -->
    <div style="border-bottom: 3px solid #059669; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1 style="font-size: 22px; font-weight: 900; color: #059669; margin: 0 0 4px 0; text-transform: uppercase;">
          ${at}
        </h1>
        <h2 style="font-size: 16px; font-weight: 800; color: #1c1917; margin: 0;">
          ${r} YILI SENE SONU DEVİR VE RESMİ FİNANSAL BİLANÇO RAPORU
        </h2>
        <p style="font-size: 11px; color: #78716c; margin: 4px 0 0 0;">
          İşletmenizin ${r} yılı kârlılık, cari, stok, borç ve ortaklık hesap raporudur.
        </p>
      </div>
      <div style="text-align: right; font-size: 10px; color: #57534e;">
        <p style="margin: 0;"><strong>Rapor Tarihi:</strong> ${U(new Date,"dd.MM.yyyy HH:mm")}</p>
        <p style="margin: 2px 0 0 0;"><strong>Devir Yılı:</strong> ${r}</p>
        <p style="margin: 2px 0 0 0;"><strong>Yetkili:</strong> ${(a==null?void 0:a.fullName)||"Ziraat Mühendisi"}</p>
      </div>
    </div>

    <!-- 1. KÂR / ZARAR VE ÖZET MİLANDI HESABI -->
    <div style="margin-bottom: 24px; background-color: #f0fdf4; border: 1.5px solid #10b981; border-radius: 12px; padding: 16px;">
      <h3 style="font-size: 13px; font-weight: 900; color: #065f46; margin: 0 0 12px 0; text-transform: uppercase; border-bottom: 1px solid #a7f3d0; padding-bottom: 6px;">
        📊 1. ${r} Yılı Genel Finansal Özet & Kâr / Zarar Tablosu
      </h3>
      <div style="display: grid; grid-template-cols: repeat(4, 1fr); gap: 12px;">
        <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #d1fae5;">
          <span style="font-size: 9px; color: #047857; font-weight: 800; text-transform: uppercase; display: block;">Toplam Satış Ciro</span>
          <span style="font-size: 14px; font-weight: 900; color: #065f46; font-family: monospace;">${l(u,i)}</span>
        </div>
        <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #d1fae5;">
          <span style="font-size: 9px; color: #047857; font-weight: 800; text-transform: uppercase; display: block;">Satılan Mal Maliyeti (STMM)</span>
          <span style="font-size: 14px; font-weight: 900; color: #78716c; font-family: monospace;">${l(h,i)}</span>
        </div>
        <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #d1fae5;">
          <span style="font-size: 9px; color: #047857; font-weight: 800; text-transform: uppercase; display: block;">Toplam İşletme Giderleri</span>
          <span style="font-size: 14px; font-weight: 900; color: #dc2626; font-family: monospace;">${l(E,i)}</span>
        </div>
        <div style="background: white; padding: 10px; border-radius: 8px; border: 1.5px solid ${c>=0?"#10b981":"#ef4444"};">
          <span style="font-size: 9px; color: ${c>=0?"#047857":"#991b1b"}; font-weight: 800; text-transform: uppercase; display: block;">Net İşletme Kârı / Zararı</span>
          <span style="font-size: 15px; font-weight: 900; color: ${c>=0?"#059669":"#dc2626"}; font-family: monospace;">
            ${c>=0?"+":""}${l(c,i)}
          </span>
        </div>
      </div>

      <!-- ORTAKLIK PAYLAŞIM ANALİZİ -->
      <div style="margin-top: 14px; pt-10px; border-top: 1px dashed #a7f3d0; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 10px 14px; border-radius: 8px; border: 1px solid #a7f3d0;">
        <div>
          <span style="font-size: 10px; font-weight: 900; color: #065f46; text-transform: uppercase; block;">🤝 Ortaklık & Hisseli Paylaşım Analizi</span>
          <span style="font-size: 9px; color: #047857;">Net kâr / zarar tutarının eşit ortak sayısına göre dağılımı:</span>
        </div>
        <div style="display: flex; gap: 16px; font-size: 10px; font-family: monospace;">
          <div>
            <span style="color: #78716c; font-weight: 700;">2 Eşit Ortaklı:</span>
            <span style="font-weight: 900; color: ${c>=0?"#059669":"#dc2626"}; ml-1">
              Ortak Başı ${l(c/2,i)}
            </span>
          </div>
          <div>
            <span style="color: #78716c; font-weight: 700;">3 Eşit Ortaklı:</span>
            <span style="font-weight: 900; color: ${c>=0?"#059669":"#dc2626"}; ml-1">
              Ortak Başı ${l(c/3,i)}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. STOK VE DEPO DURUMU -->
    <div style="margin-bottom: 24px; background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="font-size: 12px; font-weight: 900; color: #1c1917; margin: 0; text-transform: uppercase;">
          📦 2. Depo & Stok Durumu Ve Varlık Değerlemesi
        </h3>
        <div style="font-size: 10px; font-weight: 800; font-family: monospace; color: #059669;">
          Toplam Depo Alış Değeri: ${l(M,i)} | Perakende Satış Değeri: ${l(N,i)}
        </div>
      </div>
      <p style="font-size: 9px; color: #78716c; margin: 0 0 8px 0;">
        Devredilen yıl sonu itibarıyla depoda kayıtlı bulunan toplam <strong>${L.length} adet</strong> ürün stoğu ve güncel maliyet değerleridir.
      </p>
    </div>

    <!-- 3. KASA, BANKA VE ÇEKLER -->
    <div style="margin-bottom: 24px; display: grid; grid-template-cols: 1fr 1fr; gap: 16px;">
      <!-- KASALAR VE BANKALAR -->
      <div style="background: #ffffff; border: 1px solid #e7e5e4; border-radius: 10px; padding: 12px;">
        <h3 style="font-size: 11px; font-weight: 900; color: #1c1917; margin: 0 0 8px 0; text-transform: uppercase; border-bottom: 1px solid #f5f5f4; padding-bottom: 4px;">
          💰 Kasalar & Banka Varlıkları
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f5f5f4; font-size: 9px; text-align: left; color: #57534e;">
              <th style="padding: 4px 6px;">Hesap Adı</th>
              <th style="padding: 4px 6px;">Tür</th>
              <th style="padding: 4px 6px; text-align: right;">Bakiye</th>
            </tr>
          </thead>
          <tbody>
            ${F.length>0?F:'<tr><td colspan="3" style="padding:8px; text-align:center; font-size:10px; color:#a8a29e;">Kasa/Banka hesabı yok</td></tr>'}
          </tbody>
        </table>
        <div style="margin-top: 8px; text-align: right; font-size: 11px; font-weight: 900; color: #059669; font-family: monospace;">
          Toplam Likit Varlık: ${l(C,i)}
        </div>
      </div>

      <!-- ÇEK VE SENETLER -->
      <div style="background: #ffffff; border: 1px solid #e7e5e4; border-radius: 10px; padding: 12px;">
        <h3 style="font-size: 11px; font-weight: 900; color: #1c1917; margin: 0 0 8px 0; text-transform: uppercase; border-bottom: 1px solid #f5f5f4; padding-bottom: 4px;">
          📑 Çekler, Senetler & Kart Portföyü
        </h3>
        <div style="space-y: 6px; font-size: 10px;">
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f5f5f4;">
            <span style="color: #57534e;">Müşteri Çek/Senet Alacakları (${B.length} Adet):</span>
            <span style="font-weight: 800; font-family: monospace; color: #059669;">+${l(v,i)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f5f5f4;">
            <span style="color: #57534e;">Tedarikçi Çek/Senet Borçları (${I.length} Adet):</span>
            <span style="font-weight: 800; font-family: monospace; color: #dc2626;">-${l(A,i)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; font-weight: 900;">
            <span style="color: #1c1917;">Net Vadeli Çek Pozisyonu:</span>
            <span style="font-family: monospace; color: ${v-A>=0?"#059669":"#dc2626"};">
              ${l(v-A,i)}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. ÇİFTÇİ CARİ HESAP BAKİYELERİ (PIYASA ALACAKLARI) -->
    <div style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h3 style="font-size: 12px; font-weight: 900; color: #1c1917; margin: 0; text-transform: uppercase;">
          👥 4. Çiftçi (Cari) Borç & Alacak Durumu
        </h3>
        <div style="font-size: 10px; font-weight: 800; font-family: monospace; color: #059669;">
          Toplam Piyasa Alacağımız: ${l(z,i)} | Çiftçi Alacakları: ${l(R,i)}
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #1c1917; color: white; font-size: 9px; text-align: left;">
            <th style="padding: 6px 8px;">Çiftçi Adı Soyadı</th>
            <th style="padding: 6px 8px;">Telefon</th>
            <th style="padding: 6px 8px; text-align: center;">Durum</th>
            <th style="padding: 6px 8px; text-align: right;">Bakiye</th>
          </tr>
        </thead>
        <tbody>
          ${O.length>0?O:'<tr><td colspan="4" style="padding:10px; text-align:center; font-size:10px; color:#78716c;">Devir öncesi bakiyesi olan çiftçi bulunamadı.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 5. TEDARİKCİ (BAYİ/FİRMA) BORÇLARI -->
    <div style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h3 style="font-size: 12px; font-weight: 900; color: #1c1917; margin: 0; text-transform: uppercase;">
          🏭 5. Tedarikçi (Bayi) Borç Dökümü
        </h3>
        <div style="font-size: 10px; font-weight: 800; font-family: monospace; color: #dc2626;">
          Toplam Tedarikçi Borcumuz: ${l(D,i)}
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #1c1917; color: white; font-size: 9px; text-align: left;">
            <th style="padding: 6px 8px;">Tedarikçi Firma</th>
            <th style="padding: 6px 8px;">Telefon</th>
            <th style="padding: 6px 8px; text-align: right;">Borç Bakiyesi</th>
          </tr>
        </thead>
        <tbody>
          ${V.length>0?V:'<tr><td colspan="3" style="padding:10px; text-align:center; font-size:10px; color:#78716c;">Tedarikçi borcu bulunamadı.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 6. ÜRÜN BAZLI KÂRLILIK DÖKÜMÜ -->
    <div style="margin-bottom: 30px;">
      <h3 style="font-size: 12px; font-weight: 900; color: #1c1917; margin: 0 0 8px 0; text-transform: uppercase;">
        🌾 6. Ürün Bazlı Satış ve Kârlılık Analizi (${r})
      </h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #047857; color: white; font-size: 9px; text-align: left;">
            <th style="padding: 6px 8px;">Ürün Adı</th>
            <th style="padding: 6px 8px;">Kategori</th>
            <th style="padding: 6px 8px; text-align: right;">Satış Miktarı</th>
            <th style="padding: 6px 8px; text-align: right;">Toplam Ciro</th>
            <th style="padding: 6px 8px; text-align: right;">Tahmini Maliyet</th>
            <th style="padding: 6px 8px; text-align: right;">Net Ürün Kârı</th>
          </tr>
        </thead>
        <tbody>
          ${Y.length>0?Y:'<tr><td colspan="6" style="padding:10px; text-align:center; font-size:10px; color:#78716c;">Satış yapılan ürün bulunamadı.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- RESMİ KAŞE VE MKS DİJİTAL SİSTEM İMZASI -->
    <div style="margin-top: 32px; padding-top: 16px; border-top: 2px dashed #e7e5e4; display: flex; justify-content: space-between; align-items: flex-end;">
      <div style="font-size: 9.5px; color: #78716c; font-family: monospace; line-height: 1.4;">
        Bu rapor Mühendis Kayıt Sistemi (MKS) tarafından otomatik oluşturulmuştur.<br/>
        Rapor Oluşturma Zamanı: ${U(new Date,"dd.MM.yyyy HH:mm:ss")}<br/>
        Sene Sonu Devir Tescil Kodu: MKS-DEVIR-${r}-${Math.random().toString(36).substring(2,7).toUpperCase()}
      </div>

      <div style="border: 2.5px solid ${w}; border-radius: 8px; padding: 10px 16px; transform: rotate(-2deg); color: ${w}; text-align: center; max-width: 260px;">
        <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid ${w}; padding-bottom: 4px; margin-bottom: 4px; font-family: serif;">
          ${ot}
        </div>
        <div style="font-size: 10px; font-weight: 800; margin-bottom: 2px;">
          ${nt}
        </div>
        <div style="font-size: 8.5px; opacity: 0.9; font-weight: 600;">
          ${it}
        </div>
        <div style="font-size: 8px; opacity: 0.8; margin-top: 2px; text-transform: uppercase;">
          Resmi Onaylı Sene Sonu Devir Raporu
        </div>
      </div>
    </div>
  `,document.body.appendChild(p);try{const t=await dt(p,{scale:2,backgroundColor:"#ffffff",logging:!1});document.body.removeChild(p),(await ct(t)).save(`MKS_${r}_Yil_Sonu_Devir_ve_Bilanço_Raporu.pdf`)}catch(t){throw document.body.contains(p)&&document.body.removeChild(p),console.error("Year End Report PDF generation error:",t),t}}export{xt as g};
