"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SourceUrlUIPart, UIMessage } from "ai";
import { parseAsString, useQueryStates } from "nuqs";
import { Suspense, useCallback, useEffect, useRef } from "react";
import {
	ChatStartFlow,
	type StartSelection,
} from "@/components/chat/chat-start-flow";
import { CommuneSwitcher } from "@/components/chat/commune-switcher";
import { DocumentPanel } from "@/components/chat/document-panel";
import { CommuneTabs } from "@/components/conseil/commune-tabs";
import { ConseilView } from "@/components/conseil/conseil-view";
import { trpc } from "@/utils/trpc";

const chatSearchParams = {
	commune: parseAsString,
	chat: parseAsString,
	// Shared with ConseilView (same `conseilView` key). We register it here too —
	// without a default — so reopening a councils session can set it atomically
	// in the SAME setParams call (one history entry). ConseilView owns the
	// "list" default on the read side.
	conseilView: parseAsString,
	// Shared with ConseilNavControls / ConseilView (same `institutionId` key) so
	// the start flow can commit the chosen council institution atomically.
	institutionId: parseAsString,
};

// INSEE commune codes are exactly 5 digits (e.g. 75056 for Paris). Anything
// else in the `?commune=` query string is untrusted input — never render it
// raw, never use it as a DB key.
const INSEE_COMMUNE_CODE_REGEX = /^\d{5}$/;

function isValidCommuneCode(value: string | null | undefined): value is string {
	return typeof value === "string" && INSEE_COMMUNE_CODE_REGEX.test(value);
}

interface StoredMessage {
	content: string;
	createdAt: string | Date;
	id: string;
	parts: unknown;
	role: string;
	sources: unknown;
}

// Reconstruct UIMessage parts for legacy rows that predate the `parts` column:
// rebuild source-url parts from the stored `sources` JSON (so the Sources list
// and inline [N] citations survive) plus a single text part.
function legacyParts(msg: StoredMessage): UIMessage["parts"] {
	const rawSources = Array.isArray(msg.sources)
		? (msg.sources as Record<string, unknown>[])
		: [];
	const sourceParts: SourceUrlUIPart[] = rawSources.map((source, index) => ({
		type: "source-url",
		sourceId:
			typeof source.sourceId === "string"
				? source.sourceId
				: `source-${index + 1}`,
		url: typeof source.url === "string" ? source.url : "#",
		title: typeof source.title === "string" ? source.title : undefined,
		providerMetadata:
			source.providerMetadata as SourceUrlUIPart["providerMetadata"],
	}));
	return [...sourceParts, { type: "text", text: msg.content }];
}

// Convert stored DB messages to the UIMessage shape useChat expects. New rows
// carry the full serialized `parts` (text, sources, data widgets, tool calls) —
// use them verbatim so the rich content is restored. Legacy rows reconstruct.
function toUiMessages(messages: StoredMessage[]): UIMessage[] {
	return messages.map((msg) => ({
		id: msg.id,
		role: msg.role as UIMessage["role"],
		content: msg.content,
		parts:
			Array.isArray(msg.parts) && msg.parts.length > 0
				? (msg.parts as UIMessage["parts"])
				: legacyParts(msg),
		createdAt: new Date(msg.createdAt),
	}));
}

interface RestorablePanelProps {
	// False when viewing someone else's published chat → read-only ChatView.
	canEdit: boolean;
	chatId: string | null;
	chatViewKey: string;
	communeCode: string;
	initialMessages: UIMessage[] | undefined;
	isLoadingExistingSession: boolean;
	// Publish state of the restored session — drives the owner Share dialog copy.
	isPublic: boolean;
	onChatCreated: (chatId: string) => void;
	// Called after a viewer forks a shared chat — swaps `?chat=<newId>`.
	onForked: (chatId: string) => void;
	// True when the active session belongs to this panel's module. Gates the
	// restored chatId/messages so a session is never replayed on the wrong tab.
	restoreActive: boolean;
}

