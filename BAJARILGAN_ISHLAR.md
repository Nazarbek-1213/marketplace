# 2cbazar loyihasida bajarilgan ishlar

## Marketplace xaridorlar sayti

- Uzum Market uslubidan ilhomlangan, turli mahsulot kategoriyalariga moslashadigan marketplace interfeysi yaratildi.
- Kategoriyalar yon paneli va tanlangan kategoriyaga qarab o‘zgaradigan bosh sahifa/hero rasmi qo‘shildi.
- Mahsulotlarni kategoriya va nomi bo‘yicha qidirish, mahsulot kartalari va savat oqimi qo‘shildi.
- Xariddan keyin xarid qilingan mahsulotga baho va izoh qoldirish imkoniyati qo‘shildi. Xaridsiz sharh qoldirish cheklangan.
- Xaridlar tarixi va foydalanuvchining sharhlari bilan ishlash imkoniyatlari qo‘shildi.
- Ko‘p rasmli mahsulotlar uchun rasm galereyasi qo‘shildi.
- Profilni ko‘rish va tahrirlash oynasi qo‘shildi: ism-familiya, telefon, jins va tug‘ilgan sana.

## Sotuvchi kabineti

- Email orqali kod bilan ro‘yxatdan o‘tish, username/parol orqali kirish va sotuvchi profilini boshqarish qo‘shildi.
- Mahsulot nomi, kategoriya, tavsif, narx va ombordagi sonini kiritib mahsulot joylash formasi yaratildi.
- Mahsulot uchun 1–3 ta JPEG, PNG yoki WebP rasm tanlash, ko‘rib chiqish va tanlangan rasmlarni olib tashlash imkoniyati qo‘shildi.
- Har bir rasm uchun 5 MB hajm cheklovi va serverda rasm formati/haqiqiyligini tekshirish qo‘shildi.
- Mahsulot rasmlari marketplace’da ko‘rsatiladi; bir nechta rasm bo‘lsa, galereyada ular orasida almashish mumkin.
- Sotuvlar uchun haftalik va oylik analitika, kunlik grafik va ko‘p sotilgan mahsulotlar ro‘yxati qo‘shildi.
- Sotuvchi profiliga ism-familiya, telefon, jins va tug‘ilgan sanani ko‘rish/tahrirlash qo‘shildi.

## Backend va autentifikatsiya

- FastAPI asosida marketplace va seller API’lari yaratildi.
- Xaridorlar uchun email kod orqali kirish, sotuvchilar uchun email kodli ro‘yxatdan o‘tish qo‘shildi.
- JWT access token 30 kunlik, refresh token 60 kunlik qilib sozlandi; refresh token aylantiriladi.
- `GET/PATCH /api/auth/me` orqali profil ma’lumotlarini olish va yangilash qo‘shildi.
- Mahsulot, buyurtma, xaridlar tarixi, sharhlar va sotuvchi analitikasi endpointlari yaratildi.
- Mahsulot rasmlarini yuklash uchun seller autentifikatsiyasini talab qiladigan multipart API qo‘shildi.
- Mahsulotlarga `image_urls` maydoni kiritildi va mavjud ma’lumotlar bazalari uchun ustun migratsiyasi qo‘shildi.
- Yuklangan rasm fayllariga `/uploads/` yo‘li orqali kirish sozlandi.

## Docker, Nginx va lokal ishga tushirish

- PostgreSQL, FastAPI, marketplace, seller va Nginx servislariga арналған Docker Compose sozlamalari qo‘shildi.
- Nginx orqali `2cnzrbk.uz` marketplace va `seller.2cnzrbk.uz` sotuvchi saytiga yo‘naltirish sozlandi.
- Yuklangan rasm fayllari uchun Docker named volume qo‘shildi.
- Lokal Vite serverlarida API va yuklangan rasmlar uchun FastAPI proxy sozlandi.
- Lokal ishlab chiqish vaqtida API va ikkala frontend ishga tushirilib, sahifalarning HTTP javoblari tekshirildi.

## Tekshiruvlar

- Backend API testlari muvaffaqiyatli o‘tdi. Rasm yuklash uchun autentifikatsiya, rasm soni, noto‘g‘ri format, hajm chegarasi va mahsulotda rasm URL’larini saqlash tekshirildi.
- Marketplace va seller frontend’lari TypeScript tekshiruvi hamda production build’dan muvaffaqiyatli o‘tdi.
- Docker image build tekshiruvi bajarilmagan: avvalgi lokal tekshiruv vaqtida Docker daemon ishlamayotgan edi.
