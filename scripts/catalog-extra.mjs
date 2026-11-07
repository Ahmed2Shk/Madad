// More of the medicines commonly dispensed in Gaza pharmacies, added to the catalog after the demo
// data is generated (scripts/gen-seed.mjs appends them when writing), so the seeded stock, search
// logs and every demo fact stay exactly as they were. International generic names and usual
// strengths; brand names only where they are widely known. No barcodes: an invented one could match
// a real product.
// [id, name_ar, name_en, generic, strength, form, pack, category, aliases[]]

export const EXTRA_CATEGORIES = [
  ['anti_infective', 'مضادات الفطريات والطفيليات والفيروسات', 'Antifungals, antiparasitics & antivirals'],
  ['eye_ear', 'العين والأذن', 'Eye & ear'],
  ['skin', 'الجلدية', 'Skin'],
  ['mental_health', 'الصحة النفسية', 'Mental health'],
  ['womens_health', 'صحة المرأة', "Women's health"],
  ['urology', 'المسالك البولية', 'Urology'],
];

export const EXTRA_MEDICINES = [
  // Pain, fever, gout
  ['ibuprofen-200', 'إيبوبروفين 200', 'Ibuprofen 200', 'Ibuprofen', '200 ملغ', 'tablet', '20 قرص', 'pain_fever', ['بروفين 200']],
  ['naproxen-500', 'نابروكسين 500', 'Naproxen 500', 'Naproxen', '500 ملغ', 'tablet', '20 قرص', 'pain_fever', ['نابروسين', 'Naprosyn']],
  ['mefenamic-acid-500', 'حمض الميفيناميك 500', 'Mefenamic acid 500', 'Mefenamic acid', '500 ملغ', 'tablet', '20 قرص', 'pain_fever', ['بونستان', 'Ponstan']],
  ['metamizole-500', 'ميتاميزول 500', 'Metamizole 500', 'Metamizole sodium', '500 ملغ', 'tablet', '20 قرص', 'pain_fever', ['نوفالجين', 'Novalgin', 'أنالجين']],
  ['tramadol-50', 'ترامادول 50', 'Tramadol 50', 'Tramadol', '50 ملغ', 'capsule', '10 كبسولات', 'pain_fever', ['ترامال', 'Tramal']],
  ['paracetamol-supp-125', 'باراسيتامول تحاميل 125', 'Paracetamol suppositories 125', 'Paracetamol', '125 ملغ', 'suppository', '10 تحاميل', 'pain_fever', ['تحاميل خافض حرارة للأطفال']],
  ['diclofenac-gel', 'ديكلوفيناك جل', 'Diclofenac gel', 'Diclofenac diethylamine', '1%', 'gel', '50 غ', 'pain_fever', ['فولتارين جل', 'Voltaren gel']],
  ['diclofenac-inj-75', 'ديكلوفيناك حقن 75', 'Diclofenac injection 75', 'Diclofenac sodium', '75 ملغ/3 مل', 'injection', '5 أمبولات', 'pain_fever', ['فولتارين حقن']],
  ['allopurinol-100', 'ألوبيورينول 100', 'Allopurinol 100', 'Allopurinol', '100 ملغ', 'tablet', '30 قرص', 'pain_fever', ['زيلوريك', 'Zyloric']],
  ['colchicine-0-5', 'كولشيسين 0.5', 'Colchicine 0.5', 'Colchicine', '0.5 ملغ', 'tablet', '30 قرص', 'pain_fever', []],

  // Antibiotics
  ['amox-clav-susp', 'أموكسيسيلين مع كلافولانيك معلق', 'Amoxicillin/clavulanate suspension', 'Amoxicillin + clavulanic acid', '228 ملغ/5 مل', 'suspension', '70 مل', 'antibiotics', ['أوجمنتين شراب', 'Augmentin suspension']],
  ['amoxicillin-250', 'أموكسيسيلين 250', 'Amoxicillin 250', 'Amoxicillin', '250 ملغ', 'capsule', '16 كبسولة', 'antibiotics', ['أموكسيل 250']],
  ['azithromycin-500', 'أزيثروميسين 500', 'Azithromycin 500', 'Azithromycin', '500 ملغ', 'tablet', '3 أقراص', 'antibiotics', ['زيثروماكس 500']],
  ['azithromycin-susp', 'أزيثروميسين معلق', 'Azithromycin suspension', 'Azithromycin', '200 ملغ/5 مل', 'suspension', '15 مل', 'antibiotics', ['زيثروماكس شراب']],
  ['clarithromycin-500', 'كلاريثروميسين 500', 'Clarithromycin 500', 'Clarithromycin', '500 ملغ', 'tablet', '14 قرص', 'antibiotics', ['كلاسيد', 'Klacid']],
  ['doxycycline-100', 'دوكسيسيكلين 100', 'Doxycycline 100', 'Doxycycline', '100 ملغ', 'capsule', '10 كبسولات', 'antibiotics', ['فايبراميسين', 'Vibramycin']],
  ['cefuroxime-500', 'سيفوروكسيم 500', 'Cefuroxime 500', 'Cefuroxime axetil', '500 ملغ', 'tablet', '10 أقراص', 'antibiotics', ['زينات', 'Zinnat']],
  ['cefixime-400', 'سيفيكسيم 400', 'Cefixime 400', 'Cefixime', '400 ملغ', 'capsule', '5 كبسولات', 'antibiotics', ['سوبراكس', 'Suprax']],
  ['cefalexin-susp', 'سيفالكسين معلق', 'Cefalexin suspension', 'Cefalexin', '250 ملغ/5 مل', 'suspension', '100 مل', 'antibiotics', ['كيفلكس شراب']],
  ['ceftriaxone-1g', 'سيفترياكسون 1 غ', 'Ceftriaxone 1 g', 'Ceftriaxone', '1 غ', 'vial', '1 قارورة', 'antibiotics', ['روسيفين', 'Rocephin']],
  ['levofloxacin-500', 'ليفوفلوكساسين 500', 'Levofloxacin 500', 'Levofloxacin', '500 ملغ', 'tablet', '7 أقراص', 'antibiotics', ['تافانيك', 'Tavanic']],
  ['clindamycin-300', 'كليندامايسين 300', 'Clindamycin 300', 'Clindamycin', '300 ملغ', 'capsule', '16 كبسولة', 'antibiotics', ['دالاسين', 'Dalacin']],
  ['flucloxacillin-500', 'فلوكلوكساسيلين 500', 'Flucloxacillin 500', 'Flucloxacillin', '500 ملغ', 'capsule', '16 كبسولة', 'antibiotics', []],
  ['co-trimoxazole-960', 'سلفاميثوكسازول مع تريميثوبريم 960', 'Co-trimoxazole 960', 'Sulfamethoxazole + trimethoprim', '960 ملغ', 'tablet', '20 قرص', 'antibiotics', ['سبترين', 'Septrin', 'باكتريم', 'Bactrim']],
  ['nitrofurantoin-100', 'نيتروفورانتوين 100', 'Nitrofurantoin 100', 'Nitrofurantoin', '100 ملغ', 'capsule', '30 كبسولة', 'antibiotics', ['ماكروبيد', 'Macrobid']],
  ['metronidazole-susp', 'ميترونيدازول معلق', 'Metronidazole suspension', 'Metronidazole benzoate', '125 ملغ/5 مل', 'suspension', '100 مل', 'antibiotics', ['فلاجيل شراب']],
  ['gentamicin-80', 'جنتاميسين حقن 80', 'Gentamicin injection 80', 'Gentamicin', '80 ملغ/2 مل', 'injection', '10 أمبولات', 'antibiotics', []],

  // Antifungals, antiparasitics, antivirals
  ['fluconazole-150', 'فلوكونازول 150', 'Fluconazole 150', 'Fluconazole', '150 ملغ', 'capsule', '1 كبسولة', 'anti_infective', ['ديفلوكان', 'Diflucan']],
  ['clotrimazole-cream', 'كلوتريمازول كريم', 'Clotrimazole cream', 'Clotrimazole', '1%', 'cream', '20 غ', 'anti_infective', ['كانستين', 'Canesten']],
  ['miconazole-oral-gel', 'ميكونازول جل فموي', 'Miconazole oral gel', 'Miconazole', '2%', 'gel', '40 غ', 'anti_infective', ['دكتارين', 'Daktarin']],
  ['nystatin-susp', 'نيستاتين معلق', 'Nystatin suspension', 'Nystatin', '100000 وحدة/مل', 'suspension', '30 مل', 'anti_infective', ['مايكوستاتين', 'Mycostatin']],
  ['albendazole-400', 'ألبيندازول 400', 'Albendazole 400', 'Albendazole', '400 ملغ', 'tablet', '1 قرص', 'anti_infective', ['زينتل', 'Zentel']],
  ['mebendazole-100', 'ميبيندازول 100', 'Mebendazole 100', 'Mebendazole', '100 ملغ', 'tablet', '6 أقراص', 'anti_infective', ['فيرموكس', 'Vermox']],
  ['permethrin-cream', 'بيرميثرين كريم', 'Permethrin cream', 'Permethrin', '5%', 'cream', '30 غ', 'anti_infective', ['علاج الجرب']],
  ['acyclovir-400', 'أسيكلوفير 400', 'Acyclovir 400', 'Acyclovir', '400 ملغ', 'tablet', '25 قرص', 'anti_infective', ['زوفيراكس', 'Zovirax']],
  ['acyclovir-cream', 'أسيكلوفير كريم', 'Acyclovir cream', 'Acyclovir', '5%', 'cream', '10 غ', 'anti_infective', ['زوفيراكس كريم']],

  // Diabetes
  ['glibenclamide-5', 'جليبنكلاميد 5', 'Glibenclamide 5', 'Glibenclamide', '5 ملغ', 'tablet', '30 قرص', 'diabetes', ['داونيل', 'Daonil']],
  ['glimepiride-2', 'جليميبيريد 2', 'Glimepiride 2', 'Glimepiride', '2 ملغ', 'tablet', '30 قرص', 'diabetes', ['أماريل', 'Amaryl']],
  ['sitagliptin-100', 'سيتاجليبتين 100', 'Sitagliptin 100', 'Sitagliptin', '100 ملغ', 'tablet', '28 قرص', 'diabetes', ['جانوفيا', 'Januvia']],
  ['insulin-regular', 'إنسولين أكترابيد', 'Actrapid', 'Insulin human regular', '100 وحدة/مل', 'vial', '10 مل', 'diabetes', ['انسولين عادي', 'regular insulin']],
  ['insulin-mixtard', 'إنسولين ميكستارد 30', 'Mixtard 30', 'Insulin human 30/70', '100 وحدة/مل', 'vial', '10 مل', 'diabetes', ['انسولين مختلط', 'mixed insulin']],

  // Heart, blood pressure, lipids, blood
  ['atenolol-50', 'أتينولول 50', 'Atenolol 50', 'Atenolol', '50 ملغ', 'tablet', '28 قرص', 'cardio', ['تينورمين', 'Tenormin']],
  ['carvedilol-6-25', 'كارفيديلول 6.25', 'Carvedilol 6.25', 'Carvedilol', '6.25 ملغ', 'tablet', '28 قرص', 'cardio', ['ديلاتريند', 'Dilatrend']],
  ['captopril-25', 'كابتوبريل 25', 'Captopril 25', 'Captopril', '25 ملغ', 'tablet', '30 قرص', 'cardio', ['كابوتين', 'Capoten']],
  ['lisinopril-10', 'ليزينوبريل 10', 'Lisinopril 10', 'Lisinopril', '10 ملغ', 'tablet', '28 قرص', 'cardio', ['زستريل', 'Zestril']],
  ['valsartan-80', 'فالسارتان 80', 'Valsartan 80', 'Valsartan', '80 ملغ', 'tablet', '28 قرص', 'cardio', ['ديوفان', 'Diovan']],
  ['hydrochlorothiazide-25', 'هيدروكلوروثيازيد 25', 'Hydrochlorothiazide 25', 'Hydrochlorothiazide', '25 ملغ', 'tablet', '30 قرص', 'cardio', []],
  ['spironolactone-25', 'سبيرونولاكتون 25', 'Spironolactone 25', 'Spironolactone', '25 ملغ', 'tablet', '20 قرص', 'cardio', ['ألداكتون', 'Aldactone']],
  ['nifedipine-20', 'نيفيديبين 20', 'Nifedipine 20', 'Nifedipine', '20 ملغ', 'tablet', '30 قرص', 'cardio', ['أدالات', 'Adalat']],
  ['methyldopa-250', 'ميثيل دوبا 250', 'Methyldopa 250', 'Methyldopa', '250 ملغ', 'tablet', '30 قرص', 'cardio', ['ألدوميت', 'Aldomet']],
  ['simvastatin-20', 'سيمفاستاتين 20', 'Simvastatin 20', 'Simvastatin', '20 ملغ', 'tablet', '30 قرص', 'cardio', ['زوكور', 'Zocor']],
  ['rosuvastatin-10', 'روسوفاستاتين 10', 'Rosuvastatin 10', 'Rosuvastatin', '10 ملغ', 'tablet', '28 قرص', 'cardio', ['كريستور', 'Crestor']],
  ['clopidogrel-75', 'كلوبيدوجريل 75', 'Clopidogrel 75', 'Clopidogrel', '75 ملغ', 'tablet', '28 قرص', 'cardio', ['بلافيكس', 'Plavix']],
  ['warfarin-5', 'وارفارين 5', 'Warfarin 5', 'Warfarin', '5 ملغ', 'tablet', '30 قرص', 'cardio', ['كومادين', 'Coumadin']],
  ['digoxin-0-25', 'ديجوكسين 0.25', 'Digoxin 0.25', 'Digoxin', '0.25 ملغ', 'tablet', '30 قرص', 'cardio', ['لانوكسين', 'Lanoxin']],
  ['isosorbide-dinitrate-5', 'إيزوسوربيد ثنائي النترات 5', 'Isosorbide dinitrate 5', 'Isosorbide dinitrate', '5 ملغ', 'tablet', '30 قرص', 'cardio', ['أيزورديل', 'Isordil']],
  ['enoxaparin-40', 'إينوكسابارين 40', 'Enoxaparin 40', 'Enoxaparin sodium', '40 ملغ/0.4 مل', 'injection', '2 محقنة', 'cardio', ['كليكسان', 'Clexane']],

  // Thyroid
  ['levothyroxine-25', 'ليفوثيروكسين 25', 'Levothyroxine 25', 'Levothyroxine sodium', '25 ميكروغرام', 'tablet', '50 قرص', 'thyroid', ['يوثيروكس 25']],
  ['carbimazole-5', 'كاربيمازول 5', 'Carbimazole 5', 'Carbimazole', '5 ملغ', 'tablet', '100 قرص', 'thyroid', ['نيوميركازول', 'Neo-Mercazole']],
  ['propylthiouracil-50', 'بروبيل ثيويوراسيل 50', 'Propylthiouracil 50', 'Propylthiouracil', '50 ملغ', 'tablet', '100 قرص', 'thyroid', ['PTU']],

  // Respiratory, cough, nose
  ['montelukast-10', 'مونتيلوكاست 10', 'Montelukast 10', 'Montelukast', '10 ملغ', 'tablet', '28 قرص', 'respiratory', ['سينجولير', 'Singulair']],
  ['montelukast-4', 'مونتيلوكاست 4 للأطفال', 'Montelukast 4 (children)', 'Montelukast', '4 ملغ', 'tablet', '28 قرص', 'respiratory', ['سينجولير 4']],
  ['salbutamol-syrup', 'سالبوتامول شراب', 'Salbutamol syrup', 'Salbutamol', '2 ملغ/5 مل', 'syrup', '100 مل', 'respiratory', ['فنتولين شراب']],
  ['salbutamol-nebules', 'سالبوتامول محلول للبخار', 'Salbutamol nebuliser solution', 'Salbutamol', '5 ملغ/مل', 'solution', '20 مل', 'respiratory', ['فنتولين بخار', 'جلسة بخار']],
  ['fluticasone-salmeterol', 'فلوتيكازون مع سالميترول بخاخ', 'Fluticasone/salmeterol inhaler', 'Fluticasone propionate + salmeterol', '25/125 ميكروغرام/بخة', 'inhaler', '120 بخة', 'respiratory', ['سيريتايد', 'Seretide']],
  ['ambroxol-syrup', 'أمبروكسول شراب', 'Ambroxol syrup', 'Ambroxol', '15 ملغ/5 مل', 'syrup', '100 مل', 'respiratory', ['ميوكوسولفان', 'Mucosolvan', 'شراب بلغم']],
  ['dextromethorphan-syrup', 'ديكستروميثورفان شراب', 'Dextromethorphan syrup', 'Dextromethorphan', '15 ملغ/5 مل', 'syrup', '100 مل', 'respiratory', ['شراب كحة ناشفة']],
  ['xylometazoline-spray', 'زايلوميتازولين بخاخ أنف', 'Xylometazoline nasal spray', 'Xylometazoline', '0.1%', 'spray', '10 مل', 'respiratory', ['أوتريفين', 'Otrivin']],
  ['saline-nasal-drops', 'محلول ملحي للأنف', 'Saline nasal drops', 'Sodium chloride', '0.9%', 'drops', '10 مل', 'respiratory', ['نقط أنف ملحية']],

  // Digestive
  ['esomeprazole-40', 'إيسوميبرازول 40', 'Esomeprazole 40', 'Esomeprazole', '40 ملغ', 'tablet', '14 قرص', 'gastro', ['نيكسيوم', 'Nexium']],
  ['pantoprazole-40', 'بانتوبرازول 40', 'Pantoprazole 40', 'Pantoprazole', '40 ملغ', 'tablet', '14 قرص', 'gastro', ['كونترولوك', 'Controloc']],
  ['famotidine-20', 'فاموتيدين 20', 'Famotidine 20', 'Famotidine', '20 ملغ', 'tablet', '20 قرص', 'gastro', []],
  ['domperidone-10', 'دومبيريدون 10', 'Domperidone 10', 'Domperidone', '10 ملغ', 'tablet', '30 قرص', 'gastro', ['موتيليوم', 'Motilium']],
  ['metoclopramide-10', 'ميتوكلوبراميد 10', 'Metoclopramide 10', 'Metoclopramide', '10 ملغ', 'tablet', '20 قرص', 'gastro', ['بلاسيل', 'Plasil']],
  ['ondansetron-4', 'أوندانسيترون 4', 'Ondansetron 4', 'Ondansetron', '4 ملغ', 'tablet', '10 أقراص', 'gastro', ['زوفران', 'Zofran']],
  ['hyoscine-10', 'هيوسين بيوتيل بروميد 10', 'Hyoscine butylbromide 10', 'Hyoscine butylbromide', '10 ملغ', 'tablet', '20 قرص', 'gastro', ['بوسكوبان', 'Buscopan']],
  ['mebeverine-135', 'ميبيفيرين 135', 'Mebeverine 135', 'Mebeverine', '135 ملغ', 'tablet', '30 قرص', 'gastro', ['دوسباتالين', 'Duspatalin']],
  ['loperamide-2', 'لوبيراميد 2', 'Loperamide 2', 'Loperamide', '2 ملغ', 'capsule', '10 كبسولات', 'gastro', ['إيموديوم', 'Imodium']],
  ['lactulose-syrup', 'لاكتولوز شراب', 'Lactulose syrup', 'Lactulose', '3.35 غ/5 مل', 'syrup', '200 مل', 'gastro', ['دوفالاك', 'Duphalac']],
  ['bisacodyl-5', 'بيساكوديل 5', 'Bisacodyl 5', 'Bisacodyl', '5 ملغ', 'tablet', '30 قرص', 'gastro', ['دولكولاكس', 'Dulcolax']],
  ['antacid-susp', 'معلق مضاد للحموضة', 'Antacid suspension', 'Aluminium hydroxide + magnesium hydroxide', '', 'suspension', '200 مل', 'gastro', ['مالوكس', 'Maalox']],
  ['simethicone-drops', 'سيميثيكون نقط للأطفال', 'Simethicone drops (children)', 'Simethicone', '40 ملغ/مل', 'drops', '30 مل', 'gastro', ['نقط مغص', 'نقط غازات']],

  // Vitamins & supplements
  ['calcium-vitamin-d3', 'كالسيوم مع فيتامين د3', 'Calcium with vitamin D3', 'Calcium carbonate + cholecalciferol', '600 ملغ', 'tablet', '30 قرص', 'supplements', ['كالسيوم']],
  ['vitamin-d3-drops', 'فيتامين د3 نقط', 'Vitamin D3 drops', 'Cholecalciferol', '400 وحدة دولية', 'drops', '10 مل', 'supplements', ['فيتامين د للأطفال']],
  ['vitamin-b12-inj', 'فيتامين ب12 حقن', 'Vitamin B12 injection', 'Cyanocobalamin', '1000 ميكروغرام', 'injection', '5 أمبولات', 'supplements', ['ب12', 'B12']],
  ['zinc-syrup', 'زنك شراب', 'Zinc syrup', 'Zinc sulfate', '20 ملغ/5 مل', 'syrup', '100 مل', 'supplements', ['زنك للإسهال']],
  ['folic-acid-0-4', 'حمض الفوليك 400', 'Folic acid 400', 'Folic acid', '400 ميكروغرام', 'tablet', '30 قرص', 'supplements', ['فوليك للحمل']],

  // Neurology & epilepsy
  ['levetiracetam-500', 'ليفيتيراسيتام 500', 'Levetiracetam 500', 'Levetiracetam', '500 ملغ', 'tablet', '30 قرص', 'neuro', ['كيبرا', 'Keppra']],
  ['lamotrigine-100', 'لاموتريجين 100', 'Lamotrigine 100', 'Lamotrigine', '100 ملغ', 'tablet', '30 قرص', 'neuro', ['لاميكتال', 'Lamictal']],
  ['phenytoin-100', 'فينيتوين 100', 'Phenytoin 100', 'Phenytoin sodium', '100 ملغ', 'capsule', '100 كبسولة', 'neuro', ['إيبانوتين', 'Epanutin']],
  ['phenobarbital-30', 'فينوباربيتال 30', 'Phenobarbital 30', 'Phenobarbital', '30 ملغ', 'tablet', '30 قرص', 'neuro', ['لومينال', 'Luminal']],
  ['valproate-syrup', 'فالبروات الصوديوم شراب', 'Sodium valproate syrup', 'Sodium valproate', '200 ملغ/5 مل', 'syrup', '100 مل', 'neuro', ['ديباكين شراب']],
  ['gabapentin-300', 'جابابنتين 300', 'Gabapentin 300', 'Gabapentin', '300 ملغ', 'capsule', '30 كبسولة', 'neuro', ['نيورونتين', 'Neurontin']],
  ['pregabalin-75', 'بريجابالين 75', 'Pregabalin 75', 'Pregabalin', '75 ملغ', 'capsule', '28 كبسولة', 'neuro', ['ليريكا', 'Lyrica']],
  ['levodopa-carbidopa', 'ليفودوبا مع كاربيدوبا 250/25', 'Levodopa/carbidopa 250/25', 'Levodopa + carbidopa', '250/25 ملغ', 'tablet', '100 قرص', 'neuro', ['سينيميت', 'Sinemet']],

  // Mental health
  ['sertraline-50', 'سيرترالين 50', 'Sertraline 50', 'Sertraline', '50 ملغ', 'tablet', '30 قرص', 'mental_health', ['زولوفت', 'Zoloft']],
  ['fluoxetine-20', 'فلوكسيتين 20', 'Fluoxetine 20', 'Fluoxetine', '20 ملغ', 'capsule', '28 كبسولة', 'mental_health', ['بروزاك', 'Prozac']],
  ['escitalopram-10', 'إسيتالوبرام 10', 'Escitalopram 10', 'Escitalopram', '10 ملغ', 'tablet', '28 قرص', 'mental_health', ['سيبراليكس', 'Cipralex']],
  ['amitriptyline-25', 'أميتريبتيلين 25', 'Amitriptyline 25', 'Amitriptyline', '25 ملغ', 'tablet', '30 قرص', 'mental_health', ['تريبتيزول', 'Tryptizol']],
  ['risperidone-2', 'ريسبيريدون 2', 'Risperidone 2', 'Risperidone', '2 ملغ', 'tablet', '20 قرص', 'mental_health', ['ريسبردال', 'Risperdal']],
  ['olanzapine-10', 'أولانزابين 10', 'Olanzapine 10', 'Olanzapine', '10 ملغ', 'tablet', '28 قرص', 'mental_health', ['زيبريكسا', 'Zyprexa']],
  ['haloperidol-5', 'هالوبيريدول 5', 'Haloperidol 5', 'Haloperidol', '5 ملغ', 'tablet', '20 قرص', 'mental_health', ['هالدول', 'Haldol']],
  ['diazepam-5', 'ديازيبام 5', 'Diazepam 5', 'Diazepam', '5 ملغ', 'tablet', '20 قرص', 'mental_health', ['فاليوم', 'Valium']],

  // Allergy
  ['desloratadine-5', 'ديسلوراتادين 5', 'Desloratadine 5', 'Desloratadine', '5 ملغ', 'tablet', '20 قرص', 'allergy', ['إيريوس', 'Aerius']],
  ['fexofenadine-180', 'فيكسوفينادين 180', 'Fexofenadine 180', 'Fexofenadine', '180 ملغ', 'tablet', '20 قرص', 'allergy', ['تلفاست', 'Telfast']],
  ['chlorphenamine-4', 'كلورفينيرامين 4', 'Chlorphenamine 4', 'Chlorphenamine maleate', '4 ملغ', 'tablet', '20 قرص', 'allergy', []],
  ['cetirizine-syrup', 'سيتيريزين شراب', 'Cetirizine syrup', 'Cetirizine', '5 ملغ/5 مل', 'syrup', '100 مل', 'allergy', ['زيرتك شراب']],
  ['loratadine-syrup', 'لوراتادين شراب', 'Loratadine syrup', 'Loratadine', '5 ملغ/5 مل', 'syrup', '100 مل', 'allergy', ['كلاريتين شراب']],

  // Corticosteroids
  ['prednisolone-syrup', 'بريدنيزولون شراب', 'Prednisolone syrup', 'Prednisolone', '15 ملغ/5 مل', 'syrup', '60 مل', 'steroids', []],
  ['methylprednisolone-4', 'ميثيل بريدنيزولون 4', 'Methylprednisolone 4', 'Methylprednisolone', '4 ملغ', 'tablet', '30 قرص', 'steroids', ['ميدرول', 'Medrol']],
  ['dexamethasone-inj', 'ديكساميثازون حقن', 'Dexamethasone injection', 'Dexamethasone sodium phosphate', '4 ملغ/مل', 'injection', '10 أمبولات', 'steroids', []],

  // Eye & ear
  ['chloramphenicol-eye', 'كلورامفينيكول قطرة عين', 'Chloramphenicol eye drops', 'Chloramphenicol', '0.5%', 'drops', '10 مل', 'eye_ear', []],
  ['tobramycin-eye', 'توبراميسين قطرة عين', 'Tobramycin eye drops', 'Tobramycin', '0.3%', 'drops', '5 مل', 'eye_ear', ['توبركس', 'Tobrex']],
  ['tobramycin-dexamethasone-eye', 'توبراميسين مع ديكساميثازون قطرة عين', 'Tobramycin/dexamethasone eye drops', 'Tobramycin + dexamethasone', '0.3%/0.1%', 'drops', '5 مل', 'eye_ear', ['توبراديكس', 'TobraDex']],
  ['ciprofloxacin-eye', 'سيبروفلوكساسين قطرة عين وأذن', 'Ciprofloxacin eye/ear drops', 'Ciprofloxacin', '0.3%', 'drops', '5 مل', 'eye_ear', ['سيلوكسان', 'Ciloxan']],
  ['artificial-tears', 'دموع صناعية', 'Artificial tears', 'Hypromellose', '0.3%', 'drops', '15 مل', 'eye_ear', ['قطرة ترطيب']],
  ['timolol-eye', 'تيمولول قطرة عين', 'Timolol eye drops', 'Timolol', '0.5%', 'drops', '5 مل', 'eye_ear', ['تيموبتيك', 'Timoptic']],

  // Skin
  ['fusidic-acid-cream', 'حمض الفيوسيديك كريم', 'Fusidic acid cream', 'Fusidic acid', '2%', 'cream', '15 غ', 'skin', ['فيوسيدين', 'Fucidin']],
  ['mupirocin-ointment', 'موبيروسين مرهم', 'Mupirocin ointment', 'Mupirocin', '2%', 'ointment', '15 غ', 'skin', ['باكتروبان', 'Bactroban']],
  ['silver-sulfadiazine-cream', 'سلفاديازين الفضة كريم', 'Silver sulfadiazine cream', 'Silver sulfadiazine', '1%', 'cream', '50 غ', 'skin', ['فلامازين', 'Flamazine', 'كريم حروق']],
  ['betamethasone-cream', 'بيتاميثازون كريم', 'Betamethasone cream', 'Betamethasone valerate', '0.1%', 'cream', '15 غ', 'skin', ['بيتنوفيت', 'Betnovate']],
  ['zinc-oxide-ointment', 'مرهم أكسيد الزنك', 'Zinc oxide ointment', 'Zinc oxide', '10%', 'ointment', '30 غ', 'skin', ['كريم تسلخات']],

  // Women's health
  ['dydrogesterone-10', 'ديدروجستيرون 10', 'Dydrogesterone 10', 'Dydrogesterone', '10 ملغ', 'tablet', '20 قرص', 'womens_health', ['دوفاستون', 'Duphaston']],
  ['clotrimazole-vaginal-500', 'كلوتريمازول تحميلة مهبلية 500', 'Clotrimazole vaginal tablet 500', 'Clotrimazole', '500 ملغ', 'suppository', '1 تحميلة', 'womens_health', ['كانستين مهبلي']],
  ['levonorgestrel-ethinylestradiol', 'ليفونورجيستريل مع إيثينيل إستراديول', 'Levonorgestrel/ethinylestradiol', 'Levonorgestrel + ethinylestradiol', '0.15/0.03 ملغ', 'tablet', '21 قرص', 'womens_health', ['ميكروجينون', 'Microgynon']],

  // Urology
  ['tamsulosin-0-4', 'تامسولوسين 0.4', 'Tamsulosin 0.4', 'Tamsulosin', '0.4 ملغ', 'capsule', '30 كبسولة', 'urology', ['أومنيك', 'Omnic']],
  ['finasteride-5', 'فيناسترايد 5', 'Finasteride 5', 'Finasteride', '5 ملغ', 'tablet', '28 قرص', 'urology', ['بروسكار', 'Proscar']],
];
