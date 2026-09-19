# MERN project চালানোর সহজ নিয়ম

এই ZIP-এ frontend ও backend দুটোই আছে। আলাদা কোনো frontend বানাতে হবে না।

## সবচেয়ে সহজে demo চালান

1. Node.js **22.12 বা তার পরের version** install করুন। Node 24 LTS ব্যবহার করতে পারেন।
2. ZIP extract করে `pharmacy-cold-chain` folder VS Code-এ খুলুন।
3. VS Code terminal-এ লিখুন:

```bash
npm install
npm run demo
```

4. Browser-এ খুলুন: **http://localhost:4000**
5. Project-এর মূল folder-এ তৈরি হওয়া `.env` খুলুন। এখানে তিনটি login password পাবেন:

| Username | `.env`-এ password-এর নাম |
|---|---|
| nurse | DEMO_NURSE_PASSWORD |
| pharmacist | DEMO_PHARMACIST_PASSWORD |
| auditor | DEMO_AUDITOR_PASSWORD |

Password copy করার সময় `=` চিহ্নের পরের অংশটুকু নিন। `.env` কারও সঙ্গে share করবেন না।

**এই demo-এর জন্য নিজের MongoDB account বা Docker লাগবে না।** Program অস্থায়ী একটি আসল MongoDB replica set চালায়। প্রথমবার package এবং MongoDB download-এর জন্য internet লাগবে। Terminal বন্ধ করলে এই অস্থায়ী demo-এর data আর থাকবে না।

## কীভাবে দেখাবেন

1. **nurse** দিয়ে login → **New request** → `demo-order-01` → **Read order** → **Validate & submit**।
2. Sign out → **pharmacist** দিয়ে login → request খুলে **Approve request**।
3. Temperature `4`, batch/lot এবং ভবিষ্যতের expiry দিন → **Confirm packing**।
4. Courier ও ETA বেছে **Generate demo HL7** → **Process departure**।
5. কয়েক সেকেন্ড পর status **In transit** হবে।
6. আবার **nurse** login → **My notifications** → notification দেখুন → request খুলে **Confirm receipt**।
7. **auditor** login → **Audit trail** → **Verify chain**।

দ্বিতীয় sample prescription হলো `demo-order-02`; এর dose 12 units। প্রথমটির dose 10 units। এগুলো শুধুই software test data, চিকিৎসার পরামর্শ নয়।

## Code edit করতে চাইলে

- Frontend: `client/src/main.jsx` এবং `client/src/styles.css`
- Backend: `server/src/`
- Database models: `server/src/db.js`
- Configuration: root `.env`

Data স্থায়ী রাখতে Docker Desktop install করে চালান:

```bash
npm run setup
docker compose up -d mongo
npm run seed
npm run dev
```

এবার frontend হবে **http://localhost:5173**, backend **http://localhost:4000**। চাইলে `.env`-এর `MONGO_URI`-তে নিজের MongoDB Atlas URI দিতে পারেন। Password-এ special character থাকলে URI encode করতে হবে। `.env.example` একটি নমুনা; নিজের password কেবল `.env`-এ রাখবেন।

## Test চালান

```bash
npm run check
```

এতে automated tests ও frontend production build হবে। Test database আপনার application database থেকে আলাদা।

## Demo আর live mode-এর পার্থক্য

- **demo:** নিজের sample FHIR prescription ও drug-name fixture; internet ছাড়া workflow দেখানো যায়, initial download শেষ হলে।
- **live:** আপনার configured FHIR R4 server ও NIH RxNorm API-তে আসল API request যায়। `README.md`-এর live setup অনুসরণ করুন।
- `npm run demo` সবসময় demo mode চালায়। Live test করতে `npm run dev` বা `npm start` লাগবে।
- Nurse-এর in-app notification শুরু থেকেই কাজ করে। আসল phone/browser push-এর জন্য VAPID keys ও browser permission লাগবে; README-তে নির্দেশনা আছে।

Project-এ PHI ছাড়া notification এবং tamper-evident audit আছে। Production HIPAA certification বা immutable cloud storage configured আছে—এমন দাবি করা হচ্ছে না; সেই deployment requirements README-তে দেওয়া আছে।