function ConseilsChatPanel({
	canEdit,
	chatId,
	chatViewKey,
	communeCode,
	initialMessages,
	isPublic,
	isLoadingExistingSession,
	restoreActive,
	onChatCreated,
	onForked,
}: RestorablePanelProps) {
	return (
		<ConseilView
			canEdit={restoreActive ? canEdit : true}
			chatId={restoreActive ? (chatId ?? undefined) : undefined}
			chatRestoreKey={chatViewKey}
			communeCode={communeCode}
			initialMessages={restoreActive ? initialMessages : undefined}
			// Gate on the page-level load flag (NOT restoreActive): isCouncils only
			// flips true once getSharedSession resolves, so gating on it would mount
			// ChatView empty during the load window and never remount once the
			// messages arrive (same key, and useChat reads initialMessages once).
			isLoadingSession={isLoadingExistingSession}
			isPublic={restoreActive ? isPublic : false}
			onChatCreated={onChatCreated}
			onForked={onForked}
		/>
	);
}

function ChatPageContent() {
	const [params, setParams] = useQueryStates(chatSearchParams);
	const { commune: rawCommuneParam, chat: chatId } = params;
	const queryClient = useQueryClient();

	// Reject anything that is not a 5-digit INSEE code. Invalid values fall
	// through to the empty-state CommuneSelector below — we never echo the raw
	// query parameter back into the DOM (XSS-adjacent + confusing UX).
	const communeCode = isValidCommuneCode(rawCommuneParam)
		? rawCommuneParam
		: null;
	const hasInvalidCommuneParam =
		rawCommuneParam !== null && !isValidCommuneCode(rawCommuneParam);

	// Strip a malformed `?commune=...` from the URL so the user doesn't keep
	// the bogus query string visible in the address bar. We do this in an
	// effect (not during render) because nuqs setters trigger router updates.
	useEffect(() => {
		if (hasInvalidCommuneParam) {
			setParams({ commune: null, chat: null }, { history: "replace" });
		}
	}, [hasInvalidCommuneParam, setParams]);

	// Track sessions created in this page lifecycle (skip loading gate for those)
	const createdSessionRef = useRef<string | null>(null);

	// Derive commune name from code. communeCode is already validated above
	// to match /^\d{5}$/, so it is safe to pass to the DB lookup.
	const { data: municipalityData } = useQuery({
		...trpc.commune.getByCode.queryOptions({
			communeCode: communeCode ?? "",
		}),
		enabled: !!communeCode,
	});
	// While the lookup is in flight, show the validated 5-digit code (safe —
	// regex-checked) rather than nothing. We never render arbitrary query
	// strings here.
	const communeName = municipalityData?.name ?? communeCode;

	// Load existing session messages when chatId is in the URL.
	// getSharedSession is the public read path: owners load their own session
	// (canEdit=true), non-owners load it only when it is published. It throws
	// NOT_FOUND (missing) / FORBIDDEN (private + not yours) — both collapse to
	// the same empty-state UI. retry:false stops React Query from hammering a
	// permanently-unreachable session.
	const {
		data: sessionData,
		isLoading: isSessionLoading,
		isError: isSessionError,
	} = useQuery({
		...trpc.chat.getSharedSession.queryOptions({ sessionId: chatId ?? "" }),
		enabled: !!chatId,
		retry: false,
	});

	// If the requested session can't be loaded (deleted / belongs to someone
	// else), drop the stale chatId from the URL so the user lands on a
	// fresh-chat state instead of staring at a perpetual loader.
	useEffect(() => {
		if (isSessionError && chatId) {
			setParams({ chat: null }, { history: "replace" });
		}
	}, [isSessionError, chatId, setParams]);

	// On direct URL load (?chat=… pasted without ?tab/?conseilView), align the
	// domain tab to the session's module once per session id, then leave the
	// user free to switch tabs.
	const alignedChatRef = useRef<string | null>(null);
	useEffect(() => {
		if (!(sessionData && chatId) || alignedChatRef.current === chatId) {
			return;
		}
		alignedChatRef.current = chatId;
		if (sessionData.session.module === "councils") {
			setParams({ conseilView: "chat" }, { history: "replace" });
		}
	}, [sessionData, chatId, setParams]);

	const handleCommuneSelect = useCallback(
		(code: string) => {
			// Push a new history entry so the browser back button restores the
			// commune-selection step instead of skipping past it.
			setParams({ commune: code, chat: null }, { history: "push" });
		},
		[setParams]
	);

	// Commit the upfront start flow (commune + institution) in one atomic URL
	// update so the chat opens already scoped and the LLM receives both.
	const handleStartComplete = useCallback(
		(selection: StartSelection) => {
			createdSessionRef.current = null;
			setParams(
				{
					commune: selection.communeCode,
					chat: null,
					conseilView: "chat",
					institutionId: selection.institutionId ?? null,
				},
				{ history: "push" }
			);
		},
		[setParams]
	);

	const handleChatCreated = useCallback(
		(newChatId: string) => {
			createdSessionRef.current = newChatId;
			// Push a history entry per new chat session so browser back
			// re-opens the previous chat (or the empty state) instead of
			// jumping out of the chat page entirely.
			setParams({ chat: newChatId }, { history: "push" });
			// Surface the brand-new session in the history sidebar immediately
			// instead of waiting for the next natural refetch.
			queryClient.invalidateQueries({
				queryKey: trpc.chat.listSessions.queryKey(),
			});
		},
		[setParams, queryClient]
	);

	// Session selection + "Nouveau chat" are now owned by ChatHistoryList
	// (mounted inside AppSidebar). It writes the URL itself via router.push,
	// so this page reacts to the resulting nuqs param change.

	// Gate ChatView: wait for session data on page load, but not after creating
	// a new session.
	const isLoadingExistingSession =
		!!chatId && isSessionLoading && createdSessionRef.current !== chatId;

	// Route the restored session to the council ChatView only when it matches.
	const sessionModule = sessionData?.session.module;
	const isCouncilsSession = !!chatId && sessionModule === "councils";

	// Read/write gate for the restored session. A brand-new chat (no chatId yet)
	// is always editable. getSharedSession returns canEdit=false for non-owners
	// viewing a published chat → read-only ChatView with a fork action.
	const canEdit = !chatId || (sessionData?.canEdit ?? true);
	const isSessionPublic = sessionData?.session.isPublic ?? false;

	// Key the ChatView by commune + the session being *restored*: switching
	// commune OR session forces a fresh mount, so the new conversation never
	// shows the previous commune's messages and useChat re-reads initialMessages
	// (which it only does once). A session just created in this view keeps the
	// stable "<commune>:live" key — commune is unchanged during creation — so its
	// in-flight stream is never torn down mid-creation.
	const sessionKeyPart =
		chatId && createdSessionRef.current !== chatId ? chatId : "live";
	const chatViewKey = `${communeCode ?? "none"}:${sessionKeyPart}`;

	const initialMessages = sessionData?.messages
		? toUiMessages(sessionData.messages)
		: undefined;

	// Props common to both panels. `communeCode` and `restoreActive` are
	// per-panel and supplied at each call site (so the shared object can't carry
	// a misleading always-overridden default). A fork redirects exactly like a
	// new session: swap `?chat=<newId>`, preserve the rest, refresh the sidebar.
	const sharedPanelProps = {
		canEdit,
		chatId,
		chatViewKey,
		initialMessages,
		isPublic: isSessionPublic,
		isLoadingExistingSession,
		onChatCreated: handleChatCreated,
		onForked: handleChatCreated,
	} satisfies Omit<RestorablePanelProps, "communeCode" | "restoreActive">;

	return (
		<div className="flex h-full overflow-hidden">
			<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
				{communeCode ? (
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
						{/* Unified nav bar (commune · domaine · institution · vue) lives
						    in CommuneTabs; the commune switcher is its left slot. */}
						<CommuneTabs
							communeSwitcher={
								<CommuneSwitcher
									communeCode={communeCode}
									communeName={communeName ?? communeCode}
									onSelect={handleCommuneSelect}
								/>
							}
							conseilContent={
								<ConseilsChatPanel
									{...sharedPanelProps}
									communeCode={communeCode}
									restoreActive={isCouncilsSession}
								/>
							}
						/>
					</div>
				) : (
					<ChatStartFlow onComplete={handleStartComplete} />
				)}
			</div>
			{/* Right-side PV viewer — renders only when `?doc` is set; an in-flow
			    split column on lg, a fixed overlay below. */}
			<DocumentPanel />
		</div>
	);
}

export default function ChatPage() {
	return (
		<Suspense
			fallback={
				<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
					Chargement...
				</div>
			}
		>
			<ChatPageContent />
		</Suspense>
	);
}
