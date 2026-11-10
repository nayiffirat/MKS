const fs = require('fs');
let content = fs.readFileSync('components/Settings.tsx', 'utf8');

const importCode = `
import { dbService } from '../services/db';
`;
if (!content.includes("import { dbService }")) {
    content = content.replace("import { useAppViewModel }", "import { dbService }\nimport { useAppViewModel }");
}

const renderDataSectionCode = `
  const handleExportData = async () => {
    try {
      const data = await dbService.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`mks_yedek_\${new Date().toISOString().split('T')[0]}.json\`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Veriler başarıyla dışa aktarıldı', 'success');
      hapticFeedback('success');
    } catch (error) {
      showToast('Dışa aktarma hatası', 'error');
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonData = event.target?.result as string;
        if (jsonData) {
            await dbService.importData(jsonData);
            showToast('Veriler başarıyla içe aktarıldı. Lütfen uygulamayı yenileyin.', 'success');
            hapticFeedback('success');
            setTimeout(() => window.location.reload(), 2000);
        }
      } catch (error) {
        showToast('İçe aktarma hatası. Geçersiz dosya.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const renderDataSection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setActiveSection(null)} className="p-2 bg-stone-900 rounded-xl text-stone-400 hover:text-white">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Veri Yönetimi</h2>
          <p className="text-sm text-stone-400">Verilerinizi yedekleyin ve geri yükleyin</p>
        </div>
      </div>

      <div className="bg-stone-900 rounded-3xl p-6 border border-white/5 space-y-6">
        <div>
            <h3 className="text-lg font-bold text-white mb-2">Verileri Dışa Aktar</h3>
            <p className="text-sm text-stone-400 mb-4">Tüm uygulama verilerinizi (Çiftçiler, İşlemler, vb.) bir JSON dosyası olarak indirerek yedekleyebilirsiniz.</p>
            <button onClick={handleExportData} className="w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 p-4 rounded-xl font-bold hover:bg-emerald-500/30 transition-all flex justify-center items-center gap-2">
                <Download size={20} />
                Yedeği İndir
            </button>
        </div>
        <div className="h-px bg-white/5" />
        <div>
            <h3 className="text-lg font-bold text-white mb-2">Verileri İçe Aktar</h3>
            <p className="text-sm text-stone-400 mb-4">Daha önce aldığınız bir yedeği yükleyerek verilerinizi geri getirin. (Mevcut verilerinizin üzerine yazılacaktır!)</p>
            <label className="w-full bg-blue-500/20 text-blue-400 border border-blue-500/30 p-4 rounded-xl font-bold hover:bg-blue-500/30 transition-all flex justify-center items-center gap-2 cursor-pointer">
                <Upload size={20} />
                Yedeği Yükle
                <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
            </label>
        </div>
      </div>
    </div>
  );
`;

if (!content.includes("renderDataSection")) {
    content = content.replace("const renderGeneralSection = () => (", renderDataSectionCode + "\n  const renderGeneralSection = () => (");
}

const dataMenuButton = `
        <SettingsCard 
          icon={<Database size={24} />}
          title="Veri Yönetimi"
          description="Yedekle & Geri Yükle"
          onClick={() => setActiveSection('DATA')}
        />
`;

if (!content.includes("Veri Yönetimi")) {
    content = content.replace("title={t('settings.language.title')}", "title={t('settings.language.title')}"); // just to find spot
    content = content.replace(/<SettingsCard\s+icon={<Globe size=\{24\} \/>}.*?\/>/s, (match) => match + '\n' + dataMenuButton);
}

if (!content.includes("{activeSection === 'DATA' && renderDataSection()}")) {
    content = content.replace("{activeSection === 'SYSTEM' && renderSystemSection()}", "{activeSection === 'SYSTEM' && renderSystemSection()}\n      {activeSection === 'DATA' && renderDataSection()}");
}

const importsToAdd = [];
if (!content.includes("Download")) importsToAdd.push("Download");
if (!content.includes("Upload")) importsToAdd.push("Upload");
if (!content.includes("Database")) importsToAdd.push("Database");

if (importsToAdd.length > 0) {
    content = content.replace("import { ", "import { " + importsToAdd.join(", ") + ", ");
}

fs.writeFileSync('components/Settings.tsx', content);
