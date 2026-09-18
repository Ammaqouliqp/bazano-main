# بازانو - نسخه تست با طراحی فعلی

این پکیج شامل:

- طراحی و صفحات فعلی شما
- ورود با **Email OTP**
- صفحه نیازها (Needs)
- صفحه پیشنهادها (Offers)
- Backend (Node.js + SQLite)

## فایل‌های جدید اضافه شده

- `login.html` — ورود با ایمیل OTP
- `needs.html` — لیست و ثبت نیاز
- `offers.html` — لیست و ثبت پیشنهاد
- `app.js` — سرور
- `assets/js/bazano-auth.js`
- `assets/js/bazano-needs.js`
- `assets/js/bazano-offers.js`

## اجرا روی لوکال

```bash
cd bazano-main
npm install
node app.js
```

سپس:
- http://localhost:3000
- http://localhost:3000/login.html
- http://localhost:3000/needs.html
- http://localhost:3000/offers.html

کد OTP در **کنسول سرور** نمایش داده می‌شود.

## استقرار روی میهن‌وب‌هاست

1. آپلود و Extract
2. cPanel → Setup Node.js App
3. Startup file: `app.js`
4. Run NPM Install
5. Restart

## نکات

- OTP فعلاً در حالت تست است (کد در کنسول چاپ می‌شود)
- طراحی صفحات جدید از توکن‌های `--bz-*` و استایل فعلی شما استفاده می‌کند
- برای اتصال کامل‌تر header و mobile bottom nav به صفحات اصلی، می‌توانید header کامل را از index.html کپی کنید
