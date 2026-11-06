// P-01 الرئيسية والبحث
import {
  Building2,
  Clock,
  History,
  Phone,
  Search as SearchIcon,
  Store,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Freshness,
  SearchBar,
  Skeleton,
  buttonClass,
  searchUrl,
  useAreaLabel,
} from "../../components/ui";
import { governorateById } from "../../data";
import {
  useCatalog,
  usePharmacies,
  useRecentlyUpdated,
  useTopSearched,
} from "../../data/queries";
import { useLang } from "../../hooks/useLang";
import { useNow } from "../../hooks/useNow";
import { useOnline } from "../../hooks/useOnline";
import { useDataSaver, usePreferences } from "../../hooks/usePreferences";
import { formatRelative } from "../../lib/format";
import { cn } from "../../lib/cn";
import { readLastSearch } from "./useSearchLog";

export default function HomePage() {
  const { t } = useTranslation();
  const { pick, lang } = useLang();
  const [prefs] = usePreferences();
  const online = useOnline();
  const now = useNow();
  const gov = prefs.gov;
  const govName = pick(governorateById(gov));
  const catalog = useCatalog();
  const top = useTopSearched(gov);
  const recent = useRecentlyUpdated(gov);
  const pharmacies = usePharmacies(gov);
  const area = useAreaLabel();
  const last = readLastSearch();
  const saver = useDataSaver();
  const [bannerFailed, setBannerFailed] = useState(false);
  const showBanner = !saver && !bannerFailed;
  const medName = (id: string) =>
    pick(catalog.data?.medicines.find((m) => m.id === id));

  const steps = [
    { Icon: SearchIcon, title: t("home.how1Title"), body: t("home.how1Body") },
    { Icon: Clock, title: t("home.how2Title"), body: t("home.how2Body") },
    { Icon: Phone, title: t("home.how3Title"), body: t("home.how3Body") },
  ];

  return (
    <div className="space-y-10">
      {/* Full-width band: breaks out of the content column to the shell edges (Stitch P-01). */}
      <section className="-mt-8 mx-[calc(50%-50cqw)] bg-primary text-white">
        {/* Same width as the search card below, so their edges line up. With the banner: title at the
            start, banner card at the end (above the title on phones). Without it: the centred band. */}
        <div
          className={cn(
            "mx-auto max-w-5xl px-6 pb-24 lg:pb-28",
            showBanner
              ? "flex flex-col gap-6 pt-6 lg:flex-row lg:items-center lg:gap-10 lg:pt-12"
              : "pt-14 text-center lg:pt-20",
          )}
        >
          <div className={showBanner ? "text-center lg:flex-1 lg:text-start" : undefined}>
            <h1 className={cn("text-hero", !showBanner && "mx-auto max-w-3xl")}>{t("home.title")}</h1>
            <p className={cn("mt-3 text-mint", !showBanner && "mx-auto max-w-2xl")}>{t("home.subtitle")}</p>
          </div>
          {/* The banner (docs/brand/banner-original.jpg): skipped in data saver mode or when it cannot load. */}
          {showBanner && (
            <img
              src="/brand/banner-750.webp"
              srcSet="/brand/banner-750.webp 750w, /brand/banner-1500.webp 1500w"
              sizes="(min-width: 1024px) 480px, (min-width: 448px) 448px, 100vw"
              width={1500}
              height={558}
              alt={t("home.bannerAlt")}
              fetchPriority="high"
              onError={() => setBannerFailed(true)}
              className="order-first mx-auto block h-auto w-full max-w-md rounded-card shadow-card ring-1 ring-white/25 lg:order-none lg:w-[30rem] lg:max-w-none lg:shrink-0"
            />
          )}
        </div>
      </section>
      <div className="relative z-10 mx-auto -mt-28 max-w-5xl px-2 lg:-mt-32">
        <SearchBar variant="hero" />
      </div>

      {!online && last && (
        <Link
          to={searchUrl(last.q, last.gov, prefs.availableOnly)}
          className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 hover:border-secondary"
        >
          <History aria-hidden className="size-5 text-secondary" />
          <span>
            {t("home.lastSearch", { query: last.q })}
            <span className="ms-2 text-meta text-ink-muted">
              {formatRelative(new Date(last.at), now, lang)}
            </span>
          </span>
        </Link>
      )}

      {(top.isPending || (top.data?.length ?? 0) > 0) && (
        <section
          aria-labelledby="top-title"
          className="flex min-h-10 flex-wrap items-center gap-3"
        >
          <h2 id="top-title" className="flex items-center gap-2 font-semibold">
            <TrendingUp aria-hidden className="size-5 text-secondary" />
            {t("home.topSearched", { gov: govName })}
          </h2>
          {/* Holds the chips' place while loading, so the page below does not jump (CLS). */}
          {top.isPending || catalog.isPending ? (
            <div aria-hidden className="flex flex-wrap gap-2">
              <Skeleton className="h-10 w-28 rounded-full" />
              <Skeleton className="h-10 w-32 rounded-full" />
              <Skeleton className="h-10 w-28 rounded-full" />
            </div>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {top.data!.map((x) => (
                <li key={x.medicineId}>
                  <Link
                    to={searchUrl(
                      medName(x.medicineId),
                      gov,
                      prefs.availableOnly,
                    )}
                    className="inline-flex min-h-10 items-center rounded-full border border-border bg-surface px-4 font-medium hover:border-secondary hover:bg-mint"
                  >
                    {medName(x.medicineId)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section
        aria-labelledby="recent-title"
        className="rounded-card border border-border bg-surface p-5 shadow-card"
      >
        <h2 id="recent-title" className="text-section">
          {t("home.recentlyUpdated")}
        </h2>
        <p className="text-meta text-ink-muted">
          {t("home.recentlyUpdatedHint", { gov: govName })}
        </p>
        {recent.isPending || pharmacies.isPending ? (
          <div className="mt-4 space-y-1">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : (recent.data?.length ?? 0) === 0 ? (
          <p className="mt-4 text-ink-muted">{t("home.noRecent")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {recent.data!.map((r) => {
              const p = pharmacies.data?.find((x) => x.id === r.pharmacyId);
              if (!p) return null;
              return (
                <li key={r.pharmacyId}>
                  <Link
                    to={`/pharmacy/${p.id}`}
                    className="flex min-h-14 items-center gap-3 py-2 hover:text-primary"
                  >
                    <Store
                      aria-hidden
                      className="size-5 shrink-0 text-secondary"
                    />
                    <span className="flex-1">
                      <span className="font-medium">{pick(p)}</span>
                      <span className="ms-2 text-meta text-ink-muted">
                        {area(p)}
                      </span>
                    </span>
                    <Freshness at={r.at} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section
        aria-labelledby="cant-find"
        className="flex flex-col gap-3 rounded-card border border-border bg-mint p-5 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h2 id="cant-find" className="text-section">
            {t("home.cantFindTitle")}
          </h2>
          <p className="text-meta text-ink-muted">{t("home.cantFindBody")}</p>
        </div>
        <Link to={`/directory?gov=${gov}`} className={buttonClass("secondary")}>
          <Building2 aria-hidden className="size-4" />
          {t("home.cantFindAction")}
        </Link>
      </section>

      <section aria-labelledby="how-title">
        <h2 id="how-title" className="text-section mb-3">
          {t("home.howTitle")}
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map(({ Icon, title, body }, i) => (
            <li
              key={title}
              className="rounded-card border border-border bg-surface p-5 shadow-card"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-mint font-semibold text-primary">
                  <bdi>{i + 1}</bdi>
                </span>
                <Icon aria-hidden className="size-5 text-secondary" />
              </span>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-meta text-ink-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
