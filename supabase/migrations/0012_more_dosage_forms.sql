-- 0012 · More dosage forms for the larger catalog (eye drops, ampoules, ointments, gels,
-- suppositories, sprays, solutions). Only widens the allowed list: every existing row stays valid.
-- Same list as DOSAGE_FORMS in src/data/types.ts.
alter table public.medicines drop constraint medicines_dosage_form_check;
alter table public.medicines add constraint medicines_dosage_form_check check (dosage_form in (
  'tablet', 'capsule', 'syrup', 'suspension', 'injection_pen', 'vial', 'inhaler', 'sachet', 'cream',
  'drops', 'injection', 'ointment', 'gel', 'suppository', 'spray', 'solution'
));
