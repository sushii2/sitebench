import type { LinkItemType } from "@/components/sheard";
import { HugeiconsIcon } from "@hugeicons/react";
import { Globe02Icon, Layers01Icon, UserAdd01Icon, Analytics02Icon, Plug01Icon, CodeIcon, UserMultipleIcon, StarIcon, Agreement02Icon, File02Icon, Shield01Icon, RotateLeft01Icon, Leaf01Icon, HelpCircleIcon } from "@hugeicons/core-free-icons";

export const productLinks: LinkItemType[] = [
	{
		label: "Website Builder",
		href: "#",
		description: "Create responsive websites with ease",
		icon: (
			<HugeiconsIcon icon={Globe02Icon} strokeWidth={2} />
		),
	},
	{
		label: "Cloud Platform",
		href: "#",
		description: "Deploy and scale apps in the cloud",
		icon: (
			<HugeiconsIcon icon={Layers01Icon} strokeWidth={2} />
		),
	},
	{
		label: "Team Collaboration",
		href: "#",
		description: "Tools to help your teams work better together",
		icon: (
			<HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} />
		),
	},
	{
		label: "Analytics",
		href: "#",
		description: "Track and analyze your website traffic",
		icon: (
			<HugeiconsIcon icon={Analytics02Icon} strokeWidth={2} />
		),
	},
	{
		label: "Integrations",
		href: "#",
		description: "Connect your apps and services",
		icon: (
			<HugeiconsIcon icon={Plug01Icon} strokeWidth={2} />
		),
	},
	{
		label: "API",
		href: "#",
		description: "Build custom integrations with our API",
		icon: (
			<HugeiconsIcon icon={CodeIcon} strokeWidth={2} />
		),
	},
];

export const companyLinks: LinkItemType[] = [
	{
		label: "About Us",
		href: "#",
		description: "Learn more about our story and team",
		icon: (
			<HugeiconsIcon icon={UserMultipleIcon} strokeWidth={2} />
		),
	},
	{
		label: "Customer Stories",
		href: "#",
		description: "See how we've helped our clients succeed",
		icon: (
			<HugeiconsIcon icon={StarIcon} strokeWidth={2} />
		),
	},
	{
		label: "Partnerships",
		href: "#",
		icon: (
			<HugeiconsIcon icon={Agreement02Icon} strokeWidth={2} />
		),
		description: "Collaborate with us for mutual growth",
	},
];

export const companyLinks2: LinkItemType[] = [
	{
		label: "Terms of Service",
		href: "#",
		icon: (
			<HugeiconsIcon icon={File02Icon} strokeWidth={2} />
		),
	},
	{
		label: "Privacy Policy",
		href: "#",
		icon: (
			<HugeiconsIcon icon={Shield01Icon} strokeWidth={2} />
		),
	},
	{
		label: "Refund Policy",
		href: "#",
		icon: (
			<HugeiconsIcon icon={RotateLeft01Icon} strokeWidth={2} />
		),
	},
	{
		label: "Blog",
		href: "#",
		icon: (
			<HugeiconsIcon icon={Leaf01Icon} strokeWidth={2} />
		),
	},
	{
		label: "Help Center",
		href: "#",
		icon: (
			<HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} />
		),
	},
];
