type SocialCardProps = {
  accent: string;
  eyebrow: string;
  footer: string;
  title: readonly [string, string];
};

export function SocialCard({ accent, eyebrow, footer, title }: SocialCardProps) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
        padding: "58px 64px",
        background: "#080808",
        color: "#f4f0e8",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: "-86px",
          bottom: "-250px",
          display: "flex",
          width: "610px",
          height: "610px",
          border: `2px solid ${accent}`,
          borderRadius: "50%",
          opacity: 0.68,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: "38px",
          bottom: "-124px",
          display: "flex",
          width: "356px",
          height: "356px",
          border: "1px solid rgba(244,240,232,0.34)",
          borderRadius: "50%",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        <span>DDC / 26</span>
        <span style={{ color: accent }}>{eyebrow}</span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 104,
          fontWeight: 800,
          letterSpacing: "-0.065em",
          lineHeight: 0.82,
        }}
      >
        <span>{title[0]}</span>
        <span style={{ color: accent }}>{title[1]}</span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            display: "flex",
            width: 13,
            height: 13,
            borderRadius: "50%",
            background: accent,
          }}
        />
        <span>{footer}</span>
      </div>
    </div>
  );
}
