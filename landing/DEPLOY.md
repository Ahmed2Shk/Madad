# نشر صفحة التعريف (landing) — تعليمات لـ Claude Code

هذا المجلد موقع ثابت مستقل عن تطبيق مَدَد، بلا خطوة بناء.

## 1. المستودع
- ضع المجلد في جذر المستودع باسم `landing/`.
- لا يدخل في بناء Vite الخاص بالتطبيق، ولا يُفحص بحد الحجم 200KB.

## 2. Cloudflare Pages (مشروع جديد)
- اربط نفس المستودع بمشروع Pages ثانٍ.
- Build command: (فارغ) · Build output directory: `landing`.
- فعّل Cloudflare Web Analytics للمشروع (مجاني).

## 3. الدومين (بعد شرائه من Cloudflare Registrar)
- مشروع landing ← Custom domain: `DOMAIN` (والـ www يحوّل إليه).
- مشروع التطبيق ← Custom domain: `app.DOMAIN`.
- في `landing/index.html`: غيّر `const APP_URL = 'https://madad-6p2.pages.dev'` إلى `https://app.DOMAIN`، واستبدل `DOMAIN` في وسوم og:image.
- في Supabase ← Authentication ← URL Configuration: أضف `https://app.DOMAIN` إلى Site URL و Redirect URLs، وإلا يتعطل الدخول بـ Google واستعادة كلمة المرور.
- في Google Cloud (OAuth) أضف `https://app.DOMAIN` إلى Authorized JavaScript origins إن كان الدخول بـ Google مفعّلًا.

## 4. رمز QR
- الرابط المطبوع: `https://DOMAIN/?src=qr` (و `?src=flyer` أو غيره لكل حملة).
- الصفحة تمرر `src` إلى روابط التطبيق كـ `utm_source`، فتظهر المصادر في Web Analytics.

## ملاحظات
- كل الأسماء والأرقام في الصفحة تجريبية ومعلّمة بذلك.
- الفيديو 720p (حوالي 4MB) لا يُحمَّل إلا عند الضغط على تشغيل.
