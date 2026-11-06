import { FormEvent, useEffect, useState } from "react";

type Product = {
  id: number;
  seller_id: number;
  name: string;
  description: string;
  category: string;
  image_url: string | null;
  image_urls?: string[];
  price: string;
  stock: number;
  average_rating: number;
  review_count: number;
  seller_average_rating: number;
  seller_review_count: number;
};
type Tokens = { access_token: string; refresh_token: string };
type User = {
  id: number;
  email: string;
  username: string | null;
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
type OrderLine = {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: string;
};
type PurchaseOrder = {
  id: number;
  status: string;
  total: string;
  delivery_address: string;
  created_at: string;
  items: OrderLine[];
};
type Review = {
  id: number;
  product_id: number;
  product_name: string;
  rating: number;
  comment: string;
  author: string;
  seller_name: string | null;
  seller_reply: string | null;
  seller_reply_at: string | null;
  created_at: string;
};
type ReviewTarget = { id: number; name: string };
type FregeEmbed = {
  setApiKey(apiKey: string): void;
  mount(options: {
    el: string;
    app: string;
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
  const [isOpen, setIsOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || initialized) return;

    const apiKey = import.meta.env.VITE_FREGE_MARKETPLACE_API_KEY;
    if (!apiKey) {
      setError("Chat sozlanmagan. Root .env fayliga VITE_FREGE_MARKETPLACE_API_KEY kalitini kiriting.");
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
          app: "frege_app_6972c7f8e3409dca72011ec50be369e10f9a08cc0b45484964cb1a9a378a5f11",
          project: "01a198a1-47c5-7714-b37b-8c1a4f39a431",
          stage: "live",
          agent: "01a1aac0-7d1a-78f0-a15b-81ba5e87d88b",
        });
        setInitialized(true);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Frege chatni yuklab bo‘lmadi.");
        }
      });

    return () => {
      active = false;
    };
  }, [initialized, isOpen]);

  return (
    <div className="frege-chat-widget">
      <section
        className="frege-chat-panel"
        aria-label="Xaridorlar uchun yordam chati"
        hidden={!isOpen}
      >
        <div className="frege-chat-heading">
          <strong>Yordam chati</strong>
          <button type="button" onClick={() => setIsOpen(false)} aria-label="Chatni yopish">×</button>
        </div>
        <div id="frege-chat" className="frege-chat">
          {error && <div className="frege-chat-error" role="status">{error}</div>}
        </div>
      </section>
      <button
        type="button"
        className="frege-chat-toggle"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Chatni yopish" : "Yordam chatini ochish"}
      >
        {isOpen ? "×" : "Yordam"}
      </button>
    </div>
  );
}

const API = "/api";
const defaultCategories = [
  "Elektronika", "Kiyim", "Uy-ro‘zg‘or", "Go‘zallik", "Bolalar", "Sport",
  "Oziq-ovqat", "Kitoblar", "Avto ehtiyot qismlar",
];
const categoryImages: Record<string, string> = {
  elektronika: "photo-1511707171634-5f897ff02aa9",
  kiyim: "photo-1483985988355-763728e1935b",
  "uy-ro‘zg‘or": "photo-1555041469-a586c61ea9bc",
  "go‘zallik": "photo-1608248543803-ba4f8c70ae0b",
  bolalar: "photo-1503919005314-30d93d07d823",
  sport: "photo-1461896836934-ffe607ba8211",
  yugurish: "photo-1461896836934-ffe607ba8211",
  kundalik: "photo-1441986300917-64674bd600d8",
  basketbol: "photo-1519861531473-9200262188bf",
  "mashg‘ulot": "photo-1517836357463-d25dfeac3438",
  krossovkalar: "photo-1542291026-7eec264c27ff",
  slaydlar: "photo-1608231387042-66d1773070a5",
  botinkalar: "photo-1543163521-1bf539c55dd2",
  "oziq-ovqat": "photo-1542838132-92c53300491e",
  kitoblar: "photo-1544947950-fa07a98d237f",
  "avto ehtiyot qismlar": "photo-1486262715619-67b85e0b08d3",
};
const defaultCategoryImage = "photo-1441986300917-64674bd600d8";
const categoryImage = (name: string) =>
  categoryImages[name.toLocaleLowerCase()] ?? defaultCategoryImage;
