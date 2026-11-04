// Generates the demo seed files (SPEC §16) deterministically.
//   node scripts/gen-seed.mjs
// Writes src/data/mock/seed/*.json and public/catalog.json. All names are fictional, all times are
// relative ("*_minutes_ago") so freshness states stay varied on any day the demo runs.
import { mkdirSync, writeFileSync } from 'node:fs';

const SEED_DIR = new URL('../src/data/mock/seed/', import.meta.url);
const PUBLIC_DIR = new URL('../public/', import.meta.url);

// Small deterministic PRNG (mulberry32) so regenerating gives identical files.
let state = 20261103;
const rand = () => {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const between = (a, b) => Math.round(a + rand() * (b - a));
const chance = (p) => rand() < p;
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
};

// ---------------------------------------------------------------- governorates
const areas = [
  ['center', 'وسط المدينة', 'City center'],
  ['east', 'الحي الشرقي', 'East district'],
  ['west', 'الحي الغربي', 'West district'],
  ['north', 'الحي الشمالي', 'North district'],
];
const gov = (id, region, name_ar, name_en, lat, lng) => ({
  id,
  region,
  name_ar,
  name_en,
  center: { lat, lng },
  areas: areas.map(([aid, ar, en]) => ({ id: aid, name_ar: ar, name_en: en })),
});
const governorates = [
  gov('north_gaza', 'gaza', 'شمال غزة', 'North Gaza', 31.545, 34.505),
  gov('gaza', 'gaza', 'غزة', 'Gaza', 31.505, 34.464),
  gov('deir_al_balah', 'gaza', 'دير البلح', 'Deir al-Balah', 31.418, 34.351),
  gov('khan_younis', 'gaza', 'خان يونس', 'Khan Younis', 31.345, 34.306),
  gov('rafah', 'gaza', 'رفح', 'Rafah', 31.287, 34.252),
  gov('jenin', 'west_bank', 'جنين', 'Jenin', 32.461, 35.3),
  gov('tubas', 'west_bank', 'طوباس', 'Tubas', 32.321, 35.369),
  gov('tulkarm', 'west_bank', 'طولكرم', 'Tulkarm', 32.31, 35.028),
  gov('nablus', 'west_bank', 'نابلس', 'Nablus', 32.222, 35.262),
  gov('qalqilya', 'west_bank', 'قلقيلية', 'Qalqilya', 32.19, 34.97),
  gov('salfit', 'west_bank', 'سلفيت', 'Salfit', 32.085, 35.181),
  gov('ramallah', 'west_bank', 'رام الله والبيرة', 'Ramallah & al-Bireh', 31.903, 35.204),
  gov('jericho', 'west_bank', 'أريحا', 'Jericho', 31.857, 35.462),
  gov('jerusalem', 'west_bank', 'القدس', 'Jerusalem', 31.778, 35.235),
  gov('bethlehem', 'west_bank', 'بيت لحم', 'Bethlehem', 31.705, 35.202),
  gov('hebron', 'west_bank', 'الخليل', 'Hebron', 31.532, 35.095),
];
const govById = Object.fromEntries(governorates.map((g) => [g.id, g]));

// ---------------------------------------------------------------- categories
const categories = [
  ['pain_fever', 'مسكنات وخافضات حرارة', 'Pain & fever'],
  ['antibiotics', 'مضادات حيوية', 'Antibiotics'],
  ['diabetes', 'السكري', 'Diabetes'],
  ['cardio', 'القلب والضغط والدهون', 'Heart, blood pressure & lipids'],
  ['thyroid', 'الغدة الدرقية', 'Thyroid'],
  ['respiratory', 'الجهاز التنفسي', 'Respiratory'],
  ['gastro', 'الجهاز الهضمي', 'Digestive'],
  ['supplements', 'فيتامينات ومكملات', 'Vitamins & supplements'],
  ['neuro', 'الأعصاب والصرع', 'Neurology & epilepsy'],
  ['allergy', 'الحساسية', 'Allergy'],
  ['steroids', 'الكورتيزون', 'Corticosteroids'],
].map(([id, name_ar, name_en]) => ({ id, name_ar, name_en }));

