# Training simplified + team fixes

## 1. Series khatam — sirf Training Videos

- Admin panel ki Library section se "Series" poori tarah hat jayegi. Ab admin sirf **Training Video** add karega: title, description, video (upload ya link), cover, ratio, order, publish.
- Har video ke saath **access** ka option: kis level (rank) ke logon ko dikhegi. Admin ek ya kai levels choose kar sakta hai.
- Purani series ke andar ki videos bewaqoofi se gum na hon: migration unhe unke level ke saath seedha videos ki tarah rakh degi, phir series table/ka UI hata denge.
- Member side: dashboard ka "Training levels" wala section aur `/levels`, `/level/$slug`, `/series/$seriesId` pages hat jayenge. Unki jagah dashboard par ek **Training Videos** section — saaf grid, cover image, duration, jo bhi us member ke rank ko allowed ho. Search bhi videos par chalega.

## 2. Naya ID banane par details lena

- Upline (dashboard) aur admin panel — dono jagah ID banne ke baad welcome card par:
  - **Copy details** button (naam, ID, password, upline).
  - **Save image** button — card ki tasveer bana kar phone mein download ho jaye (screenshot ki zaroorat na pade).
  - **Share** button jahan phone support karta hai (WhatsApp par seedha bhej de).

## 3. Form ke placeholders

- Seat reservation form se "Ahmad Raza" / "03001234567" jaise likhe hue naam-number hata denge; sirf saaf labels rahenge ("Full name", "Phone number", "Age").

## 4. Delete matlab delete

- Upline jab kisi ko **Remove** kare: account, uska login, uska record aur uski chat — sab hat jayen; team list, admin list, kahin bhi na dikhe.
- Admin panel se member/trainee remove karne par bhi wahi — permanently hataya jaye, sirf "removed" mark nahi.
- Block/unblock pehle ki tarah reversible rahega; Remove par confirm dialog aayega ("ye wapis nahi aayega").

## 5. Website tez

- Bhaari lists par chhoti queries aur cache time badhana (levels/videos ke liye stale time), thumbnails lazy + width-limited.
- Dashboard par jo data ek hi call mein aa sakta hai use ek server call mein lana (aaj kai calls hoti hain).
- Chat ki polling ko halka karna (jab tab background mein ho to poll band).
- Bade pages ka code alag chunk mein (admin panel member app ke saath load na ho).

## 6. Upload background mein chalta rahe

- Upload ek app-level manager mein chala jayega: dialog ya section band karne par upload rukega nahi, complete hone par save ho jayega.
- Neeche ek chhoti progress patti (kitne % , kitni der baaki) jo poore app par dikhti rahegi.
- Page reload/app band karne par hi upload rukega — us waqt warning dikhayenge.

## Technical notes

- Migration: `content_access` ko `content_type = 'lecture'` ke liye use karenge (aaj sirf 'series' hai), purani series ki har lecture ko uske level + access rows ke saath backfill, `series_id` null, phir `series`/`content_access` series rows cleanup. `resources.series_id` wale rows unki lecture par shift.
- Server fns: `adminSaveSeries`, `adminGetSeriesAccess`, `adminUpdateSeriesAccess`, `getSeriesDetail`, `getTrainingLevels`/`getLevelDetail` ki jagah `adminSaveVideoAccess` + `getTrainingVideos`; `can_access_lecture` ko lecture-level access rows par chalayenge.
- Hard delete: naya `deleteTraineeAccount` (upline-scoped) aur admin `adminDeleteMember` — chat_messages, unlocks, watch_positions, row, phir `auth.admin.deleteUser`.
- Upload manager: `src/lib/upload-manager.ts` (module-level queue + subscribe) + `<UploadDock />` in `__root.tsx`; forms upload handle register karke unmount ke baad bhi complete hone par server fn call karenge.
- Routes hatane par `search.tsx`, `cards.tsx`, `ResourceList.tsx`, `admin.index.tsx` tabs update honge.
