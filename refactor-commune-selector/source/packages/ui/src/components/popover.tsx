"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@chatvote/ui/lib/utils";

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
	return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
	return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverPortal({ ...props }: PopoverPrimitive.Portal.Props) {
	return <PopoverPrimitive.Portal data-slot="popover-portal" {...props} />;
}

function PopoverContent({
	align = "center",
	side = "bottom",
	sideOffset = 6,
	className,
	...props
}: PopoverPrimitive.Popup.Props &
	Pick<PopoverPrimitive.Positioner.Props, "align" | "side" | "sideOffset">) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner
				align={align}
				className="isolate z-50 outline-none"
				side={side}
				sideOffset={sideOffset}
			>
				<PopoverPrimitive.Popup
					className={cn(
						"data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 z-50 origin-(--transform-origin) rounded-sm bg-popover p-3 text-popover-foreground shadow-md outline-none ring-1 ring-foreground/10 duration-100 data-closed:animate-out data-open:animate-in",
						className
					)}
					data-slot="popover-content"
					{...props}
				/>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
}

export { Popover, PopoverContent, PopoverPortal, PopoverTrigger };
