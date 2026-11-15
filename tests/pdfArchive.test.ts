/**
 * Uygulama içi PDF arşivi ve jsPDF.save() yakalama testleri.
 * Çalıştırma: npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  clearArchivedPdfs,
  deleteArchivedPdf,
  inferPdfCategory,
  listArchivedPdfs
} from '../utils/pdfArchive';
import { loadJsPdf, loadJsPdfWithAutoTable } from '../utils/pdfHelper';

test('jsPDF ve autoTable .save() çağrıları arşive otomatik düşer, sıralanır ve silinebilir', async () => {
  await clearArchivedPdfs();

  const file1 = path.join(process.cwd(), '__test_ornek_fatura.pdf');
  const file2 = path.join(process.cwd(), '__test_ornek_tahsilat_makbuzu.pdf');

  try {
    const JsPdf = await loadJsPdf();
    const doc1 = new JsPdf();
    doc1.text('MKS Test Satis Faturasi', 10, 10);
    doc1.save(file1);

    await new Promise(resolve => setTimeout(resolve, 15));

    const { jsPDF: AutoTableJsPdf, autoTable } = await loadJsPdfWithAutoTable();
    const doc2 = new AutoTableJsPdf();
    autoTable(doc2, {
      head: [['Kalem', 'Tutar']],
      body: [['Tahsilat', '1500 TL']]
    });
    doc2.save(file2);

    const list = await listArchivedPdfs();
    assert.equal(list.length, 2);
    assert.equal(list[0].name, '__test_ornek_tahsilat_makbuzu.pdf');
    assert.equal(list[0].category, 'Tahsilat Makbuzu');
    assert.equal(list[1].name, '__test_ornek_fatura.pdf');
    assert.equal(list[1].category, 'Fatura / Reçete');
    assert.ok(list[0].size > 100);
    assert.ok(list[0].blob instanceof Blob);

    await deleteArchivedPdf(list[0].id);
    const afterDelete = await listArchivedPdfs();
    assert.equal(afterDelete.length, 1);
    assert.equal(afterDelete[0].name, '__test_ornek_fatura.pdf');

    await clearArchivedPdfs();
    const afterClear = await listArchivedPdfs();
    assert.equal(afterClear.length, 0);
  } finally {
    fs.rmSync(file1, { force: true });
    fs.rmSync(file2, { force: true });
    await clearArchivedPdfs();
  }
});

test('inferPdfCategory dosya adından belge türünü doğru sınıflandırır', () => {
  assert.equal(inferPdfCategory('Ahmet_Cari_Mutabakat_2026.pdf'), 'Mutabakat');
  assert.equal(inferPdfCategory('Ali_Tahsilat_Dekontu.pdf'), 'Tahsilat Makbuzu');
  assert.equal(inferPdfCategory('Mehmet_Satis_REC-102.pdf'), 'Fatura / Reçete');
  assert.equal(inferPdfCategory('Veli_Cari_Rapor.pdf'), 'Cari Ekstre & Rapor');
  assert.equal(inferPdfCategory('MKS_Depo_Raporu_tum.pdf'), 'Depo & Stok');
  assert.equal(inferPdfCategory('bkts_gts_denetim_defteri.pdf'), 'Resmî Denetim');
  assert.equal(inferPdfCategory('MKS_Analiz_2026.pdf'), 'Genel Rapor');
});
