"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  useCreateOffer,
  useCreateThread,
  useCurrentUser,
  useDeliveredOrdersForListing,
  useFlagReview,
  useListing,
  useListingAuction,
  useListingMutations,
  useListingReviews,
  usePlaceBid,
  useRemoveSavedListing,
  useReviewMutations,
  useSaveListing,
  useSellerStorefront,
  useVoteReview,
  useWishlistCheck,
} from "../../../lib/react-query/hooks";
import { useCart } from "../../../lib/cart-context";

type Tab = "description" | "shipping" | "reviews";

export function ListingDetail({ id }: { id: string }) {
  const { data, isLoading } = useListing(id);
  const { user } = useCurrentUser();
  const { data: sellerStorefront } = useSellerStorefront(
    data?.sellerId ?? null,
  );
  const { data: auction } = useListingAuction(data?.id ?? null);
  const { addItem } = useCart();
  const router = useRouter();

  const { data: reviewData, isLoading: reviewsLoading } = useListingReviews(id);
  const { createReview } = useReviewMutations();
  const { data: deliveredOrders } = useDeliveredOrdersForListing(
    user ? id : null,
  );
  const eligibleOrder = deliveredOrders?.[0] ?? null;

  const [activeTab, setActiveTab] = useState<Tab>("description");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [addedToCart, setAddedToCart] = useState(false);

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const createOffer = useCreateOffer();

  const [bidAmount, setBidAmount] = useState("");
  const placeBid = usePlaceBid();

  const { reportListingMutation } = useListingMutations();
  const { data: wishlistCheck } = useWishlistCheck(
    user ? (data?.id ?? null) : null,
  );
  const saveListing = useSaveListing();
  const removeSaved = useRemoveSavedListing();

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("Prohibited item");
  const [flagReviewId, setFlagReviewId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("Inappropriate content");
  const voteReview = useVoteReview(id);
  const flagReview = useFlagReview(id);

  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const createThread = useCreateThread();

  const isSaved = wishlistCheck?.saved ?? false;
  const isSubmitting = createReview.isPending;

  const averageRating = useMemo(() => {
    if (!reviewData) return "—";
    return reviewData.rollup.publishedCount > 0
      ? reviewData.rollup.averageRating.toFixed(1)
      : "—";
  }, [reviewData]);

  const [timeLeft, setTimeLeft] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!auction?.endAt) return;
    function tick() {
      const diff = new Date(auction!.endAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Ended");
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
    }
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [auction, auction?.endAt]);

  const condition = (data?.metadata as Record<string, unknown> | null)
    ?.condition as string | undefined;

  if (isLoading) {
    return (
      <div className="px-4 py-6 max-w-screen-xl mx-auto">
        <div className="card-forumo space-y-4">
          <div className="skeleton h-4 w-32" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="skeleton aspect-square" />
            <div className="space-y-4">
              <div className="skeleton h-8 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-10 w-1/3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-6 max-w-screen-xl mx-auto">
        <div className="card-forumo text-center py-16 space-y-3">
          <p className="text-slate-500 font-medium">Listing not found</p>
          <Link className="text-forumo-link hover:underline" href="/listings">
            Back to listings
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmitReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data || !user || !eligibleOrder) return;
    createReview.mutate({
      reviewerId: user.id,
      recipientId: data.sellerId,
      listingId: data.id,
      orderId: eligibleOrder.id,
      rating,
      comment,
    });
  };

  const images = data.images ?? [];
  const isAuctionActive = auction?.status === "ACTIVE";
  const currentBid = auction?.currentBidCents ?? auction?.startingBidCents ?? 0;
  const minNextBid = Math.ceil(currentBid * 1.01);

  const CONDITION_LABEL: Record<string, string> = {
    NEW: "New",
    LIKE_NEW: "Like New",
    GOOD: "Good",
    FAIR: "Fair",
  };
  const CONDITION_COLOR: Record<string, string> = {
    NEW: "bg-emerald-100 text-emerald-700",
    LIKE_NEW: "bg-blue-100 text-blue-700",
    GOOD: "bg-yellow-100 text-yellow-700",
    FAIR: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="px-4 py-6 max-w-screen-xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-slate-500">
        <Link href="/listings" className="text-forumo-link hover:underline">
          Listings
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700 truncate">{data.title}</span>
      </div>

      {/* Main product card */}
      <div className="card-forumo">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Image gallery */}
          <div className="space-y-3">
            <div className="relative aspect-square bg-slate-100 rounded overflow-hidden">
              {images.length > 0 && images[selectedImage]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={images[selectedImage].url}
                  alt={data.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[color:var(--ink-3)]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-24 w-24"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded border-2 overflow-hidden flex-shrink-0 transition-colors ${
                      i === selectedImage
                        ? "border-forumo-orange"
                        : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    {img.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wide text-slate-400 font-medium">
                  {data.status}
                </span>
                {condition && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${CONDITION_COLOR[condition] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {CONDITION_LABEL[condition] ?? condition}
                  </span>
                )}
              </div>
              <div className="flex items-start justify-between gap-3 mt-1">
                <h1 className="text-2xl font-bold">{data.title}</h1>
                {user && user.id !== data.sellerId && (
                  <button
                    type="button"
                    onClick={() =>
                      isSaved
                        ? removeSaved.mutate(data.id)
                        : saveListing.mutate(data.id)
                    }
                    disabled={saveListing.isPending || removeSaved.isPending}
                    title={
                      isSaved ? "Remove from wishlist" : "Save to wishlist"
                    }
                    className={`shrink-0 text-2xl transition-colors disabled:opacity-50 ${isSaved ? "text-red-500" : "text-slate-400 hover:text-red-400"}`}
                  >
                    {isSaved ? "♥" : "♡"}
                  </button>
                )}
              </div>
            </div>

            {/* Rating summary */}
            {reviewData && reviewData.rollup.publishedCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-forumo-orange font-bold">
                  {averageRating}
                </span>
                <span className="text-forumo-orange">
                  {"★".repeat(Math.round(reviewData.rollup.averageRating))}
                </span>
                <span className="text-slate-500">
                  ({reviewData.rollup.publishedCount} reviews)
                </span>
              </div>
            )}

            <hr className="border-slate-200" />

            {/* Price & stock */}
            <div className="space-y-1">
              <p className="text-3xl font-bold">
                {formatPrice(data.priceCents, data.currency)}
              </p>
              {data.location && (
                <p className="text-sm text-slate-500">
                  Ships from {data.location}
                </p>
              )}
            </div>

            {/* Variants */}
            {data.variants && data.variants.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Options:</p>
                <div className="flex flex-wrap gap-2">
                  {data.variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() =>
                        setSelectedVariantId(
                          variant.id === selectedVariantId
                            ? null
                            : (variant.id ?? null),
                        )
                      }
                      className={`px-3 py-2 border rounded text-sm transition-colors ${
                        selectedVariantId === variant.id
                          ? "border-forumo-orange bg-forumo-orange/10 text-forumo-orange font-medium"
                          : "border-slate-300 hover:border-forumo-orange"
                      }`}
                    >
                      {variant.label} —{" "}
                      {formatPrice(
                        variant.priceCents,
                        variant.currency ?? data.currency,
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CTA buttons */}
            <div className="space-y-2 pt-2">
              {!isAuctionActive && (
                <>
                  {data.variants &&
                    data.variants.length > 0 &&
                    !selectedVariantId && (
                      <p className="text-xs text-amber-600 font-medium">
                        Please select an option above
                      </p>
                    )}
                  <button
                    type="button"
                    disabled={
                      !!(
                        data.variants &&
                        data.variants.length > 0 &&
                        !selectedVariantId
                      )
                    }
                    className="btn-forumo block text-center w-full py-3 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                      const variant = selectedVariantId
                        ? (data.variants?.find(
                            (v) => v.id === selectedVariantId,
                          ) ?? null)
                        : null;
                      addItem({
                        listingId: data.id,
                        sellerId: data.sellerId,
                        title: data.title,
                        priceCents: variant?.priceCents ?? data.priceCents,
                        currency: variant?.currency ?? data.currency,
                        imageUrl: data.images?.[0]?.url,
                        variantId: variant?.id ?? undefined,
                        variantLabel: variant?.label ?? undefined,
                      });
                      setAddedToCart(true);
                      setTimeout(() => setAddedToCart(false), 2000);
                    }}
                  >
                    {addedToCart ? "✓ Added to Cart" : "Add to Cart"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      !!(
                        data.variants &&
                        data.variants.length > 0 &&
                        !selectedVariantId
                      )
                    }
                    className="block text-center w-full py-3 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                      const variant = selectedVariantId
                        ? (data.variants?.find(
                            (v) => v.id === selectedVariantId,
                          ) ?? null)
                        : null;
                      addItem({
                        listingId: data.id,
                        sellerId: data.sellerId,
                        title: data.title,
                        priceCents: variant?.priceCents ?? data.priceCents,
                        currency: variant?.currency ?? data.currency,
                        imageUrl: data.images?.[0]?.url,
                        variantId: variant?.id ?? undefined,
                        variantLabel: variant?.label ?? undefined,
                      });
                      router.push("/app/checkout");
                    }}
                  >
                    Buy Now
                  </button>
                </>
              )}
              {user && user.id !== data.sellerId && !isAuctionActive && (
                <button
                  type="button"
                  onClick={() => setShowOfferModal(true)}
                  className="block text-center w-full py-3 border border-amber-400 rounded-lg text-sm text-amber-600 hover:bg-amber-400/10 font-medium"
                >
                  Make an offer
                </button>
              )}
              {user && user.id !== data.sellerId && (
                <button
                  type="button"
                  onClick={() => setShowMessageModal(true)}
                  className="block text-center w-full py-3 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                >
                  Contact Seller
                </button>
              )}
            </div>

            {/* Seller info */}
            <div className="border border-slate-200 rounded-lg p-4 space-y-2">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                Sold by
              </p>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {(sellerStorefront as any)?.name ?? "Seller"}
                  </p>
                  {(sellerStorefront as any)?.rating != null && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      ★{" "}
                      {((sellerStorefront as any).rating as number).toFixed(1)}{" "}
                      seller rating
                    </p>
                  )}
                </div>
                {sellerStorefront?.slug && (
                  <Link
                    href={`/shops/${sellerStorefront.slug}` as any}
                    className="text-xs text-forumo-link hover:underline whitespace-nowrap"
                  >
                    View shop →
                  </Link>
                )}
              </div>
            </div>

            {/* Report */}
            {user && user.id !== data.sellerId && (
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="text-xs text-slate-400 hover:text-red-400 hover:underline"
              >
                Report this listing
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Auction section */}
      {auction && (
        <div
          className={`card-forumo space-y-4 border-2 ${isAuctionActive ? "border-forumo-orange/40" : "border-slate-200"}`}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>🔨</span>
                {isAuctionActive
                  ? "Live Auction"
                  : `Auction (${auction.status})`}
              </h2>
              {isAuctionActive && timeLeft && (
                <p className="text-sm text-slate-500 mt-0.5">
                  Ends in{" "}
                  <span className="font-mono font-bold text-forumo-orange">
                    {timeLeft}
                  </span>
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Current bid</p>
              <p className="text-2xl font-bold">
                {formatPrice(currentBid, auction.currency)}
              </p>
              {auction.bidCount != null && (
                <p className="text-xs text-slate-500">
                  {auction.bidCount} bid{auction.bidCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>

          {auction.reserveCents && currentBid < auction.reserveCents && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Reserve price not yet met
            </p>
          )}
          {auction.buyNowCents && (
            <p className="text-xs text-slate-500">
              Buy it now for{" "}
              <span className="font-semibold">
                {formatPrice(auction.buyNowCents, auction.currency)}
              </span>
            </p>
          )}

          {isAuctionActive && user && user.id !== data?.sellerId && (
            <div className="flex gap-3">
              <input
                type="number"
                min={minNextBid / 100}
                step="0.01"
                placeholder={`Min ${formatPrice(minNextBid, auction.currency)}`}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                className="input-forumo flex-1 text-sm"
              />
              <button
                type="button"
                disabled={placeBid.isPending || !bidAmount}
                onClick={async () => {
                  if (!bidAmount || !auction) return;
                  const amountCents = Math.round(parseFloat(bidAmount) * 100);
                  await placeBid.mutateAsync({
                    auctionId: auction.id,
                    amountCents,
                  });
                  setBidAmount("");
                }}
                className="btn-forumo px-6 text-sm font-bold whitespace-nowrap disabled:opacity-50"
              >
                {placeBid.isPending ? "Placing…" : "Place Bid"}
              </button>
            </div>
          )}
          {placeBid.isError && (
            <p className="text-sm text-red-500">
              {(placeBid.error as Error)?.message}
            </p>
          )}
          {placeBid.isSuccess && (
            <p className="text-sm text-emerald-600">Bid placed successfully!</p>
          )}
          {!user && isAuctionActive && (
            <Link
              href={"/auth/login" as any}
              className="btn-forumo block text-center text-sm py-2"
            >
              Sign in to place a bid
            </Link>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="card-forumo space-y-0 p-0 overflow-hidden">
        <div className="flex border-b border-slate-200">
          {(["description", "shipping", "reviews"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-forumo-orange text-forumo-orange"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab === "reviews"
                ? `Reviews (${reviewData?.rollup.publishedCount ?? 0})`
                : tab === "description"
                  ? "Description"
                  : "Shipping Info"}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "description" && (
            <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed">
              {data.description ? (
                data.description
                  .split("\n")
                  .map((line, i) =>
                    line ? <p key={i}>{line}</p> : <br key={i} />,
                  )
              ) : (
                <p className="text-slate-400 italic">
                  No description provided.
                </p>
              )}
            </div>
          )}

          {activeTab === "shipping" && (
            <div className="space-y-3 text-sm text-slate-600">
              {data.location ? (
                <p>
                  <span className="font-medium">Ships from:</span>{" "}
                  {data.location}
                </p>
              ) : (
                <p className="text-slate-400 italic">
                  Shipping information not provided.
                </p>
              )}
              <p className="text-slate-400 text-xs">
                Forumo uses escrow-protected payments. Your funds are held until
                you confirm delivery.
              </p>
            </div>
          )}

          {activeTab === "reviews" && (
            <ReviewsTab
              reviewData={reviewData}
              reviewsLoading={reviewsLoading}
              averageRating={averageRating}
              user={user}
              eligibleOrder={eligibleOrder}
              listingId={id}
              rating={rating}
              setRating={setRating}
              comment={comment}
              setComment={setComment}
              isSubmitting={isSubmitting}
              createReview={createReview}
              handleSubmit={handleSubmitReview}
              voteReview={voteReview}
              flagReviewId={flagReviewId}
              setFlagReviewId={setFlagReviewId}
              flagReason={flagReason}
              setFlagReason={setFlagReason}
              flagReview={flagReview}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {showOfferModal && (
        <Modal
          onClose={() => {
            setShowOfferModal(false);
            createOffer.reset();
          }}
        >
          <h3 className="text-lg font-semibold">Make an offer</h3>
          <p className="text-sm muted">
            Listed at {(data.priceCents / 100).toFixed(2)} {data.currency}
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--ink-2)]">
              Your offer ({data.currency})
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--ink-2)]">
              Message (optional)
            </label>
            <textarea
              value={offerMessage}
              onChange={(e) => setOfferMessage(e.target.value)}
              placeholder="Why are you making this offer?"
              rows={3}
              maxLength={500}
              className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
          </div>
          {createOffer.isError && (
            <p className="text-sm text-red-600">
              {(createOffer.error as Error)?.message}
            </p>
          )}
          {createOffer.isSuccess && (
            <p className="text-sm text-[color:var(--escrow)]">Offer sent!</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={async () => {
                if (!offerAmount) return;
                await createOffer.mutateAsync({
                  listingId: data.id,
                  amountCents: Math.round(parseFloat(offerAmount) * 100),
                  message: offerMessage || undefined,
                });
                setTimeout(() => setShowOfferModal(false), 1500);
              }}
              disabled={createOffer.isPending || !offerAmount}
              className="flex-1 rounded-lg bg-[color:var(--accent)] py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--accent-2)] disabled:opacity-50"
            >
              {createOffer.isPending ? "Sending…" : "Send offer"}
            </button>
            <button
              onClick={() => {
                setShowOfferModal(false);
                createOffer.reset();
              }}
              className="rounded-lg border border-[color:var(--line-2)] px-4 py-2.5 text-sm subtle transition-colors hover:bg-[color:var(--surface-2)]"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {showMessageModal && user && data && user.id !== data.sellerId && (
        <Modal
          onClose={() => {
            setShowMessageModal(false);
            setMessageBody("");
            createThread.reset();
          }}
        >
          <h3 className="text-lg font-semibold">Message seller</h3>
          <p className="text-sm muted truncate">{data.title}</p>
          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--ink-2)]">
              Message
            </label>
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Hi, I have a question about this listing…"
              rows={4}
              maxLength={2000}
              className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
          </div>
          {createThread.isError && (
            <p className="text-sm text-red-600">
              {(createThread.error as Error)?.message}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={async () => {
                const thread = await createThread.mutateAsync({
                  listingId: data.id,
                  subject: `Re: ${data.title.slice(0, 100)}`,
                  participants: [
                    { userId: user.id, role: "BUYER" },
                    { userId: data.sellerId, role: "SELLER" },
                  ],
                  initialMessage: messageBody.trim()
                    ? { authorId: user.id, body: messageBody.trim() }
                    : undefined,
                });
                setShowMessageModal(false);
                setMessageBody("");
                createThread.reset();
                router.push(`/app/messages/${thread.id}` as any);
              }}
              disabled={createThread.isPending}
              className="flex-1 rounded-lg bg-[color:var(--accent)] py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--accent-2)] disabled:opacity-50"
            >
              {createThread.isPending ? "Starting…" : "Start conversation"}
            </button>
            <button
              onClick={() => {
                setShowMessageModal(false);
                setMessageBody("");
                createThread.reset();
              }}
              className="rounded-lg border border-[color:var(--line-2)] px-4 py-2.5 text-sm subtle transition-colors hover:bg-[color:var(--surface-2)]"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {showReportModal && (
        <Modal
          onClose={() => {
            setShowReportModal(false);
            reportListingMutation.reset();
          }}
        >
          <h3 className="text-lg font-semibold">Report listing</h3>
          <p className="text-sm muted">
            Tell us why this listing violates Forumo&apos;s policies.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--ink-2)]">
              Reason
            </label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            >
              <option>Prohibited item</option>
              <option>Counterfeit / fake product</option>
              <option>Misleading description</option>
              <option>Spam or duplicate listing</option>
              <option>Offensive content</option>
              <option>Suspected scam</option>
              <option>Other</option>
            </select>
          </div>
          {reportListingMutation.isError && (
            <p className="text-sm text-red-600">
              {(reportListingMutation.error as Error)?.message}
            </p>
          )}
          {reportListingMutation.isSuccess && (
            <p className="text-sm text-[color:var(--escrow)]">
              Thanks — our team will review this listing.
            </p>
          )}
          <div className="flex gap-3">
            {!reportListingMutation.isSuccess && (
              <button
                onClick={async () => {
                  await reportListingMutation.mutateAsync({
                    listingId: data.id,
                    reason: reportReason,
                  });
                  setTimeout(() => {
                    setShowReportModal(false);
                    reportListingMutation.reset();
                  }, 1800);
                }}
                disabled={reportListingMutation.isPending}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {reportListingMutation.isPending
                  ? "Submitting…"
                  : "Submit report"}
              </button>
            )}
            <button
              onClick={() => {
                setShowReportModal(false);
                reportListingMutation.reset();
              }}
              className="rounded-lg border border-[color:var(--line-2)] px-4 py-2.5 text-sm subtle transition-colors hover:bg-[color:var(--surface-2)]"
            >
              {reportListingMutation.isSuccess ? "Close" : "Cancel"}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit link for seller */}
      {user && user.id === data.sellerId && (
        <div className="text-right">
          <Link
            className="text-sm text-forumo-link hover:underline"
            href={`/listings/${data.id}/edit` as any}
          >
            Edit this listing
          </Link>
        </div>
      )}
    </div>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.20_0.012_50_/_0.45)] backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-6 space-y-4 fade-up">
        {children}
      </div>
    </div>
  );
}

function ReviewsTab({
  reviewData,
  reviewsLoading,
  averageRating,
  user,
  eligibleOrder,
  listingId: _listingId,
  rating,
  setRating,
  comment,
  setComment,
  isSubmitting,
  createReview,
  handleSubmit,
  voteReview,
  flagReviewId,
  setFlagReviewId,
  flagReason,
  setFlagReason,
  flagReview,
}: {
  reviewData: any;
  reviewsLoading: boolean;
  averageRating: string;
  user: any;
  eligibleOrder: any;
  listingId: string;
  rating: number;
  setRating: (r: number) => void;
  comment: string;
  setComment: (c: string) => void;
  isSubmitting: boolean;
  createReview: any;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  voteReview: any;
  flagReviewId: string | null;
  setFlagReviewId: (id: string | null) => void;
  flagReason: string;
  setFlagReason: (r: string) => void;
  flagReview: any;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Customer Reviews</h2>
        <p className="text-sm text-slate-500">
          {averageRating} out of 5 ({reviewData?.rollup.publishedCount ?? 0}{" "}
          reviews)
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Review list */}
        <div className="space-y-3">
          {reviewsLoading && (
            <p className="text-sm text-slate-500">Loading reviews…</p>
          )}
          {!reviewsLoading && (reviewData?.reviews?.length ?? 0) === 0 && (
            <p className="text-sm text-slate-500">
              No reviews yet. Be the first!
            </p>
          )}
          <ul className="space-y-3">
            {reviewData?.reviews.map((review: any) => (
              <li key={review.id} className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-forumo-orange font-bold">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                  <span className="font-medium">
                    {review.reviewer?.name ?? "Anonymous"}
                  </span>
                </div>
                {review.verifiedPurchase && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-emerald-600 text-xs">✓</span>
                    <span className="text-xs font-medium text-emerald-600">
                      Verified Purchase
                    </span>
                  </div>
                )}
                {review.comment ? (
                  <p className="text-sm text-slate-600 mt-1">
                    {review.comment}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">No comment</p>
                )}
                {review.flags?.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">Under review</p>
                )}
                {user && user.id !== review.reviewerId && (
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => voteReview.mutate(review.id)}
                      disabled={review.userVoted || voteReview.isPending}
                      className={`flex items-center gap-1 text-xs transition-colors disabled:cursor-default ${
                        review.userVoted
                          ? "text-emerald-600 font-medium"
                          : "text-slate-400 hover:text-emerald-600"
                      }`}
                    >
                      <span>👍</span>
                      <span>
                        Helpful
                        {review.helpfulCount > 0
                          ? ` (${review.helpfulCount})`
                          : ""}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFlagReviewId(review.id);
                        setFlagReason("Inappropriate content");
                      }}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                    >
                      🚩 Report
                    </button>
                  </div>
                )}
                {!user && review.helpfulCount > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    {review.helpfulCount} found this helpful
                  </p>
                )}
              </li>
            ))}
          </ul>

          {flagReviewId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.20_0.012_50_/_0.45)] backdrop-blur-sm px-4">
              <div className="w-full max-w-sm rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-6 space-y-4 fade-up">
                <h3 className="text-lg font-semibold">Report review</h3>
                <p className="text-sm muted">
                  Tell us why this review violates Forumo&apos;s policies.
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[color:var(--ink-2)]">
                    Reason
                  </label>
                  <select
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
                  >
                    <option>Inappropriate content</option>
                    <option>Spam or fake review</option>
                    <option>Conflict of interest</option>
                    <option>Not about the product</option>
                    <option>Other</option>
                  </select>
                </div>
                {flagReview.isError && (
                  <p className="text-sm text-red-600">
                    {(flagReview.error as Error)?.message}
                  </p>
                )}
                {flagReview.isSuccess && (
                  <p className="text-sm text-[color:var(--escrow)]">
                    Thanks — our team will review this.
                  </p>
                )}
                <div className="flex gap-3">
                  {!flagReview.isSuccess && (
                    <button
                      onClick={async () => {
                        await flagReview.mutateAsync({
                          reviewId: flagReviewId,
                          reason: flagReason,
                        });
                        setTimeout(() => {
                          setFlagReviewId(null);
                          flagReview.reset();
                        }, 1800);
                      }}
                      disabled={flagReview.isPending}
                      className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {flagReview.isPending ? "Submitting…" : "Submit report"}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setFlagReviewId(null);
                      flagReview.reset();
                    }}
                    className="rounded-lg border border-[color:var(--line-2)] px-4 py-2.5 text-sm subtle transition-colors hover:bg-[color:var(--surface-2)]"
                  >
                    {flagReview.isSuccess ? "Close" : "Cancel"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Review form */}
        <div>
          <h3 className="text-lg font-bold mb-3">Leave a review</h3>
          {!user ? (
            <div className="text-center py-8 bg-slate-50 rounded">
              <p className="text-sm text-slate-500">
                Sign in to leave a review
              </p>
              <Link
                href={"/auth/login" as any}
                className="btn-forumo inline-block mt-2 text-sm"
              >
                Sign in
              </Link>
            </div>
          ) : !eligibleOrder ? (
            <div className="py-6 bg-slate-50 rounded px-4">
              <p className="text-sm text-slate-500">
                You can only review products you&apos;ve purchased and received
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Rating
                </span>
                <select
                  className="input-forumo mt-1"
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  disabled={isSubmitting}
                >
                  {[5, 4, 3, 2, 1].map((v) => (
                    <option key={v} value={v}>
                      {v} star{v !== 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Comment
                </span>
                <textarea
                  className="input-forumo mt-1"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  disabled={isSubmitting}
                  placeholder="Share your experience"
                />
              </label>
              <button
                type="submit"
                className="btn-forumo w-full py-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting…" : "Submit review"}
              </button>
              {createReview.error && (
                <p className="text-sm text-red-600">
                  {String(createReview.error.message)}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    priceCents / 100,
  );
}