// ---------------------------------------------------------------- medicines (40)
// [id, name_ar, name_en, generic, strength, form, pack, category, aliases[], basePriceIls]
const M = [
  ['paracetamol-500', 'باراسيتامول 500', 'Paracetamol 500', 'Paracetamol', '500 ملغ', 'tablet', '20 قرص', 'pain_fever', ['بنادول', 'Panadol', 'أدول', 'Adol'], 6],
  ['paracetamol-syrup', 'باراسيتامول شراب للأطفال', 'Paracetamol syrup (children)', 'Paracetamol', '120 ملغ/5 مل', 'syrup', '100 مل', 'pain_fever', ['بنادول أطفال'], 9],
  ['ibuprofen-400', 'إيبوبروفين 400', 'Ibuprofen 400', 'Ibuprofen', '400 ملغ', 'tablet', '20 قرص', 'pain_fever', ['بروفين', 'Brufen'], 8],
  ['ibuprofen-syrup', 'إيبوبروفين شراب', 'Ibuprofen syrup', 'Ibuprofen', '100 ملغ/5 مل', 'syrup', '100 مل', 'pain_fever', ['بروفين شراب'], 12],
  ['diclofenac-50', 'ديكلوفيناك 50', 'Diclofenac 50', 'Diclofenac sodium', '50 ملغ', 'tablet', '20 قرص', 'pain_fever', ['فولتارين', 'Voltaren'], 10],
  ['amoxicillin-500', 'أموكسيسيلين 500', 'Amoxicillin 500', 'Amoxicillin', '500 ملغ', 'capsule', '16 كبسولة', 'antibiotics', ['أموكسيل', 'Amoxil'], 14],
  ['amoxicillin-susp', 'أموكسيسيلين معلق', 'Amoxicillin suspension', 'Amoxicillin', '250 ملغ/5 مل', 'suspension', '100 مل', 'antibiotics', ['أموكسيل شراب'], 16],
  ['amox-clav-625', 'أموكسيسيلين مع كلافولانيك 625', 'Amoxicillin/clavulanate 625', 'Amoxicillin + clavulanic acid', '625 ملغ', 'tablet', '14 قرص', 'antibiotics', ['أوجمنتين', 'Augmentin'], 32],
  ['azithromycin-250', 'أزيثروميسين 250', 'Azithromycin 250', 'Azithromycin', '250 ملغ', 'capsule', '6 كبسولات', 'antibiotics', ['زيثروماكس', 'Zithromax'], 24],
  ['cefalexin-500', 'سيفالكسين 500', 'Cefalexin 500', 'Cefalexin', '500 ملغ', 'capsule', '12 كبسولة', 'antibiotics', ['كيفلكس', 'Keflex'], 20],
  ['ciprofloxacin-500', 'سيبروفلوكساسين 500', 'Ciprofloxacin 500', 'Ciprofloxacin', '500 ملغ', 'tablet', '10 أقراص', 'antibiotics', ['سيبرو', 'Cipro'], 22],
  ['metronidazole-500', 'ميترونيدازول 500', 'Metronidazole 500', 'Metronidazole', '500 ملغ', 'tablet', '20 قرص', 'antibiotics', ['فلاجيل', 'Flagyl'], 11],
  ['metformin-500', 'ميتفورمين 500', 'Metformin 500', 'Metformin', '500 ملغ', 'tablet', '30 قرص', 'diabetes', ['جلوكوفاج', 'Glucophage'], 9],
  ['metformin-850', 'ميتفورمين 850', 'Metformin 850', 'Metformin', '850 ملغ', 'tablet', '30 قرص', 'diabetes', ['جلوكوفاج 850'], 12],
  ['gliclazide-80', 'جليكلازيد 80', 'Gliclazide 80', 'Gliclazide', '80 ملغ', 'tablet', '30 قرص', 'diabetes', ['دياميكرون', 'Diamicron'], 15],
  ['insulin-aspart', 'إنسولين نوفورابيد', 'NovoRapid', 'Insulin aspart', '100 وحدة/مل', 'injection_pen', '5 أقلام', 'diabetes', ['انسولين سريع', 'rapid insulin'], 42],
  ['insulin-glargine', 'إنسولين لانتوس', 'Lantus', 'Insulin glargine', '100 وحدة/مل', 'injection_pen', '5 أقلام', 'diabetes', ['انسولين مديد', 'long-acting insulin'], 58],
  ['insulin-nph', 'إنسولين إنسولاتارد', 'Insulatard', 'Insulin isophane (NPH)', '100 وحدة/مل', 'vial', '10 مل', 'diabetes', ['انسولين متوسط المفعول', 'NPH'], 35],
  ['amlodipine-5', 'أملوديبين 5', 'Amlodipine 5', 'Amlodipine', '5 ملغ', 'tablet', '30 قرص', 'cardio', ['نورفاسك', 'Norvasc'], 10],
  ['losartan-50', 'لوسارتان 50', 'Losartan 50', 'Losartan potassium', '50 ملغ', 'tablet', '30 قرص', 'cardio', ['كوزار', 'Cozaar'], 14],
  ['enalapril-10', 'إنالابريل 10', 'Enalapril 10', 'Enalapril maleate', '10 ملغ', 'tablet', '30 قرص', 'cardio', ['رينيتك', 'Renitec'], 9],
  ['atorvastatin-20', 'أتورفاستاتين 20', 'Atorvastatin 20', 'Atorvastatin', '20 ملغ', 'tablet', '30 قرص', 'cardio', ['ليبيتور', 'Lipitor'], 18],
  ['bisoprolol-5', 'بيسوبرولول 5', 'Bisoprolol 5', 'Bisoprolol fumarate', '5 ملغ', 'tablet', '30 قرص', 'cardio', ['كونكور', 'Concor'], 13],
  ['aspirin-100', 'أسبرين 100', 'Aspirin 100', 'Acetylsalicylic acid', '100 ملغ', 'tablet', '30 قرص', 'cardio', ['أسبرين أطفال', 'baby aspirin'], 5],
  ['furosemide-40', 'فوروسيميد 40', 'Furosemide 40', 'Furosemide', '40 ملغ', 'tablet', '20 قرص', 'cardio', ['لازكس', 'Lasix'], 7],
  ['levothyroxine-100', 'ليفوثيروكسين 100', 'Levothyroxine 100', 'Levothyroxine sodium', '100 ميكروغرام', 'tablet', '50 قرص', 'thyroid', ['يوثيروكس', 'Euthyrox', 'ثيروكسين', 'eltroxin'], 16],
  ['levothyroxine-50', 'ليفوثيروكسين 50', 'Levothyroxine 50', 'Levothyroxine sodium', '50 ميكروغرام', 'tablet', '50 قرص', 'thyroid', ['يوثيروكس 50', 'ثيروكسين'], 14],
  ['salbutamol-inhaler', 'سالبوتامول بخاخ', 'Salbutamol inhaler', 'Salbutamol', '100 ميكروغرام/بخة', 'inhaler', '200 بخة', 'respiratory', ['فنتولين', 'Ventolin', 'بخاخ ربو'], 19],
  ['budesonide-inhaler', 'بوديسونيد بخاخ', 'Budesonide inhaler', 'Budesonide', '200 ميكروغرام/بخة', 'inhaler', '200 بخة', 'respiratory', ['بلميكورت', 'Pulmicort'], 38],
  ['omeprazole-20', 'أوميبرازول 20', 'Omeprazole 20', 'Omeprazole', '20 ملغ', 'capsule', '14 كبسولة', 'gastro', ['لوسك', 'Losec'], 12],
  ['ors', 'محلول الإرواء الفموي', 'Oral rehydration salts', 'Oral rehydration salts', '', 'sachet', '10 أكياس', 'gastro', ['ORS', 'أملاح الإرواء', 'محلول جفاف'], 6],
  ['vitamin-d3', 'فيتامين د3', 'Vitamin D3', 'Cholecalciferol', '1000 وحدة دولية', 'tablet', '30 قرص', 'supplements', ['فيتامين د', 'vitamin d'], 15],
  ['ferrous-sulfate', 'كبريتات الحديد', 'Ferrous sulfate', 'Ferrous sulfate', '200 ملغ', 'tablet', '30 قرص', 'supplements', ['حديد', 'iron'], 8],
  ['folic-acid', 'حمض الفوليك', 'Folic acid', 'Folic acid', '5 ملغ', 'tablet', '30 قرص', 'supplements', ['فوليك', 'folate'], 5],
  ['carbamazepine-200', 'كاربامازيبين 200', 'Carbamazepine 200', 'Carbamazepine', '200 ملغ', 'tablet', '50 قرص', 'neuro', ['تيجريتول', 'Tegretol'], 21],
  ['valproate-500', 'فالبروات الصوديوم 500', 'Sodium valproate 500', 'Sodium valproate', '500 ملغ', 'tablet', '30 قرص', 'neuro', ['ديباكين', 'Depakine', 'فالبروات'], 27],
  ['prednisolone-5', 'بريدنيزولون 5', 'Prednisolone 5', 'Prednisolone', '5 ملغ', 'tablet', '20 قرص', 'steroids', ['بريدنيزولون'], 7],
  ['cetirizine-10', 'سيتيريزين 10', 'Cetirizine 10', 'Cetirizine', '10 ملغ', 'tablet', '20 قرص', 'allergy', ['زيرتك', 'Zyrtec'], 9],
  ['loratadine-10', 'لوراتادين 10', 'Loratadine 10', 'Loratadine', '10 ملغ', 'tablet', '20 قرص', 'allergy', ['كلاريتين', 'Claritine'], 10],
  ['hydrocortisone-cream', 'هيدروكورتيزون كريم 1%', 'Hydrocortisone cream 1%', 'Hydrocortisone', '1%', 'cream', '15 غ', 'steroids', ['كريم كورتيزون'], 11],
];

