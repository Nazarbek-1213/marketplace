# 2cbazar: ilova imkoniyatlari va cheklovlari

Ushbu hujjat loyihaning hozirgi kodida mavjud bo‘lgan funksiyalarni va hali
amalga oshirilmagan imkoniyatlarni tushuntiradi. Kelajakda rejalashtirilgan
funksiya amalda mavjuddek talqin qilinmasligi uchun, ro‘yxat joriy holatga
asoslangan.

## Ilova nima qiladi?

2cbazar ikki qismdan iborat marketplace:

- **Xaridorlar sayti** — mahsulot ko‘rish, savatga yig‘ish va buyurtma yaratish.
- **Sotuvchi kabineti** — sotuvchi sifatida ro‘yxatdan o‘tish, mahsulot joylash va sotuv hisobotlarini ko‘rish.

Backend FastAPI orqali ishlaydi, ma’lumotlar bazasida foydalanuvchilar,
mahsulotlar, buyurtmalar va sharhlar saqlanadi. Loyiha PostgreSQL bilan Docker
orqali yoki lokal ishlab chiqishda SQLite bilan ishlashi mumkin.

## Xaridorlar uchun imkoniyatlar

- Mahsulotlar katalogini ko‘rish; faqat omborda mavjud mahsulotlar ko‘rsatiladi.
- Mahsulot nomi bo‘yicha qidirish va kategoriya bo‘yicha saralash.
- Mahsulot narxi, tavsifi, zaxiradagi soni, rasmlari va baholarini ko‘rish.
- Bir nechta mahsulotni savatga qo‘shish, miqdorini belgilash va yetkazib berish manzilini kiritib buyurtma yuborish.
- O‘z buyurtmalari tarixini ko‘rish.
- Faqat xarid qilgan mahsulotiga baho va sharh qoldirish. Bir xaridor bir mahsulotga bir marta sharh qoldirishi mumkin.
- Mahsulotlarning ommaviy sharhlarini va o‘z sharhlari ro‘yxatini ko‘rish.
- Email orqali bir martalik kod bilan kirish. Birinchi muvaffaqiyatli tasdiqlashda xaridor hisobi avtomatik yaratiladi.
- Profilidagi ism-familiya, telefon, jins va tug‘ilgan sanani ko‘rish yoki o‘zgartirish.

## Sotuvchilar uchun imkoniyatlar

- Emailga yuborilgan kodni tasdiqlab sotuvchi hisobini ro‘yxatdan o‘tkazish.
- Username va parol orqali kabinetga kirish.
- Mahsulot nomi, kategoriya, tavsif, narx va ombordagi miqdorni kiritib mahsulot qo‘shish.
- Mahsulotga ixtiyoriy ravishda JPEG, PNG yoki WebP formatida 1–3 ta rasm yuklash. Har bir rasm 5 MB dan oshmasligi kerak.
- O‘z mahsulotlari ro‘yxatini ko‘rish.
- Haftalik (7 kun) yoki oylik (30 kun) tushum, buyurtmalar soni va sotilgan dona hisobotlarini ko‘rish.
- Kunlik savdo grafigi va eng ko‘p sotilgan mahsulotlarni ko‘rish. Hisobot oldingi teng davr bilan solishtiriladi va O‘zbekiston vaqti asosida hisoblanadi.
- Profil ma’lumotlarini ko‘rish yoki tahrirlash.

## Kirish va xavfsizlik qanday ishlaydi?

- Xaridor email kodini so‘raydi va shu kodni tasdiqlab tizimga kiradi.
- Sotuvchi email kod bilan ro‘yxatdan o‘tadi; keyingi kirish username va parol bilan.
- Kirish muvaffaqiyatli bo‘lganda API `access_token` va `refresh_token` qaytaradi.
- Himoyalangan so‘rovlarda `access_token` `Authorization: Bearer ...` shaklida yuboriladi.
- `access_token` standart holatda 30 kun amal qiladi. `refresh_token` standart holatda 60 kun amal qiladi va har ishlatilganda yangisiga almashtiriladi. Yangilash javobidagi ikkala tokenni ham saqlash kerak.
- Email kodi 10 daqiqada tugaydi, 5 martagacha tekshiriladi va qayta kodni daqiqada bir marta so‘rash mumkin.
- Xaridor va sotuvchi amallari rollar bo‘yicha ajratilgan.

