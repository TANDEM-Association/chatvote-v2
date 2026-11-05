"use client";

import { Skeleton } from "@chatvote/ui/components/skeleton";
import { cn } from "@chatvote/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronLeft, Landmark } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { CommuneSelector } from "@/components/chat/commune-selector";
import { PartnerBadges } from "@/components/partner-badges";
import { trackClientEvent } from "@/lib/observability/logger-client";
import { trpc } from "@/utils/trpc";

type StartModule = "councils";

export interface StartSelection {
	communeCode: string;
	institutionId?: string;
	module: StartModule;
}

function StepDots({ current, total }: { current: number; total: number }) {
	return (
		<div className="flex items-center justify-center gap-1.5">
			{Array.from({ length: total }, (_, i) => i).map((i) => (
				<span
					className={cn(
						"h-1.5 rounded-full transition-all",
						i === current ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
					)}
					key={i}
				/>
			))}
		</div>
	);
}

function BrandMark() {
	return (
		<div className="flex flex-col items-center gap-3">
			<Image
				alt="ChatVote"
				className="h-auto w-20 drop-shadow-[0_0_32px_rgba(99,102,241,0.15)] md:w-[112px]"
				height={112}
				priority
				src="/images/logos/chatvote.svg"
				width={112}
			/>
			<h1 className="font-bold text-2xl">ChatVote</h1>
		</div>
	);
}

function ModuleCard({
	icon,
	title,
	description,
	onClick,
}: {
	description: string;
	icon: React.ReactNode;
	onClick: () => void;
	title: string;
}) {
	return (
		<button
			className="group flex h-full flex-col items-start gap-2 rounded-xl border border-border/60 bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
			onClick={onClick}
			type="button"
		>
			<span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
				{icon}
			</span>
			<span className="font-medium text-sm">{title}</span>
			<span className="text-muted-foreground text-xs">{description}</span>
		</button>
	);
}

function ModuleStep({ onPick }: { onPick: (m: StartModule) => void }) {
	return (
		<div className="grid grid-cols-1 gap-3">
			<ModuleCard
				description="Décisions, délibérations et procès-verbaux des conseils."
				icon={<Landmark className="size-5" />}
				onClick={() => onPick("councils")}
				title="Conseils municipaux"
			/>
		</div>
	);
}

function InstitutionStep({
	communeCode,
	onPick,
}: {
	communeCode: string;
	onPick: (institutionId?: string) => void;
}) {
	const { data, isLoading } = useQuery(
		trpc.commune.getInstitutions.queryOptions({
			communeCode,
		})
	);

	// 0 or 1 covering institution → nothing to choose; complete automatically.
	// Guard so the auto-complete fires once (the parent unmounts us on commit).
	const autoDone = useRef(false);
	useEffect(() => {
		if (isLoading || autoDone.current || !data || data.length > 1) {
			return;
		}
		autoDone.current = true;
		onPick(data[0]?.institutionId);
	}, [isLoading, data, onPick]);

	if (isLoading) {
		return (
			<div className="space-y-2">
				<Skeleton className="h-12 w-full rounded-lg" />
				<Skeleton className="h-12 w-full rounded-lg" />
			</div>
		);
	}

	if (!data || data.length <= 1) {
		return (
			<p className="text-center text-muted-foreground text-xs">Chargement…</p>
		);
	}

	return (
		<ul className="flex flex-col gap-2">
			{data.map((inst) => (
				<li key={inst.institutionId}>
					<button
						className="flex w-full items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3.5 py-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
						onClick={() => onPick(inst.institutionId)}
						type="button"
					>
						<Building2 className="size-4 shrink-0 text-muted-foreground" />
						<span className="truncate">
							{inst.institutionName ?? inst.institutionId}
						</span>
					</button>
				</li>
			))}
		</ul>
	);
}

const STEP_TITLES = [
	"Quelle commune ?",
	"Que voulez-vous consulter ?",
	"Quelle institution ?",
] as const;

const STEP_SUBTITLES = [
	"Renseignez votre commune ou code postal.",
	"Choisissez le domaine de votre question.",
	"Sélectionnez le conseil concerné.",
] as const;

/**
 * Guided 3-step entry: commune → module → (councils only) institution. Commits
 * the full selection in one go so the chat opens already scoped — and the LLM
 * receives all three. Replaces the old land-then-toggle-tabs flow.
 */
export function ChatStartFlow({
	onComplete,
}: {
	onComplete: (selection: StartSelection) => void;
}) {
	const [communeCode, setCommuneCode] = useState<string | null>(null);
	const [module, setModule] = useState<StartModule | null>(null);

	let step = 0;
	if (communeCode) {
		step = module ? 2 : 1;
	}

	const handleModule = (picked: StartModule) => {
		setModule(picked);
	};

	const handleBack = () => {
		if (module) {
			setModule(null);
			return;
		}
		setCommuneCode(null);
	};

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
			<div className="w-full max-w-md space-y-6">
				<div className="space-y-3 text-center">
					<BrandMark />
					<StepDots current={step} total={3} />
					<div className="space-y-1">
						<h2 className="font-medium text-base">{STEP_TITLES[step]}</h2>
						<p className="text-muted-foreground text-sm">
							{STEP_SUBTITLES[step]}
						</p>
					</div>
				</div>

				{step > 0 && (
					<button
						className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
						onClick={handleBack}
						type="button"
					>
						<ChevronLeft className="size-3.5" />
						Retour
					</button>
				)}

				{step === 0 && <CommuneSelector onSelect={setCommuneCode} />}
				{step === 0 && <PartnerBadges />}
				{step === 1 && <ModuleStep onPick={handleModule} />}
				{step === 2 && communeCode && (
					<InstitutionStep
						communeCode={communeCode}
						onPick={(institutionId) => {
							trackClientEvent("candidate_selected", {
								commune_code: communeCode,
								module: "councils",
							});
							onComplete({ communeCode, institutionId, module: "councils" });
						}}
					/>
				)}

				<p className="text-center text-muted-foreground text-xs">
					ChatVote fournit des informations neutres et sourcées.
				</p>
			</div>
		</div>
	);
}