// English strength and pack (approved decision 6, docs/DECISIONS.md), derived from the Arabic units.
// Order matters: longer Arabic units first.
const UNIT_EN = [
  ['وحدة دولية', 'IU'],
  ['وحدة/مل', 'U/mL'],
  ['ميكروغرام/بخة', 'mcg/puff'],
  ['ميكروغرام', 'mcg'],
  ['ملغ/5 مل', 'mg/5 mL'],
  ['ملغ', 'mg'],
  [' مل', ' mL'],
  [' غ', ' g'],
];
const PACK_EN = { "قرص": "tablets", "أقراص": "tablets", "كبسولة": "capsules", "كبسولات": "capsules", "أقلام": "pens", "بخة": "puffs", "أكياس": "sachets", "مل": "mL", "غ": "g" };
const strengthEn = (ar) => (ar ? UNIT_EN.reduce((x, [arUnit, en]) => x.replaceAll(arUnit, en), ar) : null);
const packEn = (ar) => {
  const [n, unit] = ar.split(" ");
  if (!PACK_EN[unit]) throw new Error(`no English pack unit for "${ar}"`);
  return `${n} ${PACK_EN[unit]}`;
};

const medicines = M.map(([id, name_ar, name_en, generic_name, strength, dosage_form, pack_size, category_id, aliases], i) => ({
  id,
  name_ar,
  name_en,
  generic_name,
  strength,
  strength_en: strengthEn(strength),
  dosage_form,
  pack_size,
  pack_size_en: packEn(pack_size),
  manufacturer: null,
  barcode: `62500000${String(i + 1).padStart(5, '0')}`,
  aliases,
  category_id,
  prescription: 'unspecified',
  status: 'approved',
  is_demo: true,
}));
const basePrice = Object.fromEntries(M.map((m) => [m[0], m[9]]));

