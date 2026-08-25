"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Paperclip, Reply, Send, Smile, X } from "lucide-react";
import { sendMessageAction, sendTypingAction } from "@/app/(dashboard)/chat/actions";
import { UserAvatar } from "./user-avatar";
import { Emoji } from "./emoji";
import { EMOJI_LIST } from "@/lib/chat/emoji-list";
import type { ChatMessage, ChatUser } from "./types";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
]);
// Fires at most once per this window while the user keeps typing, matching
// the granularity a "typing…" indicator actually needs — no point relaying
// an event per keystroke.
const TYPING_THROTTLE_MS = 3000;

export function Composer({
  conversationId,
  currentUser,
  mentionCandidates,
  onOptimisticSend,
  onSent,
  replyTarget,
  onClearReply,
}: {
  conversationId: string;
  currentUser: ChatUser;
  /** Users eligible to be @mentioned here — empty in DMs, matching the backend's notifyMentions rule that mentions only fire in channels. */
  mentionCandidates: ChatUser[];
  onOptimisticSend: (message: ChatMessage) => void;
  onSent: () => Promise<void>;
  replyTarget: ChatMessage | null;
  onClearReply: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentRef = useRef(0);

  // Object URLs are only revoked here (not left for GC) — each one holds a
  // reference to the underlying file blob in memory for as long as it's
  // alive, and a chat session can involve picking/clearing many attachments
  // in a row without a page reload in between.
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (replyTarget) textareaRef.current?.focus();
  }, [replyTarget]);

  // Grows with content up to max-h-32 (set on the textarea itself) instead
  // of staying pinned at rows={1} and relying on internal scroll — a
  // multi-line message is common with markdown/code in play now, and a
  // fixed-height box that scrolls internally reads as broken next to every
  // other growing-textarea composer (Slack, Linear, GitHub).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // Tracks the @-trigger position so a pick can replace exactly the "@query"
  // span being typed, and so the query re-derives from the textarea's actual
  // current value on every keystroke rather than being tracked separately.
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [highlightedMention, setHighlightedMention] = useState(0);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showEmojiPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  // Inserts at the current caret position (falling back to the end if the
  // textarea never had focus yet), matching pickMention's own approach —
  // clicking an emoji shouldn't force the cursor to jump to the end of
  // whatever's already been typed.
  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? value.length;
    const next = value.slice(0, caret) + emoji + value.slice(caret);
    setValue(next);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = caret + emoji.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  const mentionQuery = mentionStart !== null ? value.slice(mentionStart + 1, textareaRef.current?.selectionStart ?? value.length) : null;
  const mentionResults = useMemo(() => {
    if (mentionQuery === null || mentionCandidates.length === 0) return [];
    const q = mentionQuery.toLowerCase();
    return mentionCandidates.filter((u) => u.displayName.toLowerCase().includes(q)).slice(0, 6);
  }, [mentionQuery, mentionCandidates]);
  const showMentionMenu = mentionResults.length > 0;

  function pickMention(user: ChatUser) {
    if (mentionStart === null) return;
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(caret);
    // A trailing space after the inserted name keeps the mention's regex
    // boundary intact and lets the user keep typing without touching "@".
    const next = `${before}@${user.displayName} ${after}`;
    setValue(next);
    setMentionStart(null);
    setHighlightedMention(0);
    requestAnimationFrame(() => {
      const pos = before.length + user.displayName.length + 2;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setValue(next);
    handleTyping();

    const caret = e.target.selectionStart;
    // Find the nearest unclosed "@" before the caret, on the current line
    // (a space or newline ends the candidate word) — matches the same
    // "@word" shape splitMessageSegments looks for when rendering.
    const uptoCaret = next.slice(0, caret);
    const atIndex = uptoCaret.lastIndexOf("@");
    if (atIndex === -1 || /[\s]/.test(uptoCaret.slice(atIndex + 1))) {
      setMentionStart(null);
      return;
    }
    const precedingChar = atIndex > 0 ? uptoCaret[atIndex - 1] : "";
    if (precedingChar && !/\s/.test(precedingChar)) {
      // "@" is mid-word (e.g. an email address) — not a mention trigger.
      setMentionStart(null);
      return;
    }
    setMentionStart(atIndex);
    setHighlightedMention(0);
  }

  function handleTyping() {
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    void sendTypingAction(conversationId);
  }

  function handleFilePick(picked: File | null) {
    setError(null);
    if (!picked) {
      setFile(null);
      return;
    }
    if (picked.size > MAX_ATTACHMENT_BYTES) {
      setError("File too large (max 5MB)");
      return;
    }
    if (!ALLOWED_ATTACHMENT_TYPES.has(picked.type)) {
      setError("File type not allowed");
      return;
    }
    setFile(picked);
  }

  function send() {
    const body = value.trim();
    if (!body && !file) return;
    setError(null);
    setValue("");
    setMentionStart(null);
    const pickedFile = file;
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const replyingTo = replyTarget;
    onClearReply();

    onOptimisticSend({
      id: `pending-${Date.now()}`,
      conversationId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatarUrl: currentUser.avatarUrl,
      body,
      createdAt: new Date().toISOString(),
      reactions: [],
      attachment: pickedFile
        ? { name: pickedFile.name, type: pickedFile.type, size: pickedFile.size, url: URL.createObjectURL(pickedFile) }
        : null,
      pending: true,
      replyTo: replyingTo ? { id: replyingTo.id, senderName: replyingTo.senderName, body: replyingTo.body } : null,
    });

    const formData = new FormData();
    formData.set("conversationId", conversationId);
    formData.set("body", body);
    if (pickedFile) formData.set("attachment", pickedFile);
    if (replyingTo) formData.set("replyToId", replyingTo.id);
    startTransition(async () => {
      // sendMessageAction returning {error} was already handled below, but an
      // unhandled throw (a transient DB/session error rather than a
      // validation failure) previously propagated out of this async
      // callback entirely: onSent() never ran, no error ever reached the
      // user, and the optimistic message stayed on screen with nothing to
      // reconcile it against — it looked sent but was never actually saved.
      try {
        const result = await sendMessageAction({}, formData);
        if (result.error) {
          setError(result.error);
          setValue(body);
          setFile(pickedFile);
        }
      } catch {
        setError("Message failed to send. Please try again.");
        setValue(body);
        setFile(pickedFile);
      } finally {
        await onSent();
      }
    });
  }

  return (
    <div className="relative border-t border-border px-4 py-3">
      {showMentionMenu && (
        <div className="absolute bottom-full left-4 z-10 mb-1.5 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-[var(--shadow-overlay)]">
          {mentionResults.map((user, i) => (
            <button
              key={user.id}
              type="button"
              onMouseEnter={() => setHighlightedMention(i)}
              onClick={() => pickMention(user)}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] transition-colors ${i === highlightedMention ? "bg-muted" : "hover:bg-muted/60"}`}
            >
              <UserAvatar name={user.displayName} avatarUrl={user.avatarUrl} size="sm" />
              <span className="truncate text-foreground">{user.displayName}</span>
            </button>
          ))}
        </div>
      )}
      {replyTarget && (
        <div className="mb-1.5 flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5">
          <Reply className="size-3.5 shrink-0 -scale-x-100 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">
            Replying to <span className="font-medium">{replyTarget.senderName}</span>: {replyTarget.body}
          </span>
          <button type="button" onClick={onClearReply} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Cancel reply">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {error && <p className="mb-1.5 text-xs text-destructive">{error}</p>}
      {file && (
        <div className="mb-1.5 flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5">
          {filePreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- transient local blob: URL, not an optimizable static/S3 asset
            <img src={filePreviewUrl} alt="" className="size-9 shrink-0 rounded object-cover" />
          ) : (
            <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">{file.name}</span>
          <button
            type="button"
            onClick={() => handleFilePick(null)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Remove attachment"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/10">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/csv"
          className="hidden"
          onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Attach a file"
        >
          <Paperclip className="size-3.5" />
        </button>
        <div className="relative" ref={emojiPickerRef}>
          <button
            type="button"
            onClick={() => setShowEmojiPicker((v) => !v)}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Add emoji"
          >
            <Smile className="size-3.5" />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 z-10 mb-1.5 grid w-56 grid-cols-6 gap-0.5 rounded-lg border border-border bg-popover p-1.5 shadow-[var(--shadow-overlay)]">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="flex size-7 items-center justify-center rounded hover:bg-muted"
                >
                  <Emoji emoji={emoji} className="size-5" />
                </button>
              ))}
            </div>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleTextareaChange}
          onKeyDown={(e) => {
            if (showMentionMenu) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedMention((i) => Math.min(i + 1, mentionResults.length - 1));
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedMention((i) => Math.max(i - 1, 0));
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                pickMention(mentionResults[highlightedMention]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setMentionStart(null);
                return;
              }
            }
            if (e.key === "Escape" && replyTarget) {
              onClearReply();
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message…"
          rows={1}
          className="max-h-32 min-h-6 flex-1 resize-none overflow-y-auto bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={send}
          disabled={isPending || (!value.trim() && !file)}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--primary)" }}
          aria-label="Send message"
        >
          <Send className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
