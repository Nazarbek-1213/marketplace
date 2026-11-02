import { FormEvent, useCallback, useEffect, useState } from "react";

type Tokens = { access_token: string; refresh_token: string };
type Product = {
  id: number; seller_id: number; name: string; description: string;
  category: string; image_url: string | null; price: string; stock: number;
  image_urls: string[];
};
type Seller = {
  id: number;
  email: string;
  username: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  gender: string | null;
  birth_date: string | null;
};
type ProfileForm = {
  full_name: string;
  phone: string;
  gender: string;
  birth_date: string;
};
type SalesPeriod = "weekly" | "monthly";
type Analytics = {
  period: SalesPeriod;
  days: number;
  start_date: string;
  end_date: string;
  revenue: string;
  orders: number;
  units_sold: number;
  previous_revenue: string;
  previous_orders: number;
  previous_units_sold: number;
  daily: { date: string; revenue: string; orders: number; units_sold: number }[];
  top_products: { product_id: number; name: string; units_sold: number; revenue: string }[];
};
type AuthMode = "login" | "register";
type FregeEmbed = {
  setApiKey(apiKey: string): void;
  mount(options: {
    el: string;
    project: string;
    stage: string;
    agent: string;
  }): void;
};

declare global {
  interface Window {
    Frege?: FregeEmbed;
  }
}

let fregeScriptPromise: Promise<void> | null = null;

function loadFregeScript(): Promise<void> {
  if (window.Frege) return Promise.resolve();
  if (!fregeScriptPromise) {
    fregeScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://mcp.frege.uz/v1/embed.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        fregeScriptPromise = null;
        reject(new Error("Frege chat skriptini yuklab bo‘lmadi."));
      };
      document.head.appendChild(script);
    });
  }
  return fregeScriptPromise;
}

function FregeChat() {
  const [error, setError] = useState("");

  useEffect(() => {
    const apiKey = import.meta.env.VITE_FREGE_API_KEY;
    if (!apiKey) {
      setError("Frege chat sozlanmagan: VITE_FREGE_API_KEY kalitini kiriting.");
      return;
    }

    let active = true;
    void loadFregeScript()
      .then(() => {
        if (!active) return;
        if (!window.Frege) throw new Error("Frege chat API mavjud emas.");
        window.Frege.setApiKey(apiKey);
        window.Frege.mount({
          el: "#frege-chat",
          project: "01a198fc-f829-70c7-ad66-434b3f071ece",
          stage: "staging",
          agent: "01a19a42-7575-7c8b-bcf9-fd74573a041c",
        });
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Frege chatni yuklab bo‘lmadi.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div id="frege-chat" className="frege-chat">
      {error && <div className="frege-chat-error" role="status">{error}</div>}
    </div>
  );
}

const formatPrice = (price: string | number) =>
  `${Number(price).toLocaleString("uz-UZ")} so‘m`;

function periodChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "Yangi" : "0%";
  const percentage = Math.round(((current - previous) / previous) * 100);
  return `${percentage > 0 ? "+" : ""}${percentage}%`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let response = await fetch(`/api${path}`, { ...init, headers });
  if (response.status === 401 && headers.has("Authorization") && path !== "/auth/refresh") {
    const saved = localStorage.getItem("2cbazar_seller_tokens");
    if (saved) {
      try {
        const current = JSON.parse(saved) as Tokens;
        const refreshed = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: current.refresh_token }),
        });
        if (refreshed.ok) {
          const next = await refreshed.json() as Tokens;
          localStorage.setItem("2cbazar_seller_tokens", JSON.stringify(next));
          headers.set("Authorization", `Bearer ${next.access_token}`);
          response = await fetch(`/api${path}`, { ...init, headers });
        } else {
          localStorage.removeItem("2cbazar_seller_tokens");
        }
      } catch {
        localStorage.removeItem("2cbazar_seller_tokens");
      }
    }
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? "So‘rov bajarilmadi. Qayta urinib ko‘ring.");
  }
  return response.json() as Promise<T>;
}