// ---------------------------------------------------------------- pharmacies (15)
const weekly = (open, close, friday = null) => ({
  sat: [[open, close]],
  sun: [[open, close]],
  mon: [[open, close]],
  tue: [[open, close]],
  wed: [[open, close]],
  thu: [[open, close]],
  ...(friday ? { fri: [friday] } : {}),
});
// [id, name_ar, name_en, gov, area, landmark_ar, precision, status, hours]
const P = [
  ['ph-nour', 'صيدلية النور', 'Al-Nour Pharmacy', 'khan_younis', 'center', 'قرب الدوار الرئيسي', 'exact', 'approved', weekly('08:00', '23:00', ['14:00', '22:00'])],
  ['ph-rahma', 'صيدلية الرحمة', 'Al-Rahma Pharmacy', 'khan_younis', 'east', 'مقابل المدرسة الابتدائية', 'exact', 'approved', weekly('08:00', '22:00')],
  ['ph-amal', 'صيدلية الأمل', 'Al-Amal Pharmacy', 'khan_younis', 'west', 'بجانب مخبز الحي', 'area', 'approved', weekly('09:00', '21:00', ['16:00', '21:00'])],
  ['ph-yasmeen', 'صيدلية الياسمين', 'Al-Yasmeen Pharmacy', 'khan_younis', 'north', 'خلف السوق الشعبي', 'exact', 'approved', weekly('00:00', '24:00', ['00:00', '24:00'])],
  ['ph-shifa', 'صيدلية الشفاء', 'Al-Shifa Pharmacy', 'gaza', 'center', 'قرب مفترق الشارع العام', 'exact', 'approved', weekly('08:00', '22:00')],
  ['ph-bushra', 'صيدلية البشرى', 'Al-Bushra Pharmacy', 'gaza', 'west', 'قرب مسجد الحي', 'exact', 'pending', weekly('08:00', '20:00')],
  ['ph-salam', 'صيدلية السلام', 'Al-Salam Pharmacy', 'rafah', 'center', 'بجانب مركز البلدية', 'area', 'approved', weekly('08:00', '21:00')],
  ['ph-zaytoon', 'صيدلية الزيتون', 'Al-Zaytoon Pharmacy', 'deir_al_balah', 'center', 'قرب ساحة السوق', 'exact', 'approved', weekly('08:00', '22:00', ['15:00', '22:00'])],
  ['ph-fajr', 'صيدلية الفجر', 'Al-Fajr Pharmacy', 'north_gaza', 'east', 'مقابل المجلس المحلي', 'hidden', 'approved', weekly('09:00', '20:00')],
  ['ph-hayat', 'صيدلية الحياة', 'Al-Hayat Pharmacy', 'ramallah', 'center', 'قرب الدوار', 'exact', 'approved', weekly('08:00', '23:00', ['10:00', '22:00'])],
  ['ph-manar', 'صيدلية المنار', 'Al-Manar Pharmacy', 'ramallah', 'north', 'بجانب الحديقة العامة', 'exact', 'approved', weekly('08:30', '21:30')],
  ['ph-wafa', 'صيدلية الوفاء', 'Al-Wafa Pharmacy', 'nablus', 'west', 'قرب موقف السيارات', 'exact', 'needs_info', weekly('08:00', '21:00')],
  ['ph-huda', 'صيدلية الهدى', 'Al-Huda Pharmacy', 'hebron', 'center', 'قرب السوق القديم', 'exact', 'pending', weekly('08:00', '21:00')],
  ['ph-rayhan', 'صيدلية الريحان', 'Al-Rayhan Pharmacy', 'jenin', 'east', 'بجانب مدرسة البنات', 'area', 'approved', weekly('08:00', '22:00')],
  ['ph-nada', 'صيدلية الندى', 'Al-Nada Pharmacy', 'bethlehem', 'center', 'قرب ساحة البلدة', 'exact', 'approved', weekly('08:00', '22:00', ['09:00', '14:00'])],
];

const jitter = () => (rand() - 0.5) * 0.03;
const pharmacies = P.map(([id, name_ar, name_en, g, area, landmark_ar, location_precision, verification_status, hours], i) => {
  const G = govById[g];
  const A = G.areas.find((a) => a.id === area);
  const n = String(i + 1).padStart(2, '0');
  return {
    id,
    type: 'pharmacy',
    name_ar,
    name_en,
    governorate: g,
    area,
    address_text: `${G.name_ar}، ${A.name_ar}`,
    landmark: landmark_ar,
    location_precision,
    phone: `059-000-00${n}`,
    whatsapp: `059-000-00${n}`,
    hours,
    description: null,
    verification_status,
    is_demo: true,
    info_updated_minutes_ago: between(60 * 24, 60 * 24 * 20),
    // Sensitive fields live apart, like organization_private in Postgres (SPEC §13).
    private: {
      license_no: `DEMO-PH-${1000 + i}`,
      exact_lat: +(G.center.lat + jitter()).toFixed(5),
      exact_lng: +(G.center.lng + jitter()).toFixed(5),
      contact_person: 'مسؤول تجريبي',
    },
  };
});