## Hozircha nimalarni qila olmaydi?

- **Onlayn to‘lovni qabul qilmaydi.** Click, Payme, bank kartasi yoki boshqa to‘lov provayderi ulanmagan. Buyurtma yaratilishi to‘lov amalga oshganini anglatmaydi.
- **Yetkazib berishni tashkil qilmaydi.** Kuryer yoki pochta xizmatiga buyurtma uzatilmaydi; jonli kuzatuv raqami yoki yetkazish holati yo‘q.
- **Buyurtmani boshqarish vositalari yo‘q.** Xaridor buyurtmani bekor qila olmaydi; sotuvchi/admin buyurtmani tasdiqlash, jo‘natilgan deb belgilash yoki qaytarishni boshqarish uchun kabinetga ega emas.
- **Mahsulotni tahrirlash yoki o‘chirish yo‘q.** Sotuvchi hozir mahsulot qo‘sha oladi va o‘z ro‘yxatini ko‘radi, lekin mavjud mahsulot narxi, tavsifi yoki zaxirasini tahrirlash/o‘chirish funksiyasi yo‘q.
- **Administrator paneli yo‘q.** Foydalanuvchilar, sotuvchilar, mahsulotlar yoki buyurtmalarni boshqaradigan admin interfeysi mavjud emas.
- **Parolni tiklash yoki almashtirish oqimi yo‘q.** Sotuvchi parolini unutsa, ilovada uni tiklash endpointi mavjud emas.
- **Sotuvchiga alohida buyer profili berilmaydi.** Email rollari alohida: sotuvchi emaili bilan xaridor oqimidan kirib bo‘lmaydi.
- **Savat serverda saqlanmaydi.** Savat brauzer interfeysida boshqariladi; boshqa qurilmaga avtomatik ko‘chirish yoki hisoblararo sinxronlash mavjud emas.
- **Sotuvchi analitikasi faqat saqlangan buyurtmalarga asoslanadi.** To‘lov va yetkazish ulanmagani sababli tushum hisobotlari real to‘langan mablag‘ yoki bajarilgan yetkazmalarni tasdiqlamaydi.
- **SMS, push yoki buyurtma holati haqida alohida bildirishnoma yo‘q.**

## Ishlatishdan oldin bilish kerak

- Lokal ishlab chiqishda SMTP sozlanmagan bo‘lsa, email tasdiqlash kodi backend logida yoziladi. Production’da kod email orqali yuborilishi uchun SMTP sozlamalari kerak.
- Production’da `JWT_SECRET` va `OTP_SECRET` alohida, tasodifiy va kamida 32 belgili bo‘lishi kerak. Bu qiymatlarni frontendga, API so‘roviga yoki OpenAPI klientidagi HMAC maydoniga kiritmang.
- Hozirgi Nginx konfiguratsiyasi HTTPS sertifikatini o‘rnatmaydi. Ommaviy serverda haqiqiy parol yoki token ishlatishdan oldin TLS/HTTPS sozlanishi shart.
- Docker orqali barcha servislarni ishga tushirish uchun `.env` faylida kerakli ma’lumotlar bo‘lishi va Docker Engine ishlayotgan bo‘lishi kerak.

## Qisqa xulosa

Ilova hozir katalog, xaridor/sotuvchi autentifikatsiyasi, mahsulot joylash,
buyurtma yozuvi, xariddan keyingi sharhlar va sodda sotuvchi analitikasini
ta’minlaydi. To‘liq tijoriy savdo oqimi uchun to‘lov, yetkazib berish,
buyurtmalarni boshqarish, mahsulotni tahrirlash/o‘chirish va admin imkoniyatlari
hali qo‘shilishi kerak.