export default function App() {
  const [tokens, setTokens] = useState<Tokens | null>(() => {
    const saved = localStorage.getItem("2cbazar_seller_tokens");
    return saved ? JSON.parse(saved) as Tokens : null;
  });
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("weekly");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    full_name: "",
    phone: "",
    gender: "",
    birth_date: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [productForm, setProductForm] = useState({
    name: "", category: "Elektronika", description: "", price: "", stock: "1",
  });
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  useEffect(() => {
    const previews = selectedImages.map((file) => URL.createObjectURL(file));
    setImagePreviews(previews);
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [selectedImages]);

  const loadProducts = useCallback(async (access: string) => {
    const result = await request<Product[]>("/seller/products", {
      headers: { Authorization: `Bearer ${access}` },
    });
    setProducts(result);
  }, []);

  const loadAnalytics = useCallback(async (access: string, period: SalesPeriod) => {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const result = await request<Analytics>(`/seller/analytics?period=${period}`, {
        headers: { Authorization: `Bearer ${access}` },
      });
      setAnalytics(result);
    } catch (reason) {
      setAnalyticsError(reason instanceof Error ? reason.message : "Analitikani yuklab bo‘lmadi.");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!tokens) return;
    request<Seller>("/auth/me", { headers: { Authorization: `Bearer ${tokens.access_token}` } })
      .then(async (profile) => {
        if (profile.role !== "seller") throw new Error("Sotuvchi hisobi bilan kiring.");
        setSeller(profile);
        await loadProducts(tokens.access_token);
      })
      .catch(() => {
        setTokens(null);
        localStorage.removeItem("2cbazar_seller_tokens");
      });
  }, [tokens, loadProducts]);

  useEffect(() => {
    if (tokens && seller) void loadAnalytics(tokens.access_token, salesPeriod);
  }, [tokens, seller, salesPeriod, loadAnalytics]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await request<Tokens>("/auth/seller/login", {
        method: "POST", body: JSON.stringify({ username, password }),
      });
      localStorage.setItem("2cbazar_seller_tokens", JSON.stringify(result));
      setTokens(result);
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kirish amalga oshmadi.");
    } finally {
      setBusy(false);
    }
  };

  const register = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!codeSent) {
        await request("/auth/seller/request-code", {
          method: "POST", body: JSON.stringify({ email }),
        });
        setCodeSent(true);
        setNotice("Tasdiqlash kodi emailingizga yuborildi.");
      } else {
        const result = await request<Tokens>("/auth/seller/register", {
          method: "POST",
          body: JSON.stringify({ email, code, username, password }),
        });
        localStorage.setItem("2cbazar_seller_tokens", JSON.stringify(result));
        setTokens(result);
        setPassword("");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ro‘yxatdan o‘tish amalga oshmadi.");
    } finally {
      setBusy(false);
    }
  };

  const createProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!tokens) return;
    setBusy(true);
    setError("");
    try {
      let imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        const formData = new FormData();
        selectedImages.forEach((file) => formData.append("files", file));
        const uploaded = await request<{ image_urls: string[] }>("/seller/uploads", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          body: formData,
        });
        imageUrls = uploaded.image_urls;
      }
      await request<Product>("/seller/products", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        body: JSON.stringify({
          ...productForm,
          image_url: imageUrls[0] ?? null,
          image_urls: imageUrls,
          price: Number(productForm.price),
          stock: Number(productForm.stock),
        }),
      });
      setProductForm({ name: "", category: "Elektronika", description: "", price: "", stock: "1" });
      setSelectedImages([]);
      setShowProductForm(false);
      setNotice("Mahsulot do‘koningizga qo‘shildi.");
      await loadProducts(tokens.access_token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Mahsulot qo‘shilmadi.");
    } finally {
      setBusy(false);
    }
  };

  const selectProductImages = (files: FileList | null) => {
    if (!files) return;
    const images = Array.from(files);
    if (images.length > 3) {
      setError("Ko‘pi bilan 3 ta rasm tanlang.");
      return;
    }
    const invalidImage = images.find((file) =>
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      || file.size > 5 * 1024 * 1024,
    );
    if (invalidImage) {
      setError("Faqat JPEG, PNG yoki WebP formatidagi, 5 MB dan kichik rasmlarni tanlang.");
      return;
    }
    setError("");
    setSelectedImages(images);
  };

  const openProfile = () => {
    if (!seller) return;
    setProfileForm({
      full_name: seller.full_name ?? "",
      phone: seller.phone ?? "",
      gender: seller.gender ?? "",
      birth_date: seller.birth_date ?? "",
    });
    setProfileEditing(false);
    setProfileError("");
    setProfileOpen(true);
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!tokens) return;
    setProfileBusy(true);
    setProfileError("");
    try {
      const updated = await request<Seller>("/auth/me", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        body: JSON.stringify({
          full_name: profileForm.full_name || null,
          phone: profileForm.phone || null,
          gender: profileForm.gender || null,
          birth_date: profileForm.birth_date || null,
        }),
      });
      setSeller(updated);
      setProfileEditing(false);
      setNotice("Profil ma’lumotlari saqlandi.");
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "Profilni saqlab bo‘lmadi.");
    } finally {
      setProfileBusy(false);
    }
  };

  const logout = async () => {
    if (tokens) {
      try {
        await request("/auth/logout", {
          method: "POST", body: JSON.stringify({ refresh_token: tokens.refresh_token }),
        });
      } catch {
        setError("Serverdan chiqish tasdiqlanmadi; mahalliy sessiya tozalandi.");
      }
    }
    localStorage.removeItem("2cbazar_seller_tokens");
    setTokens(null);
    setSeller(null);
    setProducts([]);
  };

  if (!tokens || !seller) {
    return (
      <div className="auth-page">
        <div className="auth-decoration decor-left" /><div className="auth-decoration decor-right" />
        <a className="brand" href="https://2cnzrbk.uz"><span className="brand-mark">2c</span>bazar</a>
        <div className="auth-layout">
          <section className="auth-promo">
            <div className="eyebrow"><span /> 2cbazar sotuvchilar hamjamiyati</div>
            <h1>Biznesingiz<br />uchun <em>yangi<br />imkoniyatlar.</em></h1>
            <p>Mahsulotlaringizni minglab xaridorlarga taniting. Do‘koningizni boshqarish endi yanada oson.</p>
            <div className="promo-stats"><div><b>24/7</b><small>do‘koningiz ochiq</small></div><i /><div><b>Oson</b><small>mahsulot boshqaruvi</small></div></div>
            <div className="promo-orbit"><div className="orbit-center">2c</div><div className="orbit-tag">Yangi<br />xaridorlar ↗</div><div className="orbit-tag tag-bottom">O‘z do‘koningiz<br />o‘z qoidalaringiz</div></div>
          </section>
          <section className="auth-card">
            <div className="auth-tabs"><button className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setError(""); }}>Kirish</button><button className={mode === "register" ? "selected" : ""} onClick={() => { setMode("register"); setError(""); }}>Ro‘yxatdan o‘tish</button></div>
            <h2>{mode === "login" ? "Sotuvchi kabinetiga kirish" : codeSent ? "Emailni tasdiqlang" : "O‘z do‘koningizni oching"}</h2>
            <p className="auth-subtitle">{mode === "login" ? "Username va parolingizni kiriting." : codeSent ? `${email} manziliga yuborilgan kodni va hisob ma’lumotlarini kiriting.` : "Email manzilingiz bilan boshlang — bir necha daqiqada tayyor."}</p>
            <form onSubmit={(event) => void (mode === "login" ? login(event) : register(event))}>
              {mode === "login" ? <>
                <label>Username<div className="input-wrap"><span>@</span><input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" /></div></label>
                <label>Parol<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Kamida 10 belgi" /></label>
              </> : <>
                {!codeSent ? <label>Email manzili<input type="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="siz@example.com" /> </label> :
                  <>
                    <label>Email tasdiqlash kodi<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} placeholder="000000" /></label>
                    <label>Username<div className="input-wrap"><span>@</span><input required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_]+" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="shop_username" /></div></label>
                    <label>Yangi parol<input type="password" required minLength={10} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Kamida 10 belgi" /></label>
                  </>}
              </>}
              {error && <div className="form-error">{error}</div>}
              <button className="submit-button" disabled={busy}>{busy ? "Kuting..." : mode === "login" ? "Kabinetga kirish →" : codeSent ? "Tasdiqlash va do‘kon ochish →" : "Emailga kod yuborish →"}</button>
            </form>
            {mode === "register" && codeSent && <button className="resend" onClick={() => { setCodeSent(false); setCode(""); }}>Boshqa email kiritish</button>}
            <div className="auth-help">Savollaringiz bormi? <a href="mailto:help@2cnzrbk.uz">Biz bilan bog‘laning</a></div>
            <a className="back-market" href="https://2cnzrbk.uz">← 2cbazar xaridorlar saytiga qaytish</a>
          </section>
        </div>
        {notice && <div className="toast">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      </div>
    );
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <a className="brand sidebar-brand" href="#"><span className="brand-mark">2c</span>bazar</a>
        <div className="side-label">DO‘KON BOSHQARUVI</div>
        <a className="side-link active" href="#overview"><span>▦</span> Umumiy ko‘rinish</a>
        <a className="side-link" href="#analytics"><span>⌁</span> Analitika</a>
        <a className="side-link" href="#products"><span>◇</span> Mahsulotlar <small>{products.length}</small></a>
        <button className="side-link" onClick={() => setNotice("Buyurtmalar bo‘limi keyingi bosqichda yoqiladi.")}><span>▤</span> Buyurtmalar</button>
        <div className="sidebar-bottom"><a className="side-link" href="https://2cnzrbk.uz"><span>↗</span> Marketplace</a><button className="side-link" onClick={() => void logout()}><span>⇥</span> Chiqish</button></div>
      </aside>
      <main className="dashboard-main">
        <header className="dash-header"><div><span className="breadcrumb">Do‘kon /</span> Umumiy ko‘rinish</div><div className="profile-chip"><div className="avatar">{(seller.full_name || seller.username).slice(0, 1).toUpperCase()}</div><div><b>{seller.full_name || seller.username}</b><small>{seller.email}</small></div><button onClick={openProfile} title="Profilni tahrirlash">⌄</button></div></header>
        <div className="dash-content" id="overview">
          <div className="welcome-row"><div><div className="eyebrow"><span /> SOTUVCHI KABINETI</div><h1>Xush kelibsiz, {seller.username}!</h1><p>Do‘koningizning bugungi holati va mahsulotlarini boshqaring.</p></div><button className="add-button" onClick={() => setShowProductForm(true)}>＋ Mahsulot qo‘shish</button></div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-top"><span>Jami mahsulotlar</span><i>◇</i></div><strong>{products.length}</strong><small>do‘koningiz katalogida</small></div>
            <div className="stat-card"><div className="stat-top"><span>Ombordagi birliklar</span><i>▤</i></div><strong>{products.reduce((sum, product) => sum + product.stock, 0)}</strong><small>mavjud mahsulotlar</small></div>
            <div className="stat-card"><div className="stat-top"><span>Do‘kon holati</span><i>◉</i></div><strong className="active-status">Faol</strong><small>mahsulotlaringiz ko‘rinmoqda</small></div>
          </div>
          <section className="analytics-panel" id="analytics">
            <div className="analytics-heading">
              <div><div className="eyebrow"><span /> SAVDO HISOBOTI</div><h2>Do‘kon analitikasi</h2><p>{analytics?.start_date} — {analytics?.end_date} · oldingi davr bilan taqqoslash</p></div>
              <div className="period-switch" role="group" aria-label="Analitika davri">
                <button className={salesPeriod === "weekly" ? "selected" : ""} onClick={() => setSalesPeriod("weekly")}>Haftalik</button>
                <button className={salesPeriod === "monthly" ? "selected" : ""} onClick={() => setSalesPeriod("monthly")}>Oylik</button>
              </div>
            </div>
            {analyticsError && <div className="analytics-error">{analyticsError}<button onClick={() => tokens && void loadAnalytics(tokens.access_token, salesPeriod)}>Qayta urinish</button></div>}
            <div className={`analytics-metrics ${analyticsLoading ? "loading" : ""}`}>
              <article className="analytics-metric"><div><span>Jami tushum</span><i>↗</i></div><strong>{analytics ? formatPrice(analytics.revenue) : "—"}</strong><small><b className={Number(analytics?.revenue ?? 0) >= Number(analytics?.previous_revenue ?? 0) ? "change-up" : "change-down"}>{analytics ? periodChange(Number(analytics.revenue), Number(analytics.previous_revenue)) : "—"}</b> oldingi davrga nisbatan</small></article>
              <article className="analytics-metric"><div><span>Buyurtmalar</span><i>▤</i></div><strong>{analytics?.orders ?? "—"}</strong><small><b className={(analytics?.orders ?? 0) >= (analytics?.previous_orders ?? 0) ? "change-up" : "change-down"}>{analytics ? periodChange(analytics.orders, analytics.previous_orders) : "—"}</b> oldingi davrga nisbatan</small></article>
              <article className="analytics-metric"><div><span>Sotilgan mahsulot</span><i>◇</i></div><strong>{analytics?.units_sold ?? "—"} <em>dona</em></strong><small><b className={(analytics?.units_sold ?? 0) >= (analytics?.previous_units_sold ?? 0) ? "change-up" : "change-down"}>{analytics ? periodChange(analytics.units_sold, analytics.previous_units_sold) : "—"}</b> oldingi davrga nisbatan</small></article>
            </div>
            <div className="analytics-details">
              <section className="sales-chart">
                <div className="chart-heading"><div><h3>Tushum dinamikasi</h3><p>{salesPeriod === "weekly" ? "Oxirgi 7 kun" : "Oxirgi 30 kun"}</p></div><span>{analytics ? formatPrice(analytics.revenue) : "—"}</span></div>
                {analytics && analytics.daily.length > 0 ? <div className={`chart-bars ${salesPeriod}`}>
                  {analytics.daily.map((day) => {
                    const value = Number(day.revenue);
                    const peak = Math.max(...analytics.daily.map((point) => Number(point.revenue)));
                    const height = peak > 0 ? Math.max((value / peak) * 100, value > 0 ? 5 : 0) : 0;
                    const date = new Date(`${day.date}T00:00:00`);
                    const label = salesPeriod === "weekly" ? date.toLocaleDateString("uz-UZ", { weekday: "short" }) : date.toLocaleDateString("uz-UZ", { day: "numeric" });
                    return <div className="chart-column" key={day.date} title={`${day.date}: ${formatPrice(value)} · ${day.orders} buyurtma`}><div className="chart-track"><span style={{ height: `${height}%` }} /></div><small>{salesPeriod === "monthly" && date.getDate() % 5 !== 1 ? "" : label}</small></div>;
                  })}
                </div> : <div className="chart-empty">{analyticsLoading ? "Hisobot yuklanmoqda..." : "Bu davrda savdo ma’lumotlari yo‘q"}</div>}
              </section>
              <section className="top-products">
                <div className="chart-heading"><div><h3>Ko‘p sotilganlar</h3><p>Tanlangan davr bo‘yicha</p></div></div>
                {analytics?.top_products.length ? <div className="top-product-list">{analytics.top_products.map((item, index) => <div className="top-product-row" key={item.product_id}><span className="product-rank">{String(index + 1).padStart(2, "0")}</span><div className="top-product-name"><b>{item.name}</b><small>{item.units_sold} dona sotildi</small></div><strong>{formatPrice(item.revenue)}</strong></div>)}</div> : <div className="top-products-empty">{analyticsLoading ? "Yuklanmoqda..." : "Hozircha sotuvlar yo‘q"}</div>}
              </section>
            </div>
          </section>
          <section className="products-panel" id="products">
            <div className="panel-heading"><div><h2>Mahsulotlaringiz</h2><p>Katalogingizdagi barcha mahsulotlar</p></div><button onClick={() => setShowProductForm(true)}>＋ Yangi mahsulot</button></div>
            {products.length === 0 ? <div className="product-empty"><div>◇</div><h3>Hali mahsulot qo‘shmadingiz</h3><p>Birinchi mahsulotingizni joylang — xaridorlar uni marketplace’da ko‘rishadi.</p><button className="add-button" onClick={() => setShowProductForm(true)}>Birinchi mahsulotni qo‘shish</button></div> :
              <div className="table-scroll"><table><thead><tr><th>MAHSULOT</th><th>KATEGORIYA</th><th>NARXI</th><th>OMBOR</th><th>HOLATI</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="table-product"><div className="table-image">{(product.image_urls?.[0] ?? product.image_url) ? <img src={product.image_urls?.[0] ?? product.image_url ?? undefined} alt="" /> : "2c"}</div><div><b>{product.name}</b><small>#{String(product.id).padStart(5, "0")}{product.image_urls?.length > 1 ? ` · ${product.image_urls.length} ta rasm` : ""}</small></div></div></td><td>{product.category}</td><td><b>{Number(product.price).toLocaleString("uz-UZ")} so‘m</b></td><td>{product.stock} ta</td><td><span className={`status-pill ${product.stock ? "in-stock" : "out-stock"}`}>{product.stock ? "Sotuvda" : "Tugagan"}</span></td></tr>)}</tbody></table></div>}
          </section>
          <div className="tip-banner"><span>✦</span><div><b>Maslahat</b><p>Mahsulotlaringizga sifatli rasm va batafsil tavsif qo‘shing — xaridorlar ko‘proq ishonch bildiradi.</p></div><button onClick={() => setShowProductForm(true)}>Mahsulot qo‘shish ↗</button></div>
        </div>
      </main>
      {profileOpen && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}>
        <section className="seller-profile-modal">
          <div className="product-modal-head"><div><span className="eyebrow"><span /> SHAXSIY KABINET</span><h2>Profilim</h2><p>Shaxsiy ma’lumotlaringizni ko‘ring va yangilang.</p></div><button className="close-button" aria-label="Yopish" onClick={() => setProfileOpen(false)}>×</button></div>
          {!profileEditing ? <>
            <div className="seller-profile-identity"><div className="avatar">{(seller.full_name || seller.username).slice(0, 1).toUpperCase()}</div><div><b>{seller.full_name || seller.username}</b><small>{seller.email}</small></div></div>
            <div className="seller-profile-details">
              <div><span>Ism-familiya</span><b>{seller.full_name || "Kiritilmagan"}</b></div>
              <div><span>Telefon raqam</span><b>{seller.phone || "Kiritilmagan"}</b></div>
              <div><span>Jinsi</span><b>{seller.gender === "male" ? "Erkak" : seller.gender === "female" ? "Ayol" : seller.gender === "prefer_not_to_say" ? "Ko‘rsatmaslik" : "Kiritilmagan"}</b></div>
              <div><span>Tug‘ilgan kuni</span><b>{seller.birth_date ? new Date(`${seller.birth_date}T00:00:00`).toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" }) : "Kiritilmagan"}</b></div>
              <div><span>Username</span><b>@{seller.username}</b></div>
              <div><span>Email</span><b>{seller.email}</b></div>
            </div>
            <button className="add-button seller-profile-edit" onClick={() => setProfileEditing(true)}>Profilni tahrirlash</button>
          </> : <form className="seller-profile-form" onSubmit={(event) => void saveProfile(event)}>
            <label>Ism-familiya<input autoComplete="name" minLength={2} maxLength={120} value={profileForm.full_name} onChange={(event) => setProfileForm({ ...profileForm, full_name: event.target.value })} placeholder="Ali Valiyev" /></label>
            <label>Telefon raqam<input type="tel" autoComplete="tel" maxLength={24} value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} placeholder="+998 90 123 45 67" /></label>
            <label>Jinsi<select value={profileForm.gender} onChange={(event) => setProfileForm({ ...profileForm, gender: event.target.value })}><option value="">Tanlanmagan</option><option value="male">Erkak</option><option value="female">Ayol</option><option value="prefer_not_to_say">Ko‘rsatmaslik</option></select></label>
            <label>Tug‘ilgan kuni<input type="date" max={new Date().toISOString().slice(0, 10)} value={profileForm.birth_date} onChange={(event) => setProfileForm({ ...profileForm, birth_date: event.target.value })} /></label>
            {profileError && <div className="form-error">{profileError}</div>}
            <div className="seller-profile-actions"><button type="button" className="cancel-button" onClick={() => { setProfileEditing(false); setProfileError(""); }}>Bekor qilish</button><button className="add-button" disabled={profileBusy}>{profileBusy ? "Saqlanmoqda..." : "Saqlash"}</button></div>
          </form>}
        </section>
      </div>}
      {showProductForm && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowProductForm(false); }}><form className="product-modal" onSubmit={(event) => void createProduct(event)}><div className="product-modal-head"><div><h2>Yangi mahsulot</h2><p>Mahsulotingiz ma’lumotlarini kiriting.</p></div><button type="button" className="close-button" onClick={() => setShowProductForm(false)}>×</button></div>
        <label>Mahsulot nomi<input required minLength={2} maxLength={180} value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="Masalan, simsiz quloqchin" /></label>
        <div className="form-row"><label>Kategoriya<select value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}>{["Elektronika", "Kiyim", "Uy-ro‘zg‘or", "Go‘zallik", "Bolalar", "Sport", "Oziq-ovqat", "Kitoblar", "Avto ehtiyot qismlar", "Boshqa"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Narxi (so‘m)<input type="number" min="1" step="0.01" required value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} placeholder="250000" /></label></div>
        <div className="form-row"><label>Ombordagi soni<input type="number" min="0" max="1000000" required value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} /></label><label className="image-picker">Mahsulot rasmlari <span className="optional">(1–3 ta, har biri 5 MB gacha)</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { selectProductImages(event.target.files); event.target.value = ""; }} /></label></div>
        {imagePreviews.length > 0 && <div className="image-preview-list">{imagePreviews.map((src, index) => <div className="image-preview" key={src}><img src={src} alt={`Mahsulot rasmi ${index + 1}`} /><button type="button" aria-label={`${index + 1}-rasmni olib tashlash`} onClick={() => setSelectedImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}</div>}
        <label>Tavsif <span className="optional">(ixtiyoriy)</span><textarea rows={3} maxLength={10000} value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} placeholder="Mahsulotingiz haqida qisqacha..." /></label>
        {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setShowProductForm(false)}>Bekor qilish</button><button className="add-button" disabled={busy}>{busy ? "Saqlanmoqda..." : "Mahsulotni saqlash →"}</button></div>
      </form></div>}
      {notice && <div className="toast">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      <FregeChat />
    </div>
  );
}