// ---------------------------------------------------------------- stock (~400)
const MIN = 1;
const HOUR = 60;
const DAY = 24 * HOUR;
const ageFor = (bucket) =>
  bucket === 'fresh' ? between(5 * MIN, 23 * HOUR) : bucket === 'stale' ? between(25 * HOUR, 71 * HOUR) : between(73 * HOUR, 10 * DAY);

const gazaGovs = new Set(['north_gaza', 'gaza', 'deir_al_balah', 'khan_younis', 'rafah']);
const RARE_IN_GAZA = new Set(['insulin-aspart', 'insulin-glargine', 'insulin-nph', 'levothyroxine-100', 'levothyroxine-50']);

const stock = [];
const add = (pharmacy_id, medicine_id, reported_status, reported_minutes_ago, priced = chance(0.65), priceAge = null) => {
  const price = priced ? +(basePrice[medicine_id] * (0.9 + rand() * 0.25)).toFixed(2) : null;
  stock.push({
    pharmacy_id,
    medicine_id,
    reported_status,
    reported_minutes_ago,
    price_ils: price,
    price_minutes_ago: price == null ? null : (priceAge ?? (chance(0.15) ? between(15 * DAY, 30 * DAY) : reported_minutes_ago)),
    is_listed: true,
    hidden_by_admin: false,
  });
};

// Demo story (SPEC §16): insulin NovoRapid in Khan Younis shows all four states.
add('ph-nour', 'insulin-aspart', 'available', 12, true, 12);
stock.at(-1).price_ils = 42;
add('ph-rahma', 'insulin-aspart', 'limited', 60, true, 60);
stock.at(-1).price_ils = 44.5;
add('ph-yasmeen', 'insulin-aspart', 'available', 26 * HOUR, false);
add('ph-amal', 'insulin-aspart', 'available', 4 * DAY, true, 4 * DAY);
// Levothyroxine 100 in Gaza: listed but unavailable, so the search ends on P-05.
add('ph-shifa', 'levothyroxine-100', 'unavailable', 5 * HOUR, false);
// "Recently updated": every approved Khan Younis pharmacy touched something within the hour.
add('ph-nour', 'paracetamol-500', 'available', 8);
add('ph-rahma', 'metformin-500', 'available', 21);
add('ph-yasmeen', 'ors', 'limited', 34);
add('ph-amal', 'amoxicillin-500', 'available', 47);

const taken = new Set(stock.map((s) => `${s.pharmacy_id}|${s.medicine_id}`));
for (const ph of pharmacies) {
  const meds = [...medicines].sort(() => rand() - 0.5).slice(0, 27);
  for (const m of meds) {
    if (stock.length >= 400) break;
    const key = `${ph.id}|${m.id}`;
    if (taken.has(key)) continue;
    taken.add(key);
    const inGaza = gazaGovs.has(ph.governorate);
    if (inGaza && RARE_IN_GAZA.has(m.id)) {
      // Rare on purpose: unavailable or long expired.
      if (ph.governorate === 'gaza' && m.id === 'levothyroxine-100') continue;
      add(ph.id, m.id, 'unavailable', ageFor(weighted([['fresh', 1], ['stale', 1], ['expired', 2]])), false);
      continue;
    }
    const bucket = weighted([['fresh', 55], ['stale', 25], ['expired', 20]]);
    const status = weighted([['available', 55], ['limited', 20], ['unavailable', 25]]);
    add(ph.id, m.id, status, ageFor(bucket));
  }
}

// ---------------------------------------------------------------- search logs (1,500 over 30 days)
const queriesFor = (m) => [m.name_ar, m.name_en.toLowerCase(), m.generic_name.toLowerCase(), ...m.aliases];
const unknownQueries = ['ميتوبرولول', 'كلوبيدوجريل', 'مونتيلوكاست', 'ثيامازول', 'إنسولين ميكس', 'سيتاجليبتين', 'كريون'];
const demandWeight = Object.fromEntries(medicines.map((m) => [m.id, 1]));
for (const id of ['insulin-aspart', 'insulin-glargine', 'levothyroxine-100', 'salbutamol-inhaler', 'metformin-500', 'amlodipine-5', 'paracetamol-500', 'amoxicillin-500', 'vitamin-d3', 'insulin-nph'])
  demandWeight[id] = 6;
const govWeight = governorates.map((g) => [g.id, gazaGovs.has(g.id) ? (g.id === 'khan_younis' || g.id === 'gaza' ? 10 : 6) : 1.2]);

