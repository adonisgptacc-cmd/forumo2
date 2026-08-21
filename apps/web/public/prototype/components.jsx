/* components.jsx — Forumo design atoms.
   All shared icons + atoms exported to window so screens.jsx + prototype.jsx
   can reuse them. (Babel scripts don't share scope.) */

const { useState, useEffect, useMemo, useRef } = React;

/* ──────────────────────── Icons (inline SVG) ──────────────────────── */
const Icon = {
  search: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  cart: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M3 4h2.5L7 14h11l2-7H6" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </svg>
  ),
  user: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  ),
  message: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M21 12a8 8 0 1 1-3.4-6.5L21 5l-1 3.4A8 8 0 0 1 21 12Z" />
    </svg>
  ),
  bell: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  ),
  heart: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z" />
    </svg>
  ),
  shield: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M12 3 4 6v6c0 4.5 3.5 8.5 8 9 4.5-.5 8-4.5 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  check: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  ),
  truck: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M3 7h11v10H3z" />
      <path d="M14 10h4l3 3v4h-7" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </svg>
  ),
  package: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="m3 7 9-4 9 4-9 4-9-4Z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </svg>
  ),
  card: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 11h20" />
    </svg>
  ),
  lock: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  ),
  star: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="m12 2 2.9 6.5 7.1.7-5.4 4.8 1.7 7L12 17.3 5.7 21l1.7-7L2 9.2l7.1-.7L12 2Z" />
    </svg>
  ),
  starOutline: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      {...p}
    >
      <path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.5 6.3L12 17l-5.7 3.1 1.5-6.3L3 9.5l6.4-.6L12 3Z" />
    </svg>
  ),
  arrowRight: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  ),
  arrowLeft: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M19 12H5" />
      <path d="m11 19-7-7 7-7" />
    </svg>
  ),
  plus: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      {...p}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  minus: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      {...p}
    >
      <path d="M5 12h14" />
    </svg>
  ),
  x: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      {...p}
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  pin: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M20 10c0 7-8 12-8 12s-8-5-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  scale: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M12 3v18" />
      <path d="M5 6h14" />
      <path d="M5 6 2 13a4 4 0 0 0 6 0L5 6Z" />
      <path d="m19 6-3 7a4 4 0 0 0 6 0l-3-7Z" />
    </svg>
  ),
  chat: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M21 11.5a8 8 0 0 1-12 7L4 20l1.5-4.5a8 8 0 1 1 15.5-4Z" />
    </svg>
  ),
  filter: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M4 5h16M7 12h10M10 19h4" />
    </svg>
  ),
  sparkle: (p) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  ),
};

/* ──────────────────────── Atoms ──────────────────────── */

function Btn({
  variant = "primary",
  size,
  block,
  icon,
  iconRight,
  children,
  onClick,
  ...rest
}) {
  const cls = ["btn", `btn-${variant}`];
  if (size) cls.push(`btn-${size}`);
  if (block) cls.push("btn-block");
  return (
    <button className={cls.join(" ")} onClick={onClick} {...rest}>
      {icon}
      {children && <span>{children}</span>}
      {iconRight}
    </button>
  );
}

function Pill({ tone = "default", dot = false, icon, children }) {
  const cls = ["pill"];
  if (tone !== "default") cls.push(`pill-${tone}`);
  if (dot) cls.push("pill-dot");
  return (
    <span className={cls.join(" ")}>
      {icon}
      {children}
    </span>
  );
}

function VerifiedBadge({ label = "Verified seller" }) {
  return (
    <span className="verified-badge">
      <Icon.check />
      <span>{label}</span>
    </span>
  );
}

function Placeholder({ label, ratio, style }) {
  const s = { ...(style || {}) };
  if (ratio) s.aspectRatio = ratio;
  return (
    <div className="ph" style={s}>
      {label && <span className="ph-label">{label}</span>}
    </div>
  );
}

function Avatar({ name, size = 32 }) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `oklch(0.92 0.04 ${h})`,
        color: `oklch(0.35 0.08 ${h})`,
        fontSize: size * 0.36,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function Stars({ value = 0, size = 12 }) {
  return (
    <span style={{ display: "inline-flex", gap: 1, color: "var(--warn)" }}>
      {[1, 2, 3, 4, 5].map((i) =>
        i <= Math.round(value) ? (
          <Icon.star key={i} style={{ width: size, height: size }} />
        ) : (
          <Icon.starOutline
            key={i}
            style={{ width: size, height: size, color: "var(--line-2)" }}
          />
        ),
      )}
    </span>
  );
}