const defaultHeroImage = "photo-1607082349566-187342175e2f";
const photoUrl = (id: string, width: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
const formatPrice = (price: string | number) =>
  `${Number(price).toLocaleString("uz-UZ")} so‘m`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  let response = await fetch(`${API}${path}`, { ...init, headers });
  if (response.status === 401 && headers.has("Authorization") && path !== "/auth/refresh") {
    const saved = localStorage.getItem("2cbazar_tokens");
    if (saved) {
      try {
        const current = JSON.parse(saved) as Tokens;
        const refreshed = await fetch(`${API}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: current.refresh_token }),
        });
        if (refreshed.ok) {
          const next = await refreshed.json() as Tokens;
          localStorage.setItem("2cbazar_tokens", JSON.stringify(next));
          headers.set("Authorization", `Bearer ${next.access_token}`);
          response = await fetch(`${API}${path}`, { ...init, headers });
        } else {
          localStorage.removeItem("2cbazar_tokens");
        }
      } catch {
        localStorage.removeItem("2cbazar_tokens");
      }
    }
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? "So‘rov bajarilmadi. Qayta urinib ko‘ring.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productImageIndexes, setProductImageIndexes] = useState<Record<number, number>>({});
  const [catalogCategories, setCatalogCategories] = useState(defaultCategories);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Barchasi");
  const [categorySidebarOpen, setCategorySidebarOpen] = useState(false);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewTarget[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewsForProduct, setReviewsForProduct] = useState<Product | null>(null);
  const [productReviews, setProductReviews] = useState<Review[]>([]);
  const [tokens, setTokens] = useState<Tokens | null>(() => {
    const saved = localStorage.getItem("2cbazar_tokens");
    return saved ? JSON.parse(saved) as Tokens : null;
  });
  const [user, setUser] = useState<User | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    full_name: "",
    phone: "",
    gender: "",
    birth_date: "",
  });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [address, setAddress] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (category !== "Barchasi") params.set("category", category);
      setProducts(await request<Product[]>(`/products?${params}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Mahsulotlarni yuklab bo‘lmadi.");
    }
  };

  useEffect(() => { void loadProducts(); }, [search, category]);

  useEffect(() => {
    request<string[]>("/categories")
      .then((available) => {
        setCatalogCategories([...new Set([...defaultCategories, ...available])]);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Kategoriyalarni yuklab bo‘lmadi.");
      });
  }, []);

  useEffect(() => {
    if (!categorySidebarOpen && !accountOpen && !reviewTarget && !reviewsForProduct && !profileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCategorySidebarOpen(false);
        setAccountOpen(false);
        setReviewTarget(null);
        setReviewsForProduct(null);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [categorySidebarOpen, accountOpen, reviewTarget, reviewsForProduct, profileOpen]);

  useEffect(() => {
    if (!tokens) return;
    request<User>("/auth/me", { headers: { Authorization: `Bearer ${tokens.access_token}` } })
      .then(async (profile) => {
        setUser(profile);
        if (profile.role === "buyer") {
          const headers = { Authorization: `Bearer ${tokens.access_token}` };
          const [purchaseHistory, reviews] = await Promise.all([
            request<PurchaseOrder[]>("/orders", { headers }),
            request<Review[]>("/reviews/mine", { headers }),
          ]);
          setOrders(purchaseHistory);
          setMyReviews(reviews);
        }
      })
      .catch(() => {
        setUser(null);
        setOrders([]);
        setMyReviews([]);
        setTokens(null);
        localStorage.removeItem("2cbazar_tokens");
      });
  }, [tokens]);

  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const selectedCategoryImage = category === "Barchasi"
    ? defaultHeroImage
    : categoryImage(category);
  const cartTotal = products.reduce(
    (total, product) => total + Number(product.price) * (cart[product.id] ?? 0),
    0,
  );

  const saveTokens = (value: Tokens) => {
    setTokens(value);
    localStorage.setItem("2cbazar_tokens", JSON.stringify(value));
  };

  const openProfile = () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setProfileForm({
      full_name: user.full_name ?? "",
      phone: user.phone ?? "",
      gender: user.gender ?? "",
      birth_date: user.birth_date ?? "",
    });
    setProfileEditing(false);
    setProfileError("");
    setProfileOpen(true);
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!tokens) return;
    setProfileSaving(true);
    setProfileError("");
    try {
      const updated = await request<User>("/auth/me", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        body: JSON.stringify({
          full_name: profileForm.full_name || null,
          phone: profileForm.phone || null,
          gender: profileForm.gender || null,
          birth_date: profileForm.birth_date || null,
        }),
      });
      setUser(updated);
      setProfileEditing(false);
      setNotice("Profil ma’lumotlari saqlandi.");
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "Profilni saqlab bo‘lmadi.");
    } finally {
      setProfileSaving(false);
    }
  };

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!codeSent) {
        await request("/auth/marketplace/request-code", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        setCodeSent(true);
        setNotice("Tasdiqlash kodi emailingizga yuborildi.");
      } else {
        const result = await request<Tokens>("/auth/marketplace/verify", {
          method: "POST",
          body: JSON.stringify({ email, code }),
        });
        saveTokens(result);
        setAuthOpen(false);
        setNotice("Hisobingizga muvaffaqiyatli kirdingiz.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kirish amalga oshmadi.");
    } finally {
      setBusy(false);
    }
  };

  const placeOrder = async () => {
    if (!tokens) {
      setCartOpen(false);
      setAuthOpen(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const purchasedOrder = await request<PurchaseOrder>("/orders", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        body: JSON.stringify({
          delivery_address: address,
          items: Object.entries(cart).map(([product_id, quantity]) => ({
            product_id: Number(product_id), quantity,
          })),
        }),
      });
      setOrders((current) => [purchasedOrder, ...current]);
      setCart({});
      setAddress("");
      setCartOpen(false);
      const previouslyReviewed = new Set(myReviews.map((review) => review.product_id));
      const boughtProducts = purchasedOrder.items
        .filter((item, index, items) =>
          !previouslyReviewed.has(item.product_id)
          && items.findIndex((entry) => entry.product_id === item.product_id) === index)
        .map((item) => ({ id: item.product_id, name: item.product_name }));
      setReviewQueue(boughtProducts.slice(1));
      setReviewTarget(boughtProducts[0] ?? null);
      setReviewRating(5);
      setReviewComment("");
      setNotice("Buyurtma qabul qilindi. Xaridingiz haqida fikr qoldiring.");
      await loadProducts();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Buyurtma yaratilmadi.");
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!tokens || !reviewTarget) {
      setAuthOpen(true);
      return;
    }
    setReviewBusy(true);
    setError("");
    try {
      const review = await request<Review>("/reviews", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        body: JSON.stringify({
          product_id: reviewTarget.id,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      setMyReviews((current) => [review, ...current]);
      setProducts((current) => current.map((product) =>
        product.id === review.product_id
          ? {
            ...product,
            average_rating: (
              product.average_rating * product.review_count + review.rating
            ) / (product.review_count + 1),
            review_count: product.review_count + 1,
          }
          : product));
      const [nextTarget, ...remaining] = reviewQueue;
      setReviewQueue(remaining);
      setReviewTarget(nextTarget ?? null);
      setReviewRating(5);
      setReviewComment("");
      if (!nextTarget) setNotice("Fikringiz uchun rahmat!");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Fikrni yuborib bo‘lmadi.");
    } finally {
      setReviewBusy(false);
    }
  };

  const showProductReviews = async (product: Product) => {
    setError("");
    try {
      setProductReviews(await request<Review[]>(`/products/${product.id}/reviews`));
      setReviewsForProduct(product);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Fikrlarni yuklab bo‘lmadi.");
    }
  };

  return (
    <div className="app-shell">
      <div className="topline">Yetkazib berish qulayligi — 2cbazar bilan xarid qiling</div>
      <header className="header">
        <a className="brand" href="/" aria-label="2cbazar bosh sahifa"><span className="brand-mark">2c</span>bazar</a>
        <nav className="site-nav" aria-label="Asosiy menyu">
          <a className="nav-active" href="/">Bosh sahifa</a>
          <button className="category-menu-button" onClick={() => setCategorySidebarOpen(true)} aria-expanded={categorySidebarOpen}>
            <span>☰</span> Kategoriyalar
          </button>
          <a href="#collections">Kolleksiyalar</a>
          <a className="nav-sale" href="#catalog">Yangilar</a>
        </nav>
        <form className="searchbox" role="search" onSubmit={(event) => { event.preventDefault(); void loadProducts(); document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" }); }}>
          <span aria-hidden="true">⌕</span>
          <input aria-label="Mahsulotlarni qidirish" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mahsulot qidirish..." />
          {search && <button className="clear-search" type="button" aria-label="Qidiruvni tozalash" onClick={() => setSearch("")}>×</button>}
          <button className="search-submit" type="submit" aria-label="Qidirish">⌕</button>
        </form>
        <div className="header-actions">
          <button className="text-button" onClick={openProfile}>
            <span>♙</span><span>{user ? "Profilim" : "Kirish"}</span>
          </button>
          {user?.role === "buyer" && <button className="text-button purchases-button" aria-label="Xaridlarim" title="Xaridlarim" onClick={() => setAccountOpen(true)}>
            <span>▤</span><span>Xaridlarim</span>
          </button>}
          <button className="text-button cart-button" onClick={() => setCartOpen(true)}>
            <span>▣</span><span>Savat</span>{cartCount > 0 && <b>{cartCount}</b>}
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-art" aria-hidden="true">
            <img className="hero-photo" src={photoUrl(selectedCategoryImage, 1800)} alt="" />
          </div>
          <div className="hero-copy">
            <div className="eyebrow"><span /> {category === "Barchasi" ? "2cbazar · o‘zingizga keraklisini toping" : `2cbazar · ${category}`}</div>
            <h1>{category === "Barchasi" ? <>Yaxshi tanlovlar.<br /><em>Yaxshi narxlar.</em></> : <>{category} uchun<br /><em>yangi tanlovlar.</em></>}</h1>
            <p>{category === "Barchasi" ? "Kundalik kerakli mahsulotlar, sevimli brendlar va yangi kashfiyotlar — barchasi bir joyda." : `${category} kategoriyasidagi mahsulotlar va yangi topilmalarni 2cbazar’da ko‘ring.`}</p>
            <div className="hero-actions">
              <a className="primary-button" href="#catalog">Xarid qilish <span>↗</span></a>
              <button className="secondary-button" onClick={() => setCategorySidebarOpen(true)}>Kategoriyalar</button>
            </div>
          </div>
          <div className="hero-caption"><span>{category === "Barchasi" ? "2CBAZAR TANLOVI" : "KATEGORIYA"}</span><b>{category === "Barchasi" ? "Sevimli topilmalar" : category}</b><small>{category === "Barchasi" ? "O‘zingizga keraklisini toping" : "Tanlangan mahsulotlar"}</small></div>
          <div className="hero-pagination"><i className="selected" /><i /><i /><span>01 / 03</span></div>
        </section>

        <section className="brand-strip" aria-label="Kolleksiyalar">
          <b className="strip-label">2CBAZAR</b>
          <a href="#catalog">ISHONCHLI SOTUVCHILAR</a>
          <a href="#catalog">KUNDALIK TOPILMALAR</a>
          <a href="#catalog">YANGI MAHSULOTLAR</a>
          <a href="#catalog">QULAY XARID</a>
          <a className="view-all" href="#catalog">Barchasini ko‘rish ↗</a>
        </section>

        <section className="catalog" id="catalog">
          <div className="section-heading">
            <div><div className="eyebrow"><span /> 2cbazar tanlovi</div><h2>{category === "Barchasi" ? "Ommabop mahsulotlar" : category}</h2></div>
            <a className="view-all" href="#catalog">Barchasini ko‘rish ↗</a>
          </div>
          {error && <div className="alert error-alert">{error}<button onClick={() => setError("")}>×</button></div>}
          {products.length === 0 ? (
            <div className="empty-state"><div>✳</div><h3>{search.trim() ? "Mahsulot topilmadi" : category === "Barchasi" ? "Mahsulotlar tayyorlanmoqda" : `${category} bo‘limida mahsulot hozircha yo‘q`}</h3><p>{search.trim() ? `“${search.trim()}” bo‘yicha mos mahsulot chiqmadi. Boshqa so‘z bilan qidiring.` : category === "Barchasi" ? "Sotuvchilar yangi mahsulot qo‘shishi bilan ularni shu yerda ko‘rasiz." : "Boshqa kategoriyani tanlang yoki keyinroq qayta tekshiring."}</p>{search.trim() ? <button className="empty-reset" onClick={() => setSearch("")}>Qidiruvni tozalash</button> : category !== "Barchasi" ? <button className="empty-reset" onClick={() => setCategory("Barchasi")}>Barcha mahsulotlarni ko‘rish</button> : <a href="http://localhost:5174">Sotuvchi bo‘lish ↗</a>}</div>
          ) : (
            <div className="product-grid">
              {products.map((product) => (
                <article className="product-card" key={product.id}>
                  <div className="product-image">
                    <img
                      src={(product.image_urls?.length ? product.image_urls : [product.image_url]).filter((image): image is string => Boolean(image))[productImageIndexes[product.id] ?? 0] ?? photoUrl(categoryImage(product.category), 640)}
                      alt={product.name}
                    />
                    {(product.image_urls?.length ?? 0) > 1 && <>
                      <button className="product-image-nav previous" aria-label="Oldingi mahsulot rasmi" onClick={() => setProductImageIndexes((current) => ({ ...current, [product.id]: ((current[product.id] ?? 0) + product.image_urls!.length - 1) % product.image_urls!.length }))}>‹</button>
                      <button className="product-image-nav next" aria-label="Keyingi mahsulot rasmi" onClick={() => setProductImageIndexes((current) => ({ ...current, [product.id]: ((current[product.id] ?? 0) + 1) % product.image_urls!.length }))}>›</button>
                      <span className="product-image-count">{(productImageIndexes[product.id] ?? 0) + 1}/{product.image_urls!.length}</span>
                    </>}
                    <span className="product-tag">{product.category}</span>
                    <button className="favorite-button" aria-label="Sevimlilarga qo‘shish">♡</button>
                  </div>
                  <div className="product-info">
                    <button className="rating review-summary" onClick={() => void showProductReviews(product)} aria-label={`${product.name} fikrlarini ko‘rish`}>
                      ★ <b>{product.review_count ? product.average_rating.toFixed(1) : "—"}</b>
                      <small>({product.review_count} fikr)</small>
                    </button>
                    <h3>{product.name}</h3>
                    <p className="product-description">{product.description || "Sifatli mahsulot — kundalik foydalanish uchun."}</p>
                    <button className="product-details-button" onClick={() => void showProductReviews(product)}>Tafsilotlar va sharhlar ↗</button>
                    <div className="product-bottom"><strong>{formatPrice(product.price)}</strong>
                      <button aria-label={`${product.name} savatga qo‘shish`} onClick={() => setCart((current) => ({ ...current, [product.id]: Math.min((current[product.id] ?? 0) + 1, product.stock) }))}>+</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="sale-banner" id="collections">
          <div className="sale-copy"><span>2CBAZAR · YANGI TOPILMALAR</span><h2>Har bir kun uchun<br />yaxshi tanlov.</h2><p>Turli kategoriyalar, sevimli mahsulotlar — barchasi bir joyda.</p><button onClick={() => setCategorySidebarOpen(true)}>Kategoriyalarni ko‘rish <b>→</b></button></div>
          <img src={photoUrl("photo-1607082349566-187342175e2f", 1100)} alt="2cbazar’da xarid qilish" loading="lazy" />
          <div className="sale-mark">2C<span>BAZAR</span></div>
        </section>
        <section className="service-strip" aria-label="Xarid afzalliklari">
          <div><span>⌕</span><p><b>Oson qidiruv</b><small>Kerakli mahsulotni toping</small></p></div>
          <div><span>▤</span><p><b>Keng tanlov</b><small>Bir nechta kategoriyalar</small></p></div>
          <div><span>♡</span><p><b>Sevimlilarni tanlang</b><small>O‘zingizga mos mahsulotlar</small></p></div>
          <div><span>▣</span><p><b>Qulay buyurtma</b><small>Buyurtmangizni kuzating</small></p></div>
        </section>
      </main>

      <footer className="site-footer" id="footer">
        <div className="footer-main">
          <div className="footer-about"><a className="brand footer-brand" href="/"><span className="brand-mark">2c</span>bazar</a><p>Kundalik xaridlaringiz uchun mahsulotlar va kategoriyalar — qulay onlayn bozorda.</p><div className="social-links"><a href="#footer">ig</a><a href="#footer">f</a><a href="#footer">▶</a><a href="#footer">t</a></div></div>
          <div><b>XARID</b><a href="#catalog">Yangi kelganlar</a><a href="#catalog">Erkaklar</a><a href="#catalog">Ayollar</a><a href="#catalog">Bolalar</a><a href="#catalog">Chegirmalar</a></div>
          <div><b>YORDAM</b><a href="#footer">Bog‘lanish</a><a href="#footer">Yetkazib berish</a><a href="#footer">Qaytarish</a><a href="#footer">FAQ</a><a href="#footer">O‘lchamlar</a></div>
          <div><b>2CBAZAR</b><a href="#footer">Biz haqimizda</a><a href="https://seller.2cnzrbk.uz">Sotuvchi bo‘lish</a><a href="#footer">Hamkorlik</a><a href="#footer">Yangiliklar</a><a href="#footer">Aloqa</a></div>
          <div className="newsletter"><b>YANGILIKLAR</b><p>Yangi kolleksiya va maxsus takliflardan xabardor bo‘ling.</p><form onSubmit={(event) => { event.preventDefault(); setNotice("Yangiliklarga obuna xizmati tez orada ishga tushadi."); }}><input aria-label="Email manzilingiz" type="email" placeholder="Email manzilingiz" required /><button aria-label="Obuna bo‘lish">→</button></form></div>
        </div>
        <div className="footer-bottom"><span>© 2026 2cbazar. Barcha huquqlar himoyalangan.</span><div><a href="#footer">Foydalanish shartlari</a><a href="#footer">Maxfiylik siyosati</a></div><span>O‘zbekiston · UZS</span></div>
      </footer>

      {profileOpen && user && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}>
        <section className="profile-modal">
          <div className="purchase-modal-heading">
            <div><span className="eyebrow"><span /> SHAXSIY KABINET</span><h2>Profilim</h2><p>Shaxsiy ma’lumotlaringizni ko‘ring va yangilang.</p></div>
            <button className="close-button" aria-label="Yopish" onClick={() => setProfileOpen(false)}>×</button>
          </div>
          {!profileEditing ? <>
            <div className="profile-identity"><span className="profile-avatar">{(user.full_name || user.username || user.email).slice(0, 1).toLocaleUpperCase()}</span><div><b>{user.full_name || user.username || "Yangi xaridor"}</b><small>{user.email}</small></div></div>
            <div className="profile-details">
              <div><span>Ism-familiya</span><b>{user.full_name || "Kiritilmagan"}</b></div>
              <div><span>Telefon raqam</span><b>{user.phone || "Kiritilmagan"}</b></div>
              <div><span>Jinsi</span><b>{user.gender === "male" ? "Erkak" : user.gender === "female" ? "Ayol" : user.gender === "prefer_not_to_say" ? "Ko‘rsatmaslik" : "Kiritilmagan"}</b></div>
              <div><span>Tug‘ilgan kuni</span><b>{user.birth_date ? new Date(`${user.birth_date}T00:00:00`).toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" }) : "Kiritilmagan"}</b></div>
              <div><span>Email</span><b>{user.email}</b></div>
            </div>
            <button className="primary-button profile-edit-button" onClick={() => setProfileEditing(true)}>Profilni tahrirlash <span>↗</span></button>
          </> : <form className="profile-form" onSubmit={(event) => void saveProfile(event)}>
            <label>Ism-familiya<input autoComplete="name" minLength={2} maxLength={120} value={profileForm.full_name} onChange={(event) => setProfileForm({ ...profileForm, full_name: event.target.value })} placeholder="Ali Valiyev" /></label>
            <label>Telefon raqam<input type="tel" autoComplete="tel" maxLength={24} value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} placeholder="+998 90 123 45 67" /></label>
            <label>Jinsi<select value={profileForm.gender} onChange={(event) => setProfileForm({ ...profileForm, gender: event.target.value })}><option value="">Tanlanmagan</option><option value="male">Erkak</option><option value="female">Ayol</option><option value="prefer_not_to_say">Ko‘rsatmaslik</option></select></label>
            <label>Tug‘ilgan kuni<input type="date" max={new Date().toISOString().slice(0, 10)} value={profileForm.birth_date} onChange={(event) => setProfileForm({ ...profileForm, birth_date: event.target.value })} /></label>
            <label>Email<input value={user.email} disabled /></label>
            {profileError && <div className="form-error">{profileError}</div>}
            <div className="profile-form-actions"><button type="button" className="profile-cancel" onClick={() => { setProfileEditing(false); setProfileError(""); }}>Bekor qilish</button><button className="primary-button" disabled={profileSaving}>{profileSaving ? "Saqlanmoqda..." : "Saqlash"}</button></div>
          </form>}
        </section>
      </div>}

      {accountOpen && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setAccountOpen(false); }}>
        <section className="purchase-modal">
          <div className="purchase-modal-heading"><div><span className="eyebrow"><span /> XARIDLAR TARIXI</span><h2>Xaridlarim</h2><p>Xarid qilgan mahsulotlaringizga baho va fikr qoldiring.</p></div><button className="close-button" aria-label="Yopish" onClick={() => setAccountOpen(false)}>×</button></div>
          {orders.length === 0 ? <div className="purchase-empty"><span>▤</span><h3>Hali xaridlaringiz yo‘q</h3><p>Birinchi buyurtmangizdan keyin mahsulotga fikr bildirish imkoniyati shu yerda paydo bo‘ladi.</p><button className="primary-button" onClick={() => setAccountOpen(false)}>Xaridni davom ettirish</button></div> :
            <div className="purchase-list">{orders.map((order) => <article className="purchase-order" key={order.id}>
              <div className="purchase-order-header"><div><b>Buyurtma #{String(order.id).padStart(5, "0")}</b><small>{new Date(order.created_at).toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" })}</small></div><span className="purchase-status">{order.status === "new" ? "Qabul qilindi" : order.status}</span></div>
              {order.items.map((item) => {
                const hasReview = myReviews.some((review) => review.product_id === item.product_id);
                return <div className="purchased-item" key={`${order.id}-${item.product_id}`}>
                  <div className="purchased-item-info"><b>{item.product_name}</b><small>{item.quantity} dona · {formatPrice(item.unit_price)}</small></div>
                  {hasReview ? <span className="review-done">★ Fikr qoldirildi</span> :
                    <button className="review-action" onClick={() => {
                      const remaining = order.items
                        .filter((entry) => entry.product_id !== item.product_id && !myReviews.some((review) => review.product_id === entry.product_id))
                        .map((entry) => ({ id: entry.product_id, name: entry.product_name }));
                      setReviewQueue(remaining);
                      setReviewTarget({ id: item.product_id, name: item.product_name });
                      setReviewRating(5);
                      setReviewComment("");
                      setAccountOpen(false);
                    }}>Fikr yozish ↗</button>}
                </div>;
              })}
            </article>)}</div>}
        </section>
      </div>}

      {reviewTarget && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewTarget(null); }}>
        <form className="review-modal" onSubmit={(event) => void submitReview(event)}>
          <div className="review-modal-heading"><div className="review-product-mark">2c</div><button type="button" className="close-button" aria-label="Yopish" onClick={() => setReviewTarget(null)}>×</button></div>
          <span className="eyebrow"><span /> XARIDINGIZ HAQIDA</span>
          <h2>{reviewTarget.name}</h2>
          <p>Mahsulot sizga yoqdimi? Tajribangizni boshqa xaridorlar bilan bo‘lishing.</p>
          <div className="rating-picker" role="group" aria-label="Baho tanlang">
            {[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" aria-label={`${rating} yulduz`} aria-pressed={reviewRating === rating} className={rating <= reviewRating ? "selected" : ""} onClick={() => setReviewRating(rating)}>★</button>)}
          </div>
          <div className="rating-label">{reviewRating === 5 ? "A’lo" : reviewRating === 4 ? "Yaxshi" : reviewRating === 3 ? "O‘rtacha" : reviewRating === 2 ? "Yaxshi emas" : "Yoqmadi"}</div>
          <label className="review-comment-label">Fikringiz<textarea required minLength={3} maxLength={2000} rows={4} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Mahsulot haqida fikringizni yozing..." /></label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button modal-submit" disabled={reviewBusy}>{reviewBusy ? "Yuborilmoqda..." : "Fikrni yuborish"}</button>
          <small className="review-verified">✓ Faqat xarid qilgan mijozlar fikr qoldira oladi</small>
        </form>
      </div>}

      {reviewsForProduct && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewsForProduct(null); }}>
        <section className="public-reviews-modal">
          <div className="purchase-modal-heading"><div><span className="eyebrow"><span /> XARIDORLAR FIKRI</span><h2>{reviewsForProduct.name}</h2><p>Mahsulot haqida xaridorlar qoldirgan fikrlar.</p></div><button className="close-button" aria-label="Yopish" onClick={() => setReviewsForProduct(null)}>×</button></div>
          <div className="product-detail-summary">
            <div><b>{formatPrice(reviewsForProduct.price)}</b><span>{reviewsForProduct.category} · {reviewsForProduct.stock} ta mavjud</span></div>
            <div className="product-store-rating"><b>Do‘kon bahosi: ★ {reviewsForProduct.seller_review_count ? reviewsForProduct.seller_average_rating.toFixed(1) : "—"}</b><span>{reviewsForProduct.seller_review_count} ta xaridor bahosi</span></div>
            <p>{reviewsForProduct.description || "Mahsulot uchun batafsil tavsif kiritilmagan."}</p>
          </div>
          <div className="public-review-summary"><b>★ {reviewsForProduct.review_count ? reviewsForProduct.average_rating.toFixed(1) : "—"}</b><span>{reviewsForProduct.review_count} ta fikr</span></div>
          {productReviews.length === 0 ? <div className="purchase-empty compact"><span>☆</span><h3>Hali fikrlar yo‘q</h3><p>Bu mahsulotga birinchi bo‘lib fikr bildiring.</p></div> :
            <div className="public-review-list">{productReviews.map((review) => <article className="public-review" key={review.id}><div><b>{review.author}</b><span>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div><small>{new Date(review.created_at).toLocaleDateString("uz-UZ")}</small><p>{review.comment}</p>{review.seller_reply && <div className="seller-review-reply"><b>{review.seller_name || "Do‘kon"} javobi</b><p>{review.seller_reply}</p></div>}</article>)}</div>}
          <small className="review-verified">Fikr qoldirish uchun avval mahsulotni xarid qiling.</small>
        </section>
      </div>}

      {categorySidebarOpen && (
        <div
          className="category-drawer-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Mahsulot kategoriyalari"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCategorySidebarOpen(false);
          }}
        >
          <aside className="category-drawer">
            <div className="category-drawer-header">
              <div><span className="eyebrow"><span /> KATALOG</span><h2>Kategoriyalar</h2></div>
              <button className="close-button" aria-label="Yopish" onClick={() => setCategorySidebarOpen(false)}>×</button>
            </div>
            <button
              className={`drawer-category all-category ${category === "Barchasi" ? "selected" : ""}`}
              onClick={() => { setCategory("Barchasi"); setCategorySidebarOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              <span className="drawer-category-image all-category-image">2c</span>
              <span className="drawer-category-name"><b>Barcha mahsulotlar</b><small>2cbazar katalogi</small></span>
              <span className="drawer-category-arrow">→</span>
            </button>
            <div className="category-drawer-list">
              {catalogCategories.map((item) => (
                <button
                  className={`drawer-category ${category === item ? "selected" : ""}`}
                  key={item}
                  aria-pressed={category === item}
                  onClick={() => {
                    setCategory(item);
                    setCategorySidebarOpen(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <span className="drawer-category-image"><img src={photoUrl(categoryImage(item), 160)} alt="" /></span>
                  <span className="drawer-category-name"><b>{item}</b><small>Mahsulotlarni ko‘rish</small></span>
                  <span className="drawer-category-arrow">→</span>
                </button>
              ))}
            </div>
            <a className="drawer-seller-link" href="http://localhost:5174">Sotuvchi bo‘lish <span>↗</span></a>
          </aside>
        </div>
      )}

      {authOpen && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
        <form className="modal" onSubmit={(event) => void submitAuth(event)}>
          <button type="button" className="close-button" onClick={() => setAuthOpen(false)}>×</button>
          <div className="modal-mark">2c</div><h2>{codeSent ? "Emailni tasdiqlang" : "2cbazar’ga xush kelibsiz"}</h2>
          <p>{codeSent ? `${email} manziliga yuborilgan 6 xonali kodni kiriting.` : "Kirish uchun emailingizni kiriting. Sizga tasdiqlash kodi yuboramiz."}</p>
          {!codeSent ? <label>Email manzili<input type="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="siz@example.com" /></label> :
            <label>Tasdiqlash kodi<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus value={code} onChange={(event) => setCode(event.target.value)} placeholder="000000" /></label>}
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button modal-submit" disabled={busy}>{busy ? "Kuting..." : codeSent ? "Tasdiqlash va kirish" : "Kodni yuborish"}</button>
          {codeSent && <button className="resend" type="button" onClick={() => { setCodeSent(false); setCode(""); }}>Emailni o‘zgartirish</button>}
          <small className="terms">Davom etish orqali foydalanish shartlariga rozilik bildirasiz.</small>
        </form>
      </div>}

      {cartOpen && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
        <div className="cart-drawer">
          <div className="drawer-heading"><h2>Savatingiz <span>({cartCount})</span></h2><button className="close-button" onClick={() => setCartOpen(false)}>×</button></div>
          {cartCount === 0 ? <div className="drawer-empty"><div>▣</div><h3>Savatingiz hozircha bo‘sh</h3><p>Yoqtirgan mahsulotlaringizni shu yerga qo‘shing.</p><button className="primary-button" onClick={() => setCartOpen(false)}>Xaridni davom ettirish</button></div> :
            <><div className="cart-items">{products.filter((item) => cart[item.id]).map((product) => <div className="cart-item" key={product.id}><div className="mini-image">{product.image_url ? <img src={product.image_url} alt="" /> : "2c"}</div><div><b>{product.name}</b><small>{formatPrice(product.price)}</small></div><div className="quantity"><button onClick={() => setCart((current) => ({ ...current, [product.id]: Math.max(0, current[product.id] - 1) }))}>−</button><span>{cart[product.id]}</span><button onClick={() => setCart((current) => ({ ...current, [product.id]: Math.min(current[product.id] + 1, product.stock) }))}>+</button></div></div>)}</div>
            <div className="checkout"><label>Yetkazib berish manzili<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Shahar, ko‘cha, uy" /></label><div className="total-row"><span>Jami</span><b>{formatPrice(cartTotal)}</b></div><button className="primary-button modal-submit" disabled={busy || address.trim().length < 8} onClick={() => void placeOrder()}>{tokens ? "Buyurtma berish" : "Kirish va buyurtma berish"}</button></div></>}
        </div>
      </div>}
      {notice && <div className="toast">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      <FregeChat />
    </div>
  );
}
