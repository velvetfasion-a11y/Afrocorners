export type StoreId = "fittja" | "marsta";

export type CategoryId = "harvard" | "skonhet" | "mat" | "kultur" | "accessoarer";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface DayHours {
  open: string;
  close: string;
}

export interface StoreLocation {
  id: StoreId;
  name: string;
  address: string;
  postalCity: string;
  mapsQuery: string;
  hours: Record<Weekday, DayHours | null>;
  closedDates: string[];
}

export interface ProductVariant {
  id: string;
  /** Shown on the product page, e.g. "1kg" or "Vanilla". */
  label: string;
  price: number;
  stock: Record<StoreId, number>;
  sumupSku?: string;
  image?: string;
}

export interface Product {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  salePrice: number | null;
  badge: string;
  category: CategoryId;
  images: string[];
  offer: boolean;
  news: boolean;
  sortOrder: number;
  stock: Record<StoreId, number>;
  active: boolean;
  /** Sizes or flavours sold on this one page. Absent when the product has a single price. */
  variants?: ProductVariant[];
}

export type OrderStatus = "ny" | "bekraftad" | "betald" | "klar" | "avbruten";

export type Fulfilment = "delivery" | "pickup";

export interface OrderItem {
  productId: string;
  variantId?: string;
  name: string;
  qty: number;
  unitPrice: number;
  image: string;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
}

export interface StockDeduction {
  productId: string;
  variantId?: string;
  storeId: StoreId;
  qty: number;
}

export interface Order {
  id: string;
  number: string;
  createdAt: string;
  status: OrderStatus;
  fulfilment: Fulfilment;
  pickupStoreId: StoreId | null;
  shipFromStoreId: StoreId | null;
  customer: OrderCustomer;
  items: OrderItem[];
  /** Amount due after any account discount. */
  total: number;
  /** Merchandise total before discount. Absent on older orders. */
  subtotal?: number;
  /** Google account that placed the order. Never grants admin access. */
  customerUid?: string | null;
  discount?: { offerId: string; title: string; amount: number } | null;
  stockApplied: boolean;
  stockGeneration: number;
  stockDeductions: StockDeduction[];
  note: string;
}

/** Stored on each stock log row and shown to the owner. */
export type StockReason =
  | "online_order"
  | "in_store_sale"
  | "restock"
  | "manual"
  | "SumUp-försäljning"
  | "SumUp-retur";

export type StockSource = "admin" | "order" | "sumup";

export interface StockLogEntry {
  id: string;
  createdAt: string;
  storeId: StoreId;
  productId: string;
  variantId?: string;
  productName: string;
  /** Signed. Negative means stock left the shelf. */
  change: number;
  reason: StockReason;
  source: StockSource;
  orderId?: string;
  /** Stable id. A repeated value is ignored so retries cannot double-count. */
  externalRef?: string;
  note?: string;
}

export interface StockMovementInput {
  storeId: StoreId;
  productId: string;
  variantId?: string;
  delta: number;
  reason: StockReason;
  source: StockSource;
  externalRef?: string;
  orderId?: string;
  note?: string;
}

export type IconName = "truck" | "shield" | "chat" | "leaf" | "diamond" | "gift" | "star" | "people";

export interface IconText {
  id: string;
  icon: IconName;
  text: string;
}

export interface HeroSlide {
  id: string;
  image: string;
  eyebrow: string;
  title: string;
  text: string;
  buttonLabel: string;
  buttonHref: string;
}

export interface CategoryTile {
  id: string;
  name: string;
  image: string;
  href: string;
}

/** Homepage grid only. Other tiles stay in the menu and footer. */
export const HOMEPAGE_TILE_IDS = ["harvard", "mat", "nyheter"] as const;

export function homepageTiles(categories: CategoryTile[]): CategoryTile[] {
  return HOMEPAGE_TILE_IDS.flatMap((id) => {
    const tile = categories.find((item) => item.id === id);
    return tile ? [tile] : [];
  });
}

export interface CampaignCard {
  id: string;
  title: string;
  text: string;
  buttonLabel: string;
  buttonHref: string;
  image: string;
}

export interface SiteContent {
  infoBar: IconText[];
  heroSlides: HeroSlide[];
  categories: CategoryTile[];
  campaigns: CampaignCard[];
  features: IconText[];
  footerHighlights: IconText[];
  footerAbout: string;
  footerEmail: string;
  freeShippingThreshold: number;
  stores: StoreLocation[];
  ownerPhone: string;
  messageTemplate: string;
}

export type SumupPendingKind =
  | "unmatched_product"
  | "unmapped_store"
  | "partial_refund"
  | "amount_only"
  | "weight";

export interface SumupLocationMapping {
  id: string;
  kind: "merchant" | "reader";
  externalId: string;
  label: string;
  storeId: StoreId | "";
}

export interface SumupProductMapping {
  id: string;
  /** sku:…, name:… or catalog:… */
  key: string;
  label: string;
  productId: string;
}

export interface SumupPending {
  id: string;
  merchantCode: string;
  saleId: string;
  lineId: string;
  name: string;
  sku: string;
  quantity: number;
  storeId: StoreId | null;
  kind: SumupPendingKind;
  detail: string;
  createdAt: string;
}

export interface SumupState {
  locationMappings: SumupLocationMapping[];
  productMappings: SumupProductMapping[];
  pending: SumupPending[];
  /** Do not import sales created before this instant. */
  syncFrom: string;
  lastSyncAt: string | null;
  lastSummary: string;
  lastError: string | null;
  channels: string[];
}

export interface Database {
  products: Product[];
  orders: Order[];
  logs: StockLogEntry[];
  content: SiteContent;
  sumup: SumupState;
  offers?: import("./offers").ShopOffer[];
  customers?: import("./offers").CustomerProfile[];
}

export const STORE_IDS: StoreId[] = ["fittja", "marsta"];

export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Måndag",
  tue: "Tisdag",
  wed: "Onsdag",
  thu: "Torsdag",
  fri: "Fredag",
  sat: "Lördag",
  sun: "Söndag",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  ny: "Ny",
  bekraftad: "Bekräftad",
  betald: "Betald",
  klar: "Skickad/Hämtad",
  avbruten: "Avbruten",
};

export const REASON_LABEL: Record<StockReason, string> = {
  online_order: "Onlineorder",
  in_store_sale: "Butiksförsäljning",
  restock: "Inleverans",
  manual: "Manuell justering",
  "SumUp-försäljning": "SumUp-försäljning",
  "SumUp-retur": "SumUp-retur",
};

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  harvard: "Hårvård",
  skonhet: "Skönhet",
  mat: "Mat & Specerier",
  kultur: "Kultur & Hem",
  accessoarer: "Accessoarer",
};

export const LOW_STOCK_AT = 3;

export const DEFAULT_SUMUP_CHANNELS = ["POS", "SOLO", "KIOSK"];