function Money({ cents, currency = "NGN", size }) {
  const amount = (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <span className="mono" style={{ fontSize: size, whiteSpace: "nowrap" }}>
      <span
        style={{ fontSize: "0.72em", color: "var(--ink-3)", marginRight: 4 }}
      >
        {currency}
      </span>
      {amount}
    </span>
  );
}

function SectionHeading({ eyebrow, title, action, actionHref, onAction }) {
  return (
    <div className="row-between" style={{ marginBottom: 16 }}>
      <div>
        {eyebrow && (
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            {eyebrow}
          </div>
        )}
        <div className="h2">{title}</div>
      </div>
      {action && (
        <button className="btn btn-ghost btn-sm" onClick={onAction}>
          {action} <Icon.arrowRight style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  );
}

function EscrowTimeline({ step = 1, dates = {} }) {
  const steps = [
    { id: 0, label: "Paid", icon: <Icon.card />, field: "paid" },
    { id: 1, label: "Shipped", icon: <Icon.truck />, field: "shipped" },
    { id: 2, label: "Delivered", icon: <Icon.package />, field: "delivered" },
    { id: 3, label: "Released", icon: <Icon.check />, field: "released" },
  ];
  const progress = step <= 0 ? 0 : (Math.min(step, 3) / 3) * 100;
  return (
    <div
      className="escrow-timeline show-progress"
      style={{ "--progress": `${progress}%` }}
    >
      {steps.map((s) => {
        const cls = s.id < step ? "done" : s.id === step ? "active" : "";
        return (
          <div key={s.id} className={`escrow-step ${cls}`}>
            <div className="escrow-dot" style={{ width: 28, height: 28 }}>
              {React.cloneElement(s.icon, { style: { width: 14, height: 14 } })}
            </div>
            <div>
              <div className="step-label">{s.label}</div>
              <div className="step-meta">
                {dates[s.field] ||
                  (s.id < step
                    ? "Done"
                    : s.id === step
                      ? "In progress"
                      : "Pending")}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrustStrip() {
  return (
    <div className="trust-strip">
      <div className="trust-cell">
        <Icon.lock style={{ width: 18, height: 18, color: "var(--escrow)" }} />
        <div className="h3">Escrow protected</div>
        <div className="lbl">
          Money held until you confirm receipt — every order, every seller.
        </div>
      </div>
      <div className="trust-cell">
        <Icon.shield
          style={{ width: 18, height: 18, color: "var(--escrow)" }}
        />
        <div className="h3">Verified sellers</div>
        <div className="lbl">
          KYC + phone verified. Look for the green check on every storefront.
        </div>
      </div>
      <div className="trust-cell">
        <Icon.chat style={{ width: 18, height: 18, color: "var(--escrow)" }} />
        <div className="h3">Negotiate in-app</div>
        <div className="lbl">
          Counter-offers, condition checks and shipping — all in one thread.
        </div>
      </div>
      <div className="trust-cell">
        <Icon.scale style={{ width: 18, height: 18, color: "var(--escrow)" }} />
        <div className="h3">Disputes resolved</div>
        <div className="lbl">
          Human reviewers settle issues in 48 hours, with full chat history.
        </div>
      </div>
    </div>
  );
}

function Qty({ value, onChange, min = 1, max = 99 }) {
  return (
    <div className="qty">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Decrease"
      >
        <Icon.minus style={{ width: 14, height: 14 }} />
      </button>
      <span>{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Increase"
      >
        <Icon.plus style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}

function Toast({ show, children }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: `translateX(-50%) translateY(${show ? 0 : 20}px)`,
        background: "var(--ink)",
        color: "var(--bg)",
        padding: "12px 18px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 500,
        boxShadow: "0 10px 30px -10px rgba(0,0,0,.3)",
        opacity: show ? 1 : 0,
        transition: "all .25s",
        zIndex: 100,
        pointerEvents: show ? "auto" : "none",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

Object.assign(window, {
  Icon,
  Btn,
  Pill,
  VerifiedBadge,
  Placeholder,
  Avatar,
  Stars,
  Money,
  SectionHeading,
  EscrowTimeline,
  TrustStrip,
  Qty,
  Toast,
});
