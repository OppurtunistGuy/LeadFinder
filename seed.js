// Sample research done by hand on 18 Oct 2026, so the app shows real content
// before an API key is added. Every source below was found in that research.

export const COUNTRIES = ["Germany", "United Kingdom", "Europe", "United States", "Australia", "India"];

export const COUNTRY_NOTES = {
  Germany: {
    adData: "Meta's free Ad Library API covers all ads delivered in the EU, so this country can be researched at no cost.",
    market: "Pet supplies were the third-fastest-growing online category in 2025 (+5%), behind pharmacy (+6%) and groceries (+5.5%). Drugstore and health products are described as low penetration with high growth.",
    rules: "Direct-marketing rules are generally stricter than in the US. Check consent requirements before emailing; start with contact forms and a short reply to public hiring posts.",
    sources: [
      { title: "Germany e-commerce categories", url: "https://ecommercegermany.com/blog/most-popular-categories-for-online-purchases-in-germany-top-brands/" },
      { title: "Germany pet segment growth 2025", url: "https://globalpetindustry.com/news/germany-pet-segment-hits-third-strongest-e-commerce-growth-in-2025/" },
      { title: "Meta Ad Library coverage (EU/UK)", url: "https://apify.com/accountable_eel/meta-ads-presence-lookup" }
    ]
  },
  "United Kingdom": {
    adData: "Meta's free Ad Library API covers ads delivered in the UK, so this country can be researched at no cost.",
    market: "The UK led year-on-year e-commerce growth among major markets in September 2026 at +8.6%.",
    rules: "Follow UK rules on commercial email: identify yourself clearly and give an easy opt-out.",
    sources: [
      { title: "Global e-commerce recap, September 2026", url: "https://ecdb.com/blog/global-e-commerce-revenue-september/5268" },
      { title: "Meta Ad Library coverage (EU/UK)", url: "https://apify.com/accountable_eel/meta-ads-presence-lookup" }
    ]
  },
  Europe: {
    adData: "Same free Meta coverage as Germany: all ads delivered in the EU are visible through the official API.",
    market: "European digital video ad spend is estimated at $35B+, growing about 8% a year (industry roundup, treat as directional).",
    rules: "Rules differ by country. Treat each market separately and keep messages short, honest and easy to opt out of.",
    sources: [
      { title: "Video marketing statistics 2026", url: "https://resources.review42.com/video-marketing-statistics/" }
    ]
  },
  "United States": {
    adData: "Meta's official API returns almost no ordinary commercial ads for US-only audiences. Reaching them needs a paid scraper (a few dollars a month), planned for after the first test.",
    market: "US social video ad spend is projected at $31.9B in 2026, passing connected TV for the first time. US e-commerce grew +8.0% year on year in September 2026.",
    rules: "US email rules are looser but still require an honest sender identity and a working opt-out.",
    sources: [
      { title: "Social video advertising in 2026", url: "https://www.ilearnlot.com/social-video-advertising-in-2026/2934658/" },
      { title: "Global e-commerce recap, September 2026", url: "https://ecdb.com/blog/global-e-commerce-revenue-september/5268" }
    ]
  },
  Australia: {
    adData: "Same limit as the US: the free Meta API does not cover ordinary commercial ads outside the EU and UK, so a paid scraper is needed later.",
    market: "Skincare (especially SPF and sun care), pet accessories, supplements and activewear are the categories most often listed as in demand. Pet ownership is very high (one source says 67% of households).",
    rules: "Australia has its own consent rules for commercial email. Check them before any email outreach.",
    sources: [
      { title: "Trending products in Australia 2026", url: "https://www.skailama.com/blog/top-trending-products-to-sell-online-australia" }
    ]
  },
  India: {
    adData: "Last on the list. Coverage and approach will be decided after the other markets have been tested.",
    market: "Not researched yet.",
    rules: "Not researched yet.",
    sources: []
  }
};

const COMMON_SOURCES = [
  { title: "Motion graphics freelancing guide 2026 (Upwork median $25/hr)", url: "https://www.jobbers.io/motion-graphics-freelancing-after-effects-to-150-hour-guide-2026/" },
  { title: "Short-form video ads for DTC brands", url: "https://jetfuel.agency/short-form-video-ads-for-dtc-brands-tiktok-reels-and-shorts-strategy-that-drives-revenue-in-2026/" }
];

