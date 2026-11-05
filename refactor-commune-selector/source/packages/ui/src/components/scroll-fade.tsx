"use client";

import { cn } from "@chatvote/ui/lib/utils";
import {
	type CSSProperties,
	forwardRef,
	type HTMLAttributes,
	useEffect,
	useRef,
	useState,
} from "react";

const DEFAULT_FADE_PX = 28;
const EDGE_TOLERANCE_PX = 4;

interface ScrollFadeProps extends HTMLAttributes<HTMLDivElement> {
	/** Skip fading the bottom edge entirely. */
	disableBottom?: boolean;
	/** Skip fading the top edge entirely. */
	disableTop?: boolean;
	/** Fade band height in px. Default 28. */
	fadeSize?: number;
}

function maskGradient(top: boolean, bottom: boolean, fadeSize: number): string {
	const topStop = top ? "transparent" : "black";
	const bottomStop = bottom ? "transparent" : "black";
	return `linear-gradient(to bottom, ${topStop} 0px, black ${fadeSize}px, black calc(100% - ${fadeSize}px), ${bottomStop} 100%)`;
}

/**
 * Vertically scrollable area that fades its overflowing edges. Use as a
 * drop-in replacement for `<div className="overflow-y-auto …">` whenever a
 * scrollable region renders inline (chat transcripts, lists, doc bodies).
 *
 * Implementation: a CSS `mask-image` with stops that switch from `black` to
 * `transparent` only at edges that actually have content past them. No extra
 * DOM nodes; works with native scrollbars; reacts to scroll + resize.
 */
export const ScrollFade = forwardRef<HTMLDivElement, ScrollFadeProps>(
	function ScrollFade(
		{
			children,
			className,
			fadeSize = DEFAULT_FADE_PX,
			disableTop = false,
			disableBottom = false,
			style,
			...rest
		},
		forwardedRef
	) {
		const innerRef = useRef<HTMLDivElement | null>(null);
		const [topFaded, setTopFaded] = useState(false);
		const [bottomFaded, setBottomFaded] = useState(false);

		useEffect(() => {
			const el = innerRef.current;
			if (!el) {
				return;
			}
			const update = () => {
				const canFadeTop = !disableTop && el.scrollTop > EDGE_TOLERANCE_PX;
				const distanceFromBottom =
					el.scrollHeight - el.clientHeight - el.scrollTop;
				const canFadeBottom =
					!disableBottom && distanceFromBottom > EDGE_TOLERANCE_PX;
				setTopFaded(canFadeTop);
				setBottomFaded(canFadeBottom);
			};
			update();
			el.addEventListener("scroll", update, { passive: true });
			const observer = new ResizeObserver(update);
			observer.observe(el);
			// Re-check when children resize (streamed messages, async fetches).
			const mutationObserver = new MutationObserver(update);
			mutationObserver.observe(el, {
				childList: true,
				subtree: true,
				characterData: true,
			});
			return () => {
				el.removeEventListener("scroll", update);
				observer.disconnect();
				mutationObserver.disconnect();
			};
		}, [disableTop, disableBottom]);

		const mergedStyle: CSSProperties = {
			...style,
			maskImage: maskGradient(topFaded, bottomFaded, fadeSize),
			WebkitMaskImage: maskGradient(topFaded, bottomFaded, fadeSize),
		};

		return (
			<div
				className={cn("overflow-y-auto", className)}
				ref={(node) => {
					innerRef.current = node;
					if (typeof forwardedRef === "function") {
						forwardedRef(node);
					} else if (forwardedRef) {
						(forwardedRef as React.RefObject<HTMLDivElement | null>).current =
							node;
					}
				}}
				style={mergedStyle}
				{...rest}
			>
				{children}
			</div>
		);
	}
);
