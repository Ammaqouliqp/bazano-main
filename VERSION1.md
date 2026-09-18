# بازانو — نسخه اول (پیاده‌سازی)

## اجرا

```bash
npm install
node app.js
```

سپس: http://localhost:3000

## جریان اصلی

1. `/login.html` — OTP ایمیل
2. `/complete-profile.html` — نام، نام‌خانوادگی، تلفن (اجباری)
3. خانه / نیازها / خدمات / داشبورد / گفتگو

## ادمین

در SQLite بعد از ساخت اولین کاربر:

```sql
UPDATE users SET role='admin' WHERE email='your@email.com';
```

## صفحات جدید / به‌روز

| مسیر | توضیح |
|------|--------|
| login.html | OTP |
| complete-profile.html | تکمیل ثبت‌نام |
| needs.html | لیست + ثبت نیاز |
| need-details.html | جزئیات نیاز |
| offers.html | لیست خدمات |
| offer-details.html | جزئیات خدمت |
| chat.html | گفتگو (polling) |
| profile/ | هویت |
| profile/dashboard.html | پنل نقش‌محور |
| become-provider.html | معرفی ارائه‌دهنده |

## APIهای کلیدی

- POST /api/auth/send-otp
- POST /api/auth/verify-otp
- POST /api/auth/complete-profile
- GET/POST /api/needs
- GET/POST /api/offers
- GET /api/conversations
- POST /api/admin/needs/:id/assign
- POST /api/admin/users/:id/role

## SMTP

Environment variables:
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, JWT_SECRET

بدون SMTP در توسعه، کد OTP در لاگ سرور و `devCode` برمی‌گردد.

## باقی‌مانده برای پولیش

- بازطراحی کامل index.html با story-pin + glass (ساختار فعلی قالب حفظ شده)
- magnetic header از changes.md روی همه صفحات
- یکدست‌سازی هدر کامل قالب روی صفحات جدید
- وبلاگ ارائه‌دهنده