export const NICHES = [
  {
    key: "supplements",
    match: ["supplement", "wellness", "vitamin", "health", "nutrition"],
    name: "Health, wellness and supplements",
    plan: {
      whatTheyBuy: "A steady stream of short vertical ads for Meta and Google, with many variations of the same idea for A/B testing. Resizing and refreshing creative is a constant need.",
      adSpendSignals: "A live posting from an international health and wellness e-commerce company asks for a remote motion designer to make motion ads, static display ads, resizes and variations for several brands. One 2026 e-commerce roundup lists supplements among the fastest-growing categories; treat that as direction, not proof.",
      serviceFit: "Animated captions, product benefit callouts, end cards and quick variations of one concept. This is repeat work, which suits a monthly package after a first pilot.",
      openingOffer: { name: "Paid pilot ad", priceUSD: "75-150", scope: "One 10-15 second vertical ad, one format, two revisions" },
      risks: [
        "Supplement ads have strict rules on health claims. Every draft must avoid claims about curing, treating or preventing conditions.",
        "Established brands often have in-house teams or agencies, so look for ones hiring freelancers or running many near-identical ads."
      ]
    },
    sources: [
      { title: "Health and wellness freelance motion designer posting", url: "https://cargadetrabalhos.pt/?p=74227" },
      { title: "Ecommerce business ideas 2026 (supplements)", url: "https://alidropship.com/ecommerce-business-ideas/" }
    ]
  },
  {
    key: "skincare",
    match: ["skin", "beauty", "cosmetic", "spf", "sun care", "fragrance", "perfume"],
    name: "Skincare and beauty",
    plan: {
      whatTheyBuy: "Polished product ads with animated typography, texture shots and a clear call to action, plus quick social variations around launches and seasonal offers.",
      adSpendSignals: "Beauty and skincare are listed among the top online categories in Australia, with SPF and sun care called out specifically. In Germany, drugstore goods are described as low penetration with high growth, and shoppers use online stores to discover new skincare and fragrance brands. No ad-spend figures were found for this niche, so the real signal will come from which brands are running ads.",
      serviceFit: "Your premium product-ad sample (perfume, skincare or beverage style) fits directly. Seasonal pushes such as summer SPF in Australia and gifting periods give natural reasons to reach out.",
      openingOffer: { name: "Paid pilot ad", priceUSD: "75-150", scope: "One 10-15 second product ad, one format, two revisions" },
      risks: [
        "Beauty is a crowded niche, so your message must point to one specific improvement in their current ad.",
        "Avoid medical or results claims in drafts."
      ]
    },
    sources: [
      { title: "Germany e-commerce categories", url: "https://ecommercegermany.com/blog/most-popular-categories-for-online-purchases-in-germany-top-brands/" },
      { title: "Trending products in Australia 2026", url: "https://www.skailama.com/blog/top-trending-products-to-sell-online-australia" }
    ]
  },
  {
    key: "pet",
    match: ["pet", "dog", "cat", "animal"],
    name: "Pet products",
    plan: {
      whatTheyBuy: "Short product and benefit videos for food, toys, accessories and subscriptions. Retention and subscription messaging is common in this category.",
      adSpendSignals: "Pet supplies were the third-fastest-growing online category in Germany in 2025 (+5%), and pet retailers invested against the trend to gain online share. Australia has very high pet ownership.",
      serviceFit: "Friendly animated product ads and subscription explainers. Good for the second wave of tests after supplements and skincare.",
      openingOffer: { name: "Paid pilot ad", priceUSD: "75-150", scope: "One 10-15 second vertical ad, one format, two revisions" },
      risks: [
        "Large chains have in-house teams. Smaller direct-to-consumer pet brands are the likelier buyers.",
        "Growth in Germany is modest overall (online e-commerce is forecast to grow about 4% in 2026), so volume of leads matters more than any single big win."
      ]
    },
    sources: [
      { title: "Germany pet segment growth 2025", url: "https://globalpetindustry.com/news/germany-pet-segment-hits-third-strongest-e-commerce-growth-in-2025/" },
      { title: "Trending products in Australia 2026", url: "https://www.skailama.com/blog/top-trending-products-to-sell-online-australia" }
    ]
  }
];

export function findSeed(niche, country) {
  const q = (niche || "").toLowerCase();
  const hit = NICHES.find((n) => n.match.some((m) => q.includes(m)));
  if (!hit) return null;
  const c = COUNTRY_NOTES[country] || COUNTRY_NOTES.Germany;
  return {
    mode: "sample",
    niche: hit.name,
    country,
    plan: hit.plan,
    research: {
      adData: c.adData,
      market: c.market,
      rules: c.rules,
      caveat: "Niche lists online are mostly vendor blogs, so treat them as direction, not proof. The real test is whether leads reply. Upwork's median rate is about $25/hr, so direct brands should be the main target."
    },
    sources: [...hit.sources, ...c.sources, ...COMMON_SOURCES].filter(
      (s, i, all) => all.findIndex((x) => x.url === s.url) === i
    )
  };
}
