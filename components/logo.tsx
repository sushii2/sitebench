import type React from "react";

export const Logo = ({
	className,
	alt = "Sitebench",
	...props
}: Omit<React.ComponentProps<"img">, "src">) => (
	// biome-ignore lint/performance/noImgElement: inline SVG asset, no LCP concern
	<img
		alt={alt}
		className={className}
		src="/bench.svg"
		{...props}
	/>
);

export const LogoIcon = Logo;