// Normalization mirrors src/lib/normalizeArabic.ts for the stored query_norm.
const normalize = (s) =>
  s
    .replace(/[ً-ٰٟۖ-ۭـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/(\p{L})(\d)/gu, '$1 $2')
    .replace(/(\d)(\p{L})/gu, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

const search_logs = [];
for (let i = 0; i < 1500; i++) {
  const g = weighted(govWeight);
  const minutes_ago = between(5, 30 * DAY);
  if (chance(0.05)) {
    search_logs.push({ query_norm: normalize(pick(unknownQueries)), medicine_id: null, governorate: g, result_count: 0, minutes_ago });
    continue;
  }
  const m = weighted(medicines.map((x) => [x, demandWeight[x.id]]));
  const scarce = gazaGovs.has(g) && RARE_IN_GAZA.has(m.id);
  const zero = scarce ? chance(0.85) : chance(0.24);
  search_logs.push({
    query_norm: normalize(pick(queriesFor(m))),
    medicine_id: m.id,
    governorate: g,
    result_count: zero ? 0 : between(1, 6),
    minutes_ago,
  });
}
search_logs.sort((a, b) => a.minutes_ago - b.minutes_ago);

// ---------------------------------------------------------------- service providers (6, phase 5)
const provider = (id, type, name_ar, name_en, g, area, services) => {
  const G = govById[g];
  return {
    id,
    type,
    name_ar,
    name_en,
    governorate: g,
    area,
    address_text: `${G.name_ar}، ${G.areas.find((a) => a.id === area).name_ar}`,
    landmark: null,
    location_precision: 'area',
    phone: `059-000-01${String(services.length).padStart(2, '0')}`,
    whatsapp: null,
    hours: weekly('08:00', '16:00'),
    description: null,
    verification_status: 'approved',
    is_demo: true,
    private: { license_no: `DEMO-ORG-${id}`, exact_lat: G.center.lat, exact_lng: G.center.lng, contact_person: 'مسؤول تجريبي' },
    services: services.map((s, i) => ({ id: `${id}-s${i + 1}`, review_status: 'approved', eligibility: [], required_docs: [], ...s })),
  };
};
const providers = [
  provider('pr-nakheel', 'hospital', 'مستشفى النخيل (تجريبي)', 'Al-Nakheel Hospital (demo)', 'khan_younis', 'center', [
    { kind: 'department', name: 'قسم الطوارئ', category: 'emergency', program_status: null, confirmed_minutes_ago: 3 * DAY },
    { kind: 'department', name: 'قسم غسيل الكلى', category: 'dialysis', program_status: null, confirmed_minutes_ago: 9 * DAY },
    { kind: 'service', name: 'عيادة السكري', category: 'chronic', program_status: null, confirmed_minutes_ago: 2 * DAY },
  ]),
  provider('pr-karma', 'hospital', 'مستشفى الكرمة (تجريبي)', 'Al-Karma Hospital (demo)', 'gaza', 'east', [
    { kind: 'department', name: 'قسم الولادة', category: 'maternity', program_status: null, confirmed_minutes_ago: 5 * DAY },
    { kind: 'service', name: 'عيادة الأطفال', category: 'chronic', program_status: null, confirmed_minutes_ago: 12 * DAY },
  ]),
  provider('pr-amal-point', 'medical_point', 'نقطة الأمل الطبية (تجريبي)', 'Al-Amal Medical Point (demo)', 'deir_al_balah', 'center', [
    { kind: 'service', name: 'تطعيم الأطفال', category: 'vaccination', program_status: null, confirmed_minutes_ago: DAY },
    { kind: 'program', name: 'متابعة الحوامل', category: 'maternity', program_status: 'active', confirmed_minutes_ago: 2 * DAY, eligibility: ['حامل في أي شهر', 'مقيمة في المحافظة'] },
  ]),
  provider('pr-mobile-care', 'medical_point', 'نقطة الرعاية المتنقلة (تجريبي)', 'Mobile Care Point (demo)', 'rafah', 'west', [
    { kind: 'service', name: 'فحص ضغط وسكر', category: 'chronic', program_status: null, confirmed_minutes_ago: 4 * DAY },
    { kind: 'program', name: 'عيادة متنقلة أسبوعية', category: 'chronic', program_status: 'active', confirmed_minutes_ago: 9 * DAY },
  ]),
  provider('pr-sanad', 'humanitarian', 'جمعية سند الطبية (تجريبي)', 'Sanad Medical Society (demo)', 'khan_younis', 'west', [
    { kind: 'program', name: 'دعم مرضى الأمراض المزمنة', category: 'chronic', program_status: 'active', confirmed_minutes_ago: 3 * DAY, eligibility: ['مريض بمرض مزمن', 'تقرير طبي حديث'], required_docs: ['هوية', 'تقرير طبي'] },
    { kind: 'program', name: 'الدعم النفسي للأطفال', category: 'mental_health', program_status: 'paused', confirmed_minutes_ago: 20 * DAY },
  ]),
  provider('pr-rafeeq', 'humanitarian', 'مؤسسة رفيق للإغاثة (تجريبي)', 'Rafeeq Relief Foundation (demo)', 'north_gaza', 'center', [
    { kind: 'program', name: 'توزيع مستلزمات طبية', category: 'chronic', program_status: 'info', confirmed_minutes_ago: 6 * DAY },
    { kind: 'program', name: 'برنامج التأهيل الحركي', category: 'rehab', program_status: 'ended', confirmed_minutes_ago: 40 * DAY },
  ]),
];

// ---------------------------------------------------------------- demo users
const ALL_PERMS = { availability: true, prices: true, medicines: true, publish: true, inquiries: true, profile: true, team: true, reports: true };
const STAFF_PERMS = { availability: true, prices: false, medicines: false, publish: false, inquiries: true, profile: false, team: false, reports: true };
const users = [
  { id: 'u-patient', role: 'patient', display_name: 'مريض تجريبي', email: 'patient@madad.test', phone: null, platform_role: null, memberships: [] },
  { id: 'u-ph-owner', role: 'pharmacy_owner', display_name: 'مالك صيدلية تجريبي', email: 'owner@madad.test', phone: null, platform_role: null, memberships: [{ org_id: 'ph-nour', member_role: 'owner', perms: ALL_PERMS }] },
  { id: 'u-ph-staff', role: 'pharmacy_staff', display_name: 'موظف صيدلية تجريبي', email: 'staff@madad.test', phone: null, platform_role: null, memberships: [{ org_id: 'ph-shifa', member_role: 'staff', perms: STAFF_PERMS }] },
  { id: 'u-org-owner', role: 'provider_owner', display_name: 'مالك مؤسسة تجريبي', email: 'org@madad.test', phone: null, platform_role: null, memberships: [{ org_id: 'pr-sanad', member_role: 'owner', perms: ALL_PERMS }] },
  { id: 'u-reviewer', role: 'reviewer', display_name: 'مراجِع تجريبي', email: 'reviewer@madad.test', phone: null, platform_role: 'reviewer', memberships: [] },
  { id: 'u-admin', role: 'super_admin', display_name: 'مدير نظام تجريبي', email: 'admin@madad.test', phone: null, platform_role: 'super_admin', memberships: [] },
  // Patients who wrote the seeded inquiries; they have no password and cannot sign in.
  { id: 'u-p2', role: 'patient', display_name: 'سارة م.', email: 'p2@madad.test', phone: null, platform_role: null, memberships: [] },
  { id: 'u-p3', role: 'patient', display_name: 'أبو خالد', email: 'p3@madad.test', phone: null, platform_role: null, memberships: [] },
];
// Mock mode only (SPEC §12): one shared demo password, shown on the login page when VITE_DEMO=true.
const DEMO_PASSWORD = 'madad-demo-2026';
for (const u of users) u.password = u.id === 'u-p2' || u.id === 'u-p3' ? null : DEMO_PASSWORD;

// ---------------------------------------------------------------- pharmacy portal data (phase 2)
// stock_private: internal quantity, never read by public screens (SPEC §3, §13).
const stock_private = stock.map((s) => ({
  pharmacy_id: s.pharmacy_id,
  medicine_id: s.medicine_id,
  quantity: s.reported_status === 'unavailable' ? 0 : s.reported_status === 'limited' ? between(1, 6) : between(8, 90),
  low_threshold: 5,
}));

// Page views per day for the last 14 days, for "مشاهدات صفحتك" (PH-01).
const page_views = pharmacies
  .filter((p) => p.verification_status === 'approved')
  .flatMap((p) => Array.from({ length: 14 }, (_, d) => ({ pharmacy_id: p.id, days_ago: d, count: between(3, 40) })));

// Recent history rows so "آخر النشاط" and PH-05 are not empty.
const stock_history = stock
  .filter((s) => (s.pharmacy_id === 'ph-nour' || s.pharmacy_id === 'ph-shifa') && s.reported_minutes_ago < 3 * DAY)
  .map((s) => ({
    pharmacy_id: s.pharmacy_id,
    medicine_id: s.medicine_id,
    action: 'update',
    old_status: pick(['available', 'limited', 'unavailable'].filter((x) => x !== s.reported_status)),
    new_status: s.reported_status,
    old_price: null,
    new_price: s.price_ils,
    actor_id: s.pharmacy_id === 'ph-nour' ? 'u-ph-owner' : 'u-ph-staff',
    minutes_ago: s.reported_minutes_ago,
  }));

// Inquiries from fictional patients (P-09 → PH-06).
const inquiries = [
  { id: 'inq-1001', org_id: 'ph-nour', patient_id: 'u-p2', medicine_id: 'insulin-glargine', subject: 'إنسولين لانتوس', status: 'new', messages: [{ sender: 'patient', body: 'هل يتوفر لديكم إنسولين لانتوس هذا الأسبوع؟', minutes_ago: 40 }] },
  { id: 'inq-1002', org_id: 'ph-nour', patient_id: 'u-p3', medicine_id: 'salbutamol-inhaler', subject: 'سالبوتامول بخاخ', status: 'new', messages: [{ sender: 'patient', body: 'أبحث عن بخاخ سالبوتامول، هل ما زال متوفرًا؟', minutes_ago: 95 }] },
  { id: 'inq-1003', org_id: 'ph-nour', patient_id: 'u-p2', medicine_id: null, subject: 'ساعات العمل', status: 'replied', messages: [
    { sender: 'patient', body: 'هل تفتحون يوم الجمعة؟', minutes_ago: 26 * HOUR },
    { sender: 'org', body: 'نعم، من الساعة 2 ظهرًا حتى 10 مساءً.', minutes_ago: 25 * HOUR },
  ] },
  { id: 'inq-1004', org_id: 'ph-shifa', patient_id: 'u-p3', medicine_id: 'levothyroxine-100', subject: 'ليفوثيروكسين 100', status: 'new', messages: [{ sender: 'patient', body: 'متى تتوقعون توفر ليفوثيروكسين 100؟', minutes_ago: 3 * HOUR }] },
];

// Catalog requests waiting for review (PH-04 → AD-04).
const medicine_requests = [
  { id: 'req-1', org_id: 'ph-nour', name_ar: 'مونتيلوكاست 10', name_en: 'Montelukast 10', generic_name: 'Montelukast', strength: '10 ملغ', dosage_form: 'tablet', pack_size: '30 قرص', manufacturer: null, barcode: null, category_id: 'respiratory', status: 'pending', minutes_ago: 2 * DAY },
  // Near-duplicate of paracetamol-500, so AD-04 shows "قد يكرر دواءً موجودًا".
  { id: 'req-2', org_id: 'ph-shifa', name_ar: 'باراسيتامول 500 ملغ', name_en: 'Paracetamol 500mg', generic_name: 'Paracetamol', strength: '500 ملغ', dosage_form: 'tablet', pack_size: '24 قرص', manufacturer: null, barcode: null, category_id: 'pain_fever', status: 'pending', minutes_ago: 9 * HOUR },
];

// ---------------------------------------------------------------- admin data (phase 3)
// Documents for the applications waiting in AD-02 (metadata only in mock mode).
const pharmacyDocs = (id) => [
  { doc_type: 'practice_license', file_name: `${id}-practice-license.pdf`, size: 182_000, mime: 'application/pdf', status: 'pending' },
  { doc_type: 'pharmacy_license', file_name: `${id}-pharmacy-license.jpg`, size: 640_000, mime: 'image/jpeg', status: id === 'ph-wafa' ? 'rejected' : 'pending' },
  { doc_type: 'contact_id', file_name: `${id}-contact-id.jpg`, size: 410_000, mime: 'image/jpeg', status: 'pending' },
];
for (const p of pharmacies) if (p.verification_status !== 'approved') p.documents = pharmacyDocs(p.id);
// AD-02 warns when a phone or licence is already used by another organization.
pharmacies.find((p) => p.id === 'ph-bushra').phone = pharmacies.find((p) => p.id === 'ph-zaytoon').phone;

// A pharmacy that mostly taps "تأكيد الكل" (AD-05: possible box-ticking).
for (let d = 1; d <= 9; d++)
  stock_history.push({ pharmacy_id: 'ph-salam', medicine_id: null, action: 'confirm_all', old_status: null, new_status: null, old_price: null, new_price: null, actor_id: null, count: 27, minutes_ago: d * DAY + between(0, 6 * HOUR) });

// Reports from patients (P-13 → AD-07). One conflicts with a same-day "available" report (AD-05).
const nourParacetamol = stock.find((s) => s.pharmacy_id === 'ph-nour' && s.medicine_id === 'paracetamol-500');
const reports = [
  { id: 'rep-1', entity_type: 'availability', entity_id: 'ph-nour/paracetamol-500', reason: 'wrong_availability', details: 'ذهبت للصيدلية وقالوا إنه غير متوفر.', governorate: 'khan_younis', status: 'new', minutes_ago: Math.max(1, nourParacetamol.reported_minutes_ago - 2) },
  { id: 'rep-2', entity_type: 'pharmacy', entity_id: 'ph-salam', reason: 'closed_or_moved', details: 'الصيدلية مغلقة منذ يومين.', governorate: 'rafah', status: 'new', minutes_ago: 5 * HOUR },
  { id: 'rep-3', entity_type: 'pharmacy', entity_id: 'ph-zaytoon', reason: 'wrong_phone', details: 'الرقم لا يرد.', governorate: 'deir_al_balah', status: 'in_review', minutes_ago: DAY },
  { id: 'rep-4', entity_type: 'medicine', entity_id: 'insulin-glargine', reason: 'shortage', details: '', governorate: 'gaza', status: 'new', minutes_ago: 3 * HOUR },
  { id: 'rep-5', entity_type: 'pharmacy', entity_id: 'ph-hayat', reason: 'misleading', details: 'الأسعار المعروضة غير صحيحة.', governorate: 'ramallah', status: 'resolved', minutes_ago: 4 * DAY },
];

// ---------------------------------------------------------------- write
mkdirSync(SEED_DIR, { recursive: true });
// Large generated lists are written one row per line: small to ship, still diffable.
const write = (name, data) =>
  writeFileSync(new URL(name, SEED_DIR), `[\n${data.map((row) => JSON.stringify(row)).join(',\n')}\n]\n`);
write('governorates.json', governorates);
write('categories.json', categories);
write('medicines.json', medicines);
write('pharmacies.json', pharmacies);
write('stock.json', stock);
write('providers.json', providers);
write('search_logs.json', search_logs);
write('users.json', users);
write('stock_private.json', stock_private);
write('page_views.json', page_views);
write('stock_history.json', stock_history);
write('inquiries.json', inquiries);
write('medicine_requests.json', medicine_requests);
write('reports.json', reports);

// Public offline catalog for suggestions (SPEC §11): approved medicines only, compact keys.
writeFileSync(
  new URL('catalog.json', PUBLIC_DIR),
  JSON.stringify({ version: 1, categories, medicines: medicines.map(({ is_demo, status, prescription, ...m }) => m) }),
);

const buckets = { fresh: 0, stale: 0, expired: 0 };
for (const s of stock) {
  const h = s.reported_minutes_ago / 60;
  buckets[h <= 24 ? 'fresh' : h <= 72 ? 'stale' : 'expired']++;
}
const zero = search_logs.filter((s) => s.result_count === 0).length;
console.log(`stock: ${stock.length} (fresh ${buckets.fresh}, stale ${buckets.stale}, expired ${buckets.expired})`);
console.log(`search_logs: ${search_logs.length} (${Math.round((zero / search_logs.length) * 100)}% no result)`);
