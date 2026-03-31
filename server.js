require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static("public"));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function askOpenAI(systemPrompt, userPrompt) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  const result = await response.json();

  if (!response.ok) {
    console.log("OPENAI API ERROR:", result);
    throw new Error(result.error?.message || "OpenAI hata verdi");
  }

  const text = result?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("AI boş cevap döndü.");
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.log("JSON PARSE ERROR:", text);
    throw new Error("AI geçerli JSON döndürmedi.");
  }
}

function splitSkills(skills) {
  return (skills || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

app.get("/health", (req, res) => {
  res.json({ ok: true, message: "Server çalışıyor." });
});

app.post("/generate", async (req, res) => {
  try {
    const {
      fullName,
      phone,
      email,
      job,
      education,
      skills,
      exp
    } = req.body;

    const systemPrompt = `
Sen bir CV içerik üretim motorusun.

Kurallar:
- Sadece JSON döndür
- Başlık yazma
- Markdown kullanma
- Üçüncü tekil şahıs kullanma
- Birinci tekil şahıs kullan
- Türkçe yaz
- Doğal, sade, profesyonel yaz
- Abartılı övgü kullanma

Sadece şu formatta cevap ver:
{
  "about": "string"
}
`;

    const userPrompt = `
Kullanıcının CV'sindeki "Hakkımda" bölümünü yaz.

Kurallar:
- 2 veya 3 cümle olsun
- Kullanıcı kendi ağzından konuşsun
- Verilen pozisyonu aynen kullan
- Kısa, net ve profesyonel olsun

Bilgiler:
Ad Soyad: ${fullName || ""}
Telefon: ${phone || ""}
E-posta: ${email || ""}
Hedef Pozisyon: ${job || ""}
Deneyim Seviyesi: ${exp || ""}
Eğitim: ${education || ""}
Beceriler: ${(skills || "").trim()}
`;

    const parsed = await askOpenAI(systemPrompt, userPrompt);

    res.json({
      fullName: fullName || "Ad Soyad",
      phone: phone || "-",
      email: email || "-",
      job: job || "Hedef Pozisyon",
      education: education || "-",
      profile: parsed.about || "Metin oluşturulamadı.",
      experienceText: "",
      skillList: splitSkills(skills).length
        ? splitSkills(skills)
        : ["İletişim", "Takım çalışması", "Sorumluluk bilinci"]
    });
  } catch (error) {
    console.log("SERVER ERROR /generate:", error);
    res.status(500).json({
      message: error.message || "Sunucu hatası"
    });
  }
});

app.post("/generate-about", async (req, res) => {
  try {
    const {
      fullName,
      job,
      education,
      skills,
      city,
      currentText
    } = req.body;

    const systemPrompt = `
Sen bir CV içerik üretim motorusun.

Kurallar:
- Sadece JSON döndür
- Başlık yazma
- Markdown kullanma
- Birinci tekil şahıs kullan
- Üçüncü tekil şahıs kullanma
- Türkçe yaz
- Kısa, sade ve profesyonel yaz
- Abartılı övgü kullanma

Sadece şu formatta cevap ver:
{
  "about": "string"
}
`;

    const userPrompt = `
Kullanıcının CV'sindeki "Hakkımda" bölümünü yaz.

Kurallar:
- 2 veya 3 cümle olsun
- Kullanıcı kendi ağzından konuşsun
- Verilen pozisyonu aynen kullan
- Şehir bilgisini yalnızca doğal duruyorsa kullan
- Mevcut metin varsa ondan ilham al ama birebir tekrar etme

Bilgiler:
Ad Soyad: ${fullName || ""}
Hedef Pozisyon: ${job || ""}
Eğitim: ${education || ""}
Şehir: ${city || ""}
Beceriler: ${skills || ""}
Mevcut Hakkımda Metni: ${currentText || ""}
`;

    const parsed = await askOpenAI(systemPrompt, userPrompt);

    res.json({
      about: parsed.about || "Metin oluşturulamadı."
    });
  } catch (error) {
    console.log("SERVER ERROR /generate-about:", error);
    res.status(500).json({
      message: error.message || "Sunucu hatası"
    });
  }
});

app.post("/generate-experience", async (req, res) => {
  try {
    const {
      fullName,
      targetJob,
      experienceLevel,
      skills,
      company,
      role,
      date,
      currentDescription,
      extraNote
    } = req.body;

    const systemPrompt = `
Sen bir CV içerik üretim motorusun.

Kurallar:
- Sadece JSON döndür
- Başlık yazma
- Markdown kullanma
- Birinci tekil şahıs kullan
- Üçüncü tekil şahıs kullanma
- Türkçe yaz
- Profesyonel ama sade yaz
- Abartılı övgü kullanma

Sadece şu formatta cevap ver:
{
  "description": "string"
}
`;

    const userPrompt = `
Kullanıcının CV'sindeki tek bir iş deneyimi için açıklama yaz.

Kurallar:
- 2 veya 3 cümle olsun
- Kullanıcı kendi ağzından konuşsun
- Pozisyonu aynen kullan
- Şirket adı ve tarih varsa doğal biçimde kullanabilirsin
- Eğer mevcut açıklama varsa ondan ilham al ama daha profesyonel yaz
- Görevleri gerçekçi ve sade yaz

Yazım yönü:
- Eğer experienceLevel "Deneyim yok" ise yeni başlayan ama öğrenmeye açık şekilde yaz
- Eğer experienceLevel "Az deneyim" ise temel görevleri yapmış gibi yaz
- Eğer experienceLevel "Deneyimli" ise daha güçlü ama sade yaz

Bilgiler:
Ad Soyad: ${fullName || ""}
Hedef Pozisyon: ${targetJob || ""}
Genel Deneyim Seviyesi: ${experienceLevel || ""}
Beceriler: ${skills || ""}
Şirket: ${company || ""}
Pozisyon: ${role || ""}
Tarih: ${date || ""}
Ek Not: ${extraNote || ""}
Mevcut Açıklama: ${currentDescription || ""}
`;

    const parsed = await askOpenAI(systemPrompt, userPrompt);

    res.json({
      description: parsed.description || "Açıklama oluşturulamadı."
    });
  } catch (error) {
    console.log("SERVER ERROR /generate-experience:", error);
    res.status(500).json({
      message: error.message || "Sunucu hatası"
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`V4 server çalışıyor: http://localhost:${PORT}`);
});