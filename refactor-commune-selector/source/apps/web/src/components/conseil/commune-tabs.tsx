"use client";

import { ScrollFade } from "@chatvote/ui/components/scroll-fade";
import type { ReactNode } from "react";

import { ConseilNavControls } from "./conseil-nav-controls";

interface CommuneTabsProps {
	communeSwitcher?: ReactNode;
	conseilContent: ReactNode;
}

// The election domain is decommissioned: conseil is the only surface, so the
// domain tab bar is gone. Kept as a thin wrapper so the commune switcher and
// conseil nav controls stay co-located.
export function CommuneTabs({
	communeSwitcher,
	conseilContent,
}: CommuneTabsProps) {
	return (
		<div className="flex h-full flex-col">
			{/* Unified nav bar: commune (left) · conseil controls (right) */}
			<nav
				aria-label="Navigation du conseil municipal"
				className="flex h-14 shrink-0 items-center gap-2 border-border/60 border-b bg-background px-4"
			>
				{communeSwitcher}
				<ConseilNavControls />
			</nav>

			{/* Content */}
			<ScrollFade className="min-h-0 flex-1">{conseilContent}</ScrollFade>
		</div>
	);
}
