import{c as wt,aw as kt,f as n,r as $t,s as St}from"./index-B8CJcsG8.js";import{e as s}from"./html-6fqo2KgN.js";import{f as G}from"./format-ChEiFIbp.js";async function Dt(J){const{targetYear:p,farmers:Q,inventory:E,prescriptions:R,payments:W,manualDebts:X,myPayments:tt,suppliers:et,supplierPurchases:at,supplierPayments:ot=[],accounts:nt,expenses:it,userProfile:a}=J,o=(a==null?void 0:a.currency)||"TRY",y=t=>{if(!t)return!1;const e=new Date(t).getFullYear();return!Number.isNaN(e)&&e<=p},st=R.filter(t=>{if(t.deletedAt||t.isProcessed===!1)return!1;if(t.date){const e=new Date(t.date).getFullYear();return!isNaN(e)&&e===p}return!1}),rt=it.filter(t=>{if(t.deletedAt)return!1;if(t.date){const e=new Date(t.date).getFullYear();return!isNaN(e)&&e===p}return!1}),m={};let u=0,h=0;st.forEach(t=>{const e=t.type==="RETURN";t.items.forEach(i=>{const d=String(i.quantity||"0").replace(",","."),g=parseFloat(d)||0;if(g<=0)return;const l=E.find(At=>At.pesticideId===i.pesticideId),mt=i.unitPrice||0,ut=i.buyingPrice||(l==null?void 0:l.buyingPrice)||0,A=Math.abs(i.totalPrice||g*mt),w=g*ut,ht=i.pesticideName||(l==null?void 0:l.pesticideName)||"İsimsiz Ürün",bt=(l==null?void 0:l.category)||"Diğer",vt=(l==null?void 0:l.unit)||"Adet";m[i.pesticideId]||(m[i.pesticideId]={name:ht,category:bt,unit:vt,qtySold:0,revenue:0,cost:0,profit:0});const f=m[i.pesticideId];e?(f.qtySold-=g,f.revenue-=A,f.cost-=w,u-=A,h-=w):(f.qtySold+=g,f.revenue+=A,f.cost+=w,u+=A,h+=w),f.profit=f.revenue-f.cost})});const lt=u-h,D=rt.reduce((t,e)=>t+(e.amount||0),0),c=lt-D,T=R.filter(t=>!t.deletedAt&&y(t.date)),N=X.filter(t=>!t.deletedAt&&y(t.date)),M=W.filter(t=>!t.deletedAt&&y(t.date)),b=tt.filter(t=>{if(t.deletedAt)return!1;if(t.relatedId){const e=t.issueDate||t.dueDate?new Date(t.issueDate||t.dueDate).getFullYear():NaN;return Number.isNaN(e)||e<=p}return y(t.issueDate||t.dueDate)}),L=new Map,x=new Set;Q.forEach(t=>{t.deletedAt||(L.set(t.id,t),x.add(t.id))}),T.forEach(t=>{t.farmerId&&x.add(t.farmerId)}),N.forEach(t=>{t.farmerId&&x.add(t.farmerId)}),M.forEach(t=>{t.farmerId&&x.add(t.farmerId)}),b.forEach(t=>{t.farmerId&&x.add(t.farmerId)});const v=[];let K=0,C=0;x.forEach(t=>{const e=L.get(t),d=wt({farmerId:t,prescriptions:T,manualDebts:N,payments:M,myPayments:b}).netDebt;d>=.01?(K+=d,v.push({name:(e==null?void 0:e.fullName)||"Kayıtsız Müstahsil",phone:(e==null?void 0:e.phoneNumber)||"-",balance:d,status:"BORÇLU (ALACAKLIYIZ)"})):d<=-.01&&(C+=Math.abs(d),v.push({name:(e==null?void 0:e.fullName)||"Kayıtsız Müstahsil",phone:(e==null?void 0:e.phoneNumber)||"-",balance:d,status:"ALACAKLI (BORÇLUYUZ)"}))}),v.sort((t,e)=>e.balance-t.balance);const pt=at.filter(t=>!t.deletedAt&&y(t.date)),dt=ot.filter(t=>!t.deletedAt&&y(t.date)),k=[];let B=0;et.forEach(t=>{if(t.deletedAt)return;const e=kt({supplierId:t.id,purchases:pt,supplierPayments:dt,myPayments:b});if(Math.abs(e.signedBalance)>=.01){const i=-e.signedBalance;i>0&&(B+=i),k.push({name:t.name,phone:t.phoneNumber||"-",balance:i,isReceivable:i<0})}}),k.sort((t,e)=>e.balance-t.balance);const I=[];let O=0,Y=0;E.forEach(t=>{if(t.deletedAt)return;const e=Number(t.quantity)||0,i=e*(t.buyingPrice||0),d=e*(t.sellingPrice||0);O+=i,Y+=d,I.push({name:t.pesticideName,category:t.category||"Diğer",stock:e,unit:t.unit||"Adet",costValue:i,retailValue:d})});let V=0;const ct=nt.filter(t=>!t.deletedAt).map(t=>(V+=t.balance||0,{name:t.name,type:t.type==="CASH"?"Kasa (Nakit)":"Banka / POS",balance:t.balance||0})),F=b.filter(t=>!t.deletedAt&&t.status!=="CANCELLED"&&t.portfolioStatus!=="BOUNCED"),P=F.filter(t=>t.farmerId),j=F.filter(t=>t.supplierId),$=P.reduce((t,e)=>t+(e.amount||0),0),S=j.reduce((t,e)=>t+(e.amount||0),0),r=document.createElement("div");r.style.position="absolute",r.style.left="-9999px",r.style.top="0",r.style.width="850px",r.style.backgroundColor="#ffffff",r.style.padding="36px",r.style.color="#1c1917",r.style.fontFamily="system-ui, -apple-system, sans-serif";const ft=s(((a==null?void 0:a.companyName)||"MKS ZİRAİ SİSTEMLERİ").toLocaleUpperCase("tr-TR")),yt=s(((a==null?void 0:a.stampTitle)||(a==null?void 0:a.companyName)||"MKS SİSTEMİ").toLocaleUpperCase("tr-TR")),xt=s((a==null?void 0:a.stampSubTitle)||(a!=null&&a.title?`${a.title} ${(a==null?void 0:a.fullName)||""}`:(a==null?void 0:a.fullName)||"Ziraat Mühendisi")),gt=s((a==null?void 0:a.stampTaxInfo)||"Vergi D. - 1234567890"),U=String((a==null?void 0:a.stampColor)||"#059669"),z=/^#[0-9a-fA-F]{3,8}$/.test(U)?U:"#059669",Z=Object.values(m).sort((t,e)=>e.revenue-t.revenue).map((t,e)=>`
      <tr style="background-color: ${e%2===0?"#fafaf9":"#ffffff"}; border-bottom: 1px solid #e7e5e4; font-size: 10px;">
        <td style="padding: 6px 8px; font-weight: 700;">${s(t.name)}</td>
        <td style="padding: 6px 8px; color: #57534e;">${s(t.category)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace;">${Number(t.qtySold.toFixed(2))} ${s(t.unit)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 600;">${n(t.revenue,o)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #78716c;">${n(t.cost,o)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: ${t.profit>=0?"#059669":"#dc2626"};">
          ${t.profit>=0?"+":""}${n(t.profit,o)}
        </td>
      </tr>
    `).join(""),H=v.map((t,e)=>`
    <tr style="background-color: ${e%2===0?"#fafaf9":"#ffffff"}; border-bottom: 1px solid #e7e5e4; font-size: 10px;">
      <td style="padding: 6px 8px; font-weight: 700;">${s(t.name)}</td>
      <td style="padding: 6px 8px; color: #78716c;">${s(t.phone)}</td>
      <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: ${t.balance>0?"#059669":"#dc2626"};">${s(t.status)}</td>
      <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: ${t.balance>0?"#059669":"#dc2626"};">
        ${n(Math.abs(t.balance),o)}
      </td>
    </tr>
  `).join(""),q=k.map((t,e)=>`
    <tr style="background-color: ${e%2===0?"#fafaf9":"#ffffff"}; border-bottom: 1px solid #e7e5e4; font-size: 10px;">
      <td style="padding: 6px 8px; font-weight: 700;">${s(t.name)}</td>
      <td style="padding: 6px 8px; color: #78716c;">${s(t.phone)}</td>
      <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: ${t.isReceivable?"#059669":"#dc2626"};">
        ${t.isReceivable?"ALACAKLIYIZ: ":""}${n(Math.abs(t.balance),o)}
      </td>
    </tr>
  `).join(""),_=ct.map((t,e)=>`
    <tr style="background-color: ${e%2===0?"#fafaf9":"#ffffff"}; border-bottom: 1px solid #e7e5e4; font-size: 10px;">
      <td style="padding: 6px 8px; font-weight: 700;">${s(t.name)}</td>
      <td style="padding: 6px 8px; color: #57534e;">${s(t.type)}</td>
      <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: ${t.balance>=0?"#059669":"#dc2626"};">
        ${n(t.balance,o)}
      </td>
    </tr>
  `).join("");r.innerHTML=`
    <!-- HEADER -->
    <div style="border-bottom: 3px solid #059669; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1 style="font-size: 22px; font-weight: 900; color: #059669; margin: 0 0 4px 0; text-transform: uppercase;">
          ${ft}
        </h1>
        <h2 style="font-size: 16px; font-weight: 800; color: #1c1917; margin: 0;">
          ${p} YILI SENE SONU DEVİR VE RESMİ FİNANSAL BİLANÇO RAPORU
        </h2>
        <p style="font-size: 11px; color: #78716c; margin: 4px 0 0 0;">
          İşletmenizin ${p} yılı kârlılık, cari, stok, borç ve ortaklık hesap raporudur.
        </p>
      </div>
      <div style="text-align: right; font-size: 10px; color: #57534e;">
        <p style="margin: 0;"><strong>Rapor Tarihi:</strong> ${G(new Date,"dd.MM.yyyy HH:mm")}</p>
        <p style="margin: 2px 0 0 0;"><strong>Devir Yılı:</strong> ${p}</p>
        <p style="margin: 2px 0 0 0;"><strong>Yetkili:</strong> ${s((a==null?void 0:a.fullName)||"Ziraat Mühendisi")}</p>
      </div>
    </div>

    <!-- 1. KÂR / ZARAR VE ÖZET MİLANDI HESABI -->
    <div style="margin-bottom: 24px; background-color: #f0fdf4; border: 1.5px solid #10b981; border-radius: 12px; padding: 16px;">
      <h3 style="font-size: 13px; font-weight: 900; color: #065f46; margin: 0 0 12px 0; text-transform: uppercase; border-bottom: 1px solid #a7f3d0; padding-bottom: 6px;">
        📊 1. ${p} Yılı Genel Finansal Özet & Kâr / Zarar Tablosu
      </h3>
      <div style="display: grid; grid-template-cols: repeat(4, 1fr); gap: 12px;">
        <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #d1fae5;">
          <span style="font-size: 9px; color: #047857; font-weight: 800; text-transform: uppercase; display: block;">Toplam Satış Ciro</span>
          <span style="font-size: 14px; font-weight: 900; color: #065f46; font-family: monospace;">${n(u,o)}</span>
        </div>
        <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #d1fae5;">
          <span style="font-size: 9px; color: #047857; font-weight: 800; text-transform: uppercase; display: block;">Satılan Mal Maliyeti (STMM)</span>
          <span style="font-size: 14px; font-weight: 900; color: #78716c; font-family: monospace;">${n(h,o)}</span>
        </div>
        <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #d1fae5;">
          <span style="font-size: 9px; color: #047857; font-weight: 800; text-transform: uppercase; display: block;">Toplam İşletme Giderleri</span>
          <span style="font-size: 14px; font-weight: 900; color: #dc2626; font-family: monospace;">${n(D,o)}</span>
        </div>
        <div style="background: white; padding: 10px; border-radius: 8px; border: 1.5px solid ${c>=0?"#10b981":"#ef4444"};">
          <span style="font-size: 9px; color: ${c>=0?"#047857":"#991b1b"}; font-weight: 800; text-transform: uppercase; display: block;">Net İşletme Kârı / Zararı</span>
          <span style="font-size: 15px; font-weight: 900; color: ${c>=0?"#059669":"#dc2626"}; font-family: monospace;">
            ${c>=0?"+":""}${n(c,o)}
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
              Ortak Başı ${n(c/2,o)}
            </span>
          </div>
          <div>
            <span style="color: #78716c; font-weight: 700;">3 Eşit Ortaklı:</span>
            <span style="font-weight: 900; color: ${c>=0?"#059669":"#dc2626"}; ml-1">
              Ortak Başı ${n(c/3,o)}
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
          Toplam Depo Alış Değeri: ${n(O,o)} | Perakende Satış Değeri: ${n(Y,o)}
        </div>
      </div>
      <p style="font-size: 9px; color: #78716c; margin: 0 0 8px 0;">
        Devredilen yıl sonu itibarıyla depoda kayıtlı bulunan toplam <strong>${I.length} adet</strong> ürün stoğu ve güncel maliyet değerleridir.
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
            ${_.length>0?_:'<tr><td colspan="3" style="padding:8px; text-align:center; font-size:10px; color:#a8a29e;">Kasa/Banka hesabı yok</td></tr>'}
          </tbody>
        </table>
        <div style="margin-top: 8px; text-align: right; font-size: 11px; font-weight: 900; color: #059669; font-family: monospace;">
          Toplam Likit Varlık: ${n(V,o)}
        </div>
      </div>

      <!-- ÇEK VE SENETLER -->
      <div style="background: #ffffff; border: 1px solid #e7e5e4; border-radius: 10px; padding: 12px;">
        <h3 style="font-size: 11px; font-weight: 900; color: #1c1917; margin: 0 0 8px 0; text-transform: uppercase; border-bottom: 1px solid #f5f5f4; padding-bottom: 4px;">
          📑 Çekler, Senetler & Kart Portföyü
        </h3>
        <div style="space-y: 6px; font-size: 10px;">
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f5f5f4;">
            <span style="color: #57534e;">Müşteri Çek/Senet Alacakları (${P.length} Adet):</span>
            <span style="font-weight: 800; font-family: monospace; color: #059669;">+${n($,o)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f5f5f4;">
            <span style="color: #57534e;">Tedarikçi Çek/Senet Borçları (${j.length} Adet):</span>
            <span style="font-weight: 800; font-family: monospace; color: #dc2626;">-${n(S,o)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; font-weight: 900;">
            <span style="color: #1c1917;">Net Vadeli Çek Pozisyonu:</span>
            <span style="font-family: monospace; color: ${$-S>=0?"#059669":"#dc2626"};">
              ${n($-S,o)}
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
          Toplam Piyasa Alacağımız: ${n(K,o)} | Çiftçi Alacakları: ${n(C,o)}
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
          ${H.length>0?H:'<tr><td colspan="4" style="padding:10px; text-align:center; font-size:10px; color:#78716c;">Devir öncesi bakiyesi olan çiftçi bulunamadı.</td></tr>'}
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
          Toplam Tedarikçi Borcumuz: ${n(B,o)}
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
          ${q.length>0?q:'<tr><td colspan="3" style="padding:10px; text-align:center; font-size:10px; color:#78716c;">Tedarikçi borcu bulunamadı.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 6. ÜRÜN BAZLI KÂRLILIK DÖKÜMÜ -->
    <div style="margin-bottom: 30px;">
      <h3 style="font-size: 12px; font-weight: 900; color: #1c1917; margin: 0 0 8px 0; text-transform: uppercase;">
        🌾 6. Ürün Bazlı Satış ve Kârlılık Analizi (${p})
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
          ${Z.length>0?Z:'<tr><td colspan="6" style="padding:10px; text-align:center; font-size:10px; color:#78716c;">Satış yapılan ürün bulunamadı.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- RESMİ KAŞE VE MKS DİJİTAL SİSTEM İMZASI -->
    <div style="margin-top: 32px; padding-top: 16px; border-top: 2px dashed #e7e5e4; display: flex; justify-content: space-between; align-items: flex-end;">
      <div style="font-size: 9.5px; color: #78716c; font-family: monospace; line-height: 1.4;">
        Bu rapor Mühendis Kayıt Sistemi (MKS) tarafından otomatik oluşturulmuştur.<br/>
        Rapor Oluşturma Zamanı: ${G(new Date,"dd.MM.yyyy HH:mm:ss")}<br/>
        Sene Sonu Devir Tescil Kodu: MKS-DEVIR-${p}-${Math.random().toString(36).substring(2,7).toUpperCase()}
      </div>

      <div style="border: 2.5px solid ${z}; border-radius: 8px; padding: 10px 16px; transform: rotate(-2deg); color: ${z}; text-align: center; max-width: 260px;">
        <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid ${z}; padding-bottom: 4px; margin-bottom: 4px; font-family: serif;">
          ${yt}
        </div>
        <div style="font-size: 10px; font-weight: 800; margin-bottom: 2px;">
          ${xt}
        </div>
        <div style="font-size: 8.5px; opacity: 0.9; font-weight: 600;">
          ${gt}
        </div>
        <div style="font-size: 8px; opacity: 0.8; margin-top: 2px; text-transform: uppercase;">
          Resmi Onaylı Sene Sonu Devir Raporu
        </div>
      </div>
    </div>
  `,document.body.appendChild(r);try{const t=await $t(r,{scale:2,backgroundColor:"#ffffff",logging:!1});document.body.removeChild(r),(await St(t)).save(`MKS_${p}_Yil_Sonu_Devir_ve_Bilanço_Raporu.pdf`)}catch(t){throw document.body.contains(r)&&document.body.removeChild(r),console.error("Year End Report PDF generation error:",t),t}}export{Dt as g};
