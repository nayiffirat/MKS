import { Plant } from '../types';

export const DEFAULT_PLANTS: Omit<Plant, 'id'>[] = [
  { name: 'Pamuk', category: 'ENDUSTRY', maturityDate: '10-31', defaultDosage: '30-40 kg/da', description: 'Bölgenin ana ürünü.', culturalPractices: 'Düzenli sulama ve zararlı takibi.' },
  { name: 'Buğday', category: 'TALA', maturityDate: '06-30', defaultDosage: '20-25 kg/da', description: 'Kışlık ekim ürünü.', culturalPractices: 'Baharda üst gübreleme.' },
  { name: 'Mısır (Dane)', category: 'TALA', maturityDate: '10-15', defaultDosage: '25-30 kg/da', description: 'Yüksek verim potansiyeli.', culturalPractices: 'Sık sulama ve azot ihtiyacı.' },
  { name: 'Mısır (Silaj)', category: 'TALA', maturityDate: '09-15', defaultDosage: '30-35 kg/da', description: 'Hayvan yemi üretimi.', culturalPractices: 'Hızlı gelişim dönemi takibi.' },
  { name: 'Domates', category: 'SEBZE', maturityDate: '08-31', defaultDosage: '5-10 ton/da', description: 'Sofralık ve sanayilik.', culturalPractices: 'Düzenli ilaçlama ve koltuk alma.' },
  { name: 'Ayçiçeği', category: 'ENDUSTRY', maturityDate: '08-20', defaultDosage: '15-20 kg/da', description: 'Yağlık üretim.', culturalPractices: 'Çıkış öncesi herbisit.' },
  { name: 'Zeytin', category: 'MEYVE', maturityDate: '12-31', defaultDosage: 'Ağaç başı 20-50kg', description: 'Ölmez ağaç.', culturalPractices: 'Budama ve halkalı leke mücadelesi.' },
  { name: 'Arpa', category: 'TALA', maturityDate: '06-15', defaultDosage: '20-25 kg/da', description: 'Erkenci hububat.', culturalPractices: 'Kardeşlenme başı azot.' },
  { name: 'Mercimek', category: 'TALA', maturityDate: '06-10', defaultDosage: '12-15 kg/da', description: 'Yemeklik baklagil.', culturalPractices: 'Yabancı ot kontrolü.' },
  { name: 'Nohut', category: 'TALA', maturityDate: '07-15', defaultDosage: '15-18 kg/da', description: 'Antraknoz takibi yapılmalı.', culturalPractices: 'Kuru tarıma uygun.' },
  { name: 'Fıstık', category: 'MEYVE', maturityDate: '10-31', defaultDosage: 'Periyodik', description: 'Antep fıstığı.', culturalPractices: 'Göz kurdu ve karazengi mücadelesi.' },
  { name: 'Üzüm (Bağ)', category: 'MEYVE', maturityDate: '09-30', defaultDosage: 'Değişken', description: 'Bağcılık.', culturalPractices: 'Kış budaması ve mildiyö kontrolü.' },
  { name: 'Biber', category: 'SEBZE', maturityDate: '09-15', defaultDosage: '3-4 ton/da', description: 'Kırmızı ve yeşil biber.', culturalPractices: 'Kalsiyum eksikliği takibi.' },
  { name: 'Patlıcan', category: 'SEBZE', maturityDate: '09-15', defaultDosage: '4-5 ton/da', description: 'Sıcak iklim bitkisi.', culturalPractices: 'Kırmızı örümcek takibi.' },
  { name: 'Karpuz', category: 'SEBZE', maturityDate: '08-15', defaultDosage: '5-8 ton/da', description: 'Yazlık ürün.', culturalPractices: 'Meyve büyütme sulaması.' },
  { name: 'Kavun', category: 'SEBZE', maturityDate: '08-15', defaultDosage: '3-4 ton/da', description: 'Tatlı kavun çeşitleri.', culturalPractices: 'Külleme mücadelesi.' },
  { name: 'Narenciye', category: 'MEYVE', maturityDate: '12-31', defaultDosage: 'Periyodik', description: 'Limon, Portakal, Mandalina.', culturalPractices: 'Don koruması ve uçkurutan takibi.' },
  { name: 'Fındık', category: 'MEYVE', maturityDate: '08-31', defaultDosage: 'Ocak başı 2-5kg', description: 'Karadeniz ana ürünü.', culturalPractices: 'Dip sürgün temizliği.' },
  { name: 'Çilek', category: 'SEBZE', maturityDate: '06-30', defaultDosage: '1-2 ton/da', description: 'Örtü altı ve açık saha.', culturalPractices: 'Malçlama ve damla sulama.' },
  { name: 'Patates', category: 'TALA', maturityDate: '09-30', defaultDosage: '3-5 ton/da', description: 'Yumru bitkisi.', culturalPractices: 'Boğaz doldurma ve siğil takibi.' },
  { name: 'Şeker Pancarı', category: 'ENDUSTRY', maturityDate: '11-30', defaultDosage: '6-8 ton/da', description: 'Polar odaklı üretim.', culturalPractices: 'Seyreltme ve yaprak lekesi kontrolü.' },
  { name: 'Susam', category: 'ENDUSTRY', maturityDate: '09-15', defaultDosage: '80-120 kg/da', description: 'Yağlı tohum.', culturalPractices: 'Hasat zamanlaması çok önemli.' },
  { name: 'Nar', category: 'MEYVE', maturityDate: '10-31', defaultDosage: 'Periyodik', description: 'Meyve çatlaması takibi.', culturalPractices: 'Düzenli su yönetimi.' },
  { name: 'Soya', category: 'ENDUSTRY', maturityDate: '10-15', defaultDosage: '300-450 kg/da', description: 'Protein kaynağı.', culturalPractices: 'Bakteri aşılaması.' },
  { name: 'Kanola', category: 'ENDUSTRY', maturityDate: '06-30', defaultDosage: '250-400 kg/da', description: 'Kışlık yağlı tohum.', culturalPractices: 'Hücum böceği takibi.' }
];
