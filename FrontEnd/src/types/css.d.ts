import "react";

declare module "react" {
  // Allow CSS custom properties in style props: style={{ "--i": 2 }}
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
