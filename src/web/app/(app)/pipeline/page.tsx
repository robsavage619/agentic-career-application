"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, X, ExternalLink, Clock, ChevronRight, Trash2, FileText, Users } from "lucide-react";
import { api, type PipelineCard, type PipelineStage } from "@/lib/api";
import { useProfile } from "@/lib/hooks/use-profile";

/* ── constants ── */
const STAGES: { id: PipelineStage; label: string }[] = [
  { id: "DISCOVERED", label: "Discovered" },
  { id: "APPLIED",    label: "Applied" },
  { id: "SCREENER",   label: "Screener" },
  { id: "INTERVIEW",  label: "Interview" },
  { id: "OFFER",      label: "Offer" },
  { id: "CLOSED",     label: "Closed" },
];

function stageColor(stage: PipelineStage): string {
  const map: Record<PipelineStage, string> = {
    DISCOVERED: "#484d63",
    APPLIED:    "rgba(var(--accent-rgb),0.8)",
    SCREENER:   "#60a5fa",
    INTERVIEW:  "#f59e0b",
    OFFER:      "#22c55e",
    CLOSED:     "#ef4444",
  };
  return map[stage];
}

/* ── Droppable column ── */
function Column({
  stage,
  cards,
  onAdd,
  onSelect,
}: {
  stage: { id: PipelineStage; label: string };
  cards: PipelineCard[];
  onAdd: (stage: PipelineStage) => void;
  onSelect: (card: PipelineCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const color = stageColor(stage.id);

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col gap-2 min-h-0 flex-1"
      style={{
        background: isOver ? "rgba(255,255,255,0.025)" : "transparent",
        borderRadius: 12,
        transition: "background 0.15s",
      }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          <span className="text-[0.62rem] font-semibold tracking-[0.14em] uppercase" style={{ color }}>
            {stage.label}
          </span>
          <span
            className="font-mono text-[0.58rem] px-1.5 py-0.5 rounded-full"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "#484d63",
            }}
          >
            {cards.length}
          </span>
        </div>
        <button
          onClick={() => onAdd(stage.id)}
          className="opacity-0 group-hover:opacity-100 rounded p-0.5 transition-all hover:text-[var(--accent)]"
          style={{ color: "#484d63" }}
          title="Add card"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 overflow-y-auto min-h-0 pb-2 px-1">
        {cards.map((card) => (
          <KanbanCard key={card.id} card={card} onSelect={onSelect} />
        ))}

        {/* Add button at bottom when empty */}
        <button
          onClick={() => onAdd(stage.id)}
          className="w-full rounded-lg py-2.5 text-[0.65rem] text-[#484d63] hover:text-[var(--accent)] hover:border-[rgba(var(--accent-rgb),0.2)] border border-dashed border-[rgba(255,255,255,0.06)] transition-all"
          style={{ background: "transparent" }}
        >
          <Plus size={11} className="inline mr-1" />
          Add
        </button>
      </div>
    </div>
  );
}

/* ── Draggable card ── */
function KanbanCard({
  card,
  onSelect,
  overlay = false,
}: {
  card: PipelineCard;
  onSelect: (card: PipelineCard) => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  const color = stageColor(card.stage);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(card)}
      style={{
        background: overlay ? "#1a1d26" : isDragging ? "transparent" : "#0e1015",
        border: isDragging ? "1px dashed rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10,
        padding: "10px 12px",
        cursor: overlay ? "grabbing" : "grab",
        opacity: isDragging ? 0.3 : 1,
        boxShadow: overlay ? "0 16px 40px rgba(0,0,0,0.6)" : "none",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[0.78rem] font-medium text-[#f1f1f3] truncate leading-tight">
            {card.title}
          </div>
          <div className="text-[0.65rem] text-[#484d63] mt-0.5">{card.company}</div>
        </div>
        <ChevronRight size={11} className="shrink-0 mt-0.5" style={{ color: "#484d63" }} />
      </div>

      {card.deadline && (
        <div className="flex items-center gap-1 mt-2">
          <Clock size={9} style={{ color }} />
          <span className="text-[0.6rem]" style={{ color }}>
            {new Date(card.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Add card modal ── */
function AddCardModal({
  defaultStage,
  profileId,
  onClose,
}: {
  defaultStage: PipelineStage;
  profileId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<PipelineStage>(defaultStage);

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.pipeline.create({ profile_id: profileId, title, company, url, stage }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline", profileId] });
      onClose();
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 12 }}
        style={{
          background: "#0e1015",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          padding: "1.75rem",
          width: 420,
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <span className="text-[0.9rem] font-semibold text-[#f1f1f3]">Add to Pipeline</span>
          <button onClick={onClose} style={{ color: "#484d63" }}><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <ModalField label="Role / Title" value={title} onChange={setTitle} placeholder="Sr. Product Manager" />
          <ModalField label="Company" value={company} onChange={setCompany} placeholder="Nike" />
          <ModalField label="Job URL" value={url} onChange={setUrl} placeholder="https://…" />
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.62rem] font-semibold tracking-[0.1em] uppercase text-[#484d63]">Stage</label>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStage(s.id)}
                  className="px-2.5 py-1 rounded-md text-[0.65rem] font-medium transition-all"
                  style={{
                    background: stage === s.id ? `rgba(var(--accent-rgb),0.15)` : "rgba(255,255,255,0.04)",
                    border: stage === s.id ? "1px solid rgba(var(--accent-rgb),0.4)" : "1px solid rgba(255,255,255,0.07)",
                    color: stage === s.id ? "var(--accent)" : "#8b8fa8",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg py-2 text-[0.72rem] font-medium transition-all"
            style={{ background: "rgba(255,255,255,0.04)", color: "#8b8fa8", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => mutate()}
            disabled={!title || !company || isPending}
            className="flex-1 rounded-lg py-2 text-[0.72rem] font-bold transition-all disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#000" }}
          >
            {isPending ? "Adding…" : "Add Card"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ModalField({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[0.62rem] font-semibold tracking-[0.1em] uppercase text-[#484d63]">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-[0.78rem] text-[#f1f1f3] outline-none transition-all placeholder:text-[#2a2d3a]"
        style={{
          background: "#13151c",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onFocus={(e) => { e.target.style.borderColor = "rgba(var(--accent-rgb),0.4)"; }}
        onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
      />
    </div>
  );
}

/* ── Card detail drawer ── */
function CardDrawer({
  card,
  onClose,
}: {
  card: PipelineCard;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const profileId = card.profile_id;
  const [notes, setNotes] = useState(card.notes);
  const [saving, setSaving] = useState(false);

  const { mutate: updateStage } = useMutation({
    mutationFn: (stage: PipelineStage) => api.pipeline.update(card.id, { stage }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline", profileId] }),
  });

  const { mutate: deleteCard } = useMutation({
    mutationFn: () => api.pipeline.delete(card.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline", profileId] });
      onClose();
    },
  });

  const saveNotes = useCallback(async () => {
    setSaving(true);
    await api.pipeline.update(card.id, { notes });
    await qc.invalidateQueries({ queryKey: ["pipeline", profileId] });
    setSaving(false);
  }, [notes, card.id, profileId, qc]);

  const color = stageColor(card.stage);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ x: 360 }}
        animate={{ x: 0 }}
        exit={{ x: 360 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="flex flex-col h-full overflow-y-auto"
        style={{
          width: 380,
          background: "#0b0d12",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          padding: "2rem 1.75rem",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0">
            <div className="text-[1rem] font-semibold text-[#f1f1f3] leading-snug">{card.title}</div>
            <div className="text-[0.7rem] text-[#484d63] mt-0.5">{card.company}</div>
          </div>
          <button onClick={onClose} className="ml-3 shrink-0 mt-0.5" style={{ color: "#484d63" }}>
            <X size={16} />
          </button>
        </div>

        {/* Stage selector */}
        <div className="mb-5">
          <div className="text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-[#484d63] mb-2">Stage</div>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => {
              const active = s.id === card.stage;
              const sColor = stageColor(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => updateStage(s.id)}
                  className="px-2.5 py-1 rounded-md text-[0.65rem] font-medium transition-all"
                  style={{
                    background: active ? `${sColor}18` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${active ? `${sColor}50` : "rgba(255,255,255,0.07)"}`,
                    color: active ? sColor : "#484d63",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* URL */}
        {card.url && (
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[0.7rem] mb-5 transition-colors hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            <ExternalLink size={11} />
            View job posting
          </a>
        )}

        {/* Deadline */}
        {card.deadline && (
          <div className="flex items-center gap-2 mb-5">
            <Clock size={12} style={{ color }} />
            <span className="text-[0.7rem]" style={{ color }}>
              Deadline: {new Date(card.deadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
        )}

        {/* Notes */}
        <div className="flex-1 flex flex-col mb-5">
          <div className="text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-[#484d63] mb-2">
            Notes
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this role…"
            className="flex-1 rounded-xl px-3 py-2.5 text-[0.75rem] text-[#f1f1f3] resize-none outline-none placeholder:text-[#2a2d3a]"
            style={{
              background: "#13151c",
              border: "1px solid rgba(255,255,255,0.07)",
              minHeight: 140,
            }}
            onFocus={(e) => { e.target.style.borderColor = "rgba(var(--accent-rgb),0.3)"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.07)"; }}
          />
          <button
            onClick={saveNotes}
            disabled={saving || notes === card.notes}
            className="mt-2 self-end text-[0.65rem] font-semibold transition-all disabled:opacity-30"
            style={{ color: "var(--accent)" }}
          >
            {saving ? "Saving…" : "Save notes"}
          </button>
        </div>

        {/* AI quick-actions */}
        <div
          className="rounded-xl p-3 mb-5 flex flex-col gap-2"
          style={{ background: "rgba(122,255,142,0.05)", border: "1px solid rgba(122,255,142,0.15)" }}
        >
          <div className="text-[0.6rem] font-semibold tracking-[0.12em] uppercase" style={{ color: "var(--accent)" }}>
            AI Actions
          </div>
          <Link
            href={`/interview-prep/${card.id}`}
            className="flex items-center gap-2 text-[0.78rem] font-medium transition-colors"
            style={{ color: "var(--accent)" }}
          >
            <Users size={12} />
            Prepare for interview
          </Link>
          <Link
            href={`/resume?card=${card.id}`}
            className="flex items-center gap-2 text-[0.72rem] font-medium text-[#8b8fa8] hover:text-[var(--accent)] transition-colors"
          >
            <FileText size={11} />
            Tailor resume
          </Link>
          <Link
            href={`/letters?card=${card.id}`}
            className="flex items-center gap-2 text-[0.72rem] font-medium text-[#8b8fa8] hover:text-[var(--accent)] transition-colors"
          >
            <FileText size={11} />
            Draft cover letter
          </Link>
        </div>

        {/* Delete */}
        <button
          onClick={() => deleteCard()}
          className="flex items-center gap-1.5 text-[0.65rem] self-start transition-colors hover:text-[#ef4444]"
          style={{ color: "#484d63" }}
        >
          <Trash2 size={11} />
          Delete card
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ── Main page ── */
export default function PipelinePage() {
  const profile = useProfile();
  const profileId = profile?.id;
  const qc = useQueryClient();

  const { data: rawCards } = useQuery({
    queryKey: ["pipeline", profileId],
    queryFn: () => api.pipeline.list(profileId!),
    enabled: !!profileId,
  });
  const cards = Array.isArray(rawCards) ? rawCards : [];

  const [addStage, setAddStage] = useState<PipelineStage | null>(null);
  const [selectedCard, setSelectedCard] = useState<PipelineCard | null>(null);
  const [draggingCard, setDraggingCard] = useState<PipelineCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const { mutate: moveCard } = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: PipelineStage }) =>
      api.pipeline.update(id, { stage }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: ["pipeline", profileId] });
      const prev = qc.getQueryData<PipelineCard[]>(["pipeline", profileId]);
      qc.setQueryData<PipelineCard[]>(["pipeline", profileId], (old) =>
        old?.map((c) => (c.id === id ? { ...c, stage } : c)) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["pipeline", profileId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["pipeline", profileId] }),
  });

  function onDragStart({ active }: DragStartEvent) {
    setDraggingCard(cards.find((c) => c.id === active.id) ?? null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setDraggingCard(null);
    if (!over) return;
    const card = cards.find((c) => c.id === active.id);
    const targetStage = over.id as PipelineStage;
    if (card && card.stage !== targetStage) {
      moveCard({ id: card.id, stage: targetStage });
    }
  }

  const byStage = (stage: PipelineStage) => cards.filter((c) => c.stage === stage);
  const active = cards.filter((c) => c.stage !== "CLOSED").length;
  const interviews = byStage("INTERVIEW").length;
  const offers = byStage("OFFER").length;

  return (
    <div className="flex flex-col h-full gap-5">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-end justify-between shrink-0"
      >
        <div>
          <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-[#f1f1f3]">Pipeline</h1>
        </div>
        <div className="flex items-center gap-4 text-[0.68rem] text-[#484d63]">
          <span>{active} active</span>
          <span>{interviews} interview{interviews !== 1 ? "s" : ""}</span>
          <span>{offers} offer{offers !== 1 ? "s" : ""}</span>
          <button
            onClick={() => setAddStage("DISCOVERED")}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.68rem] font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: "var(--accent)", color: "#000" }}
          >
            <Plus size={12} /> Add Card
          </button>
        </div>
      </motion.div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="group flex gap-3 flex-1 min-h-0"
        >
          {STAGES.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              cards={byStage(stage.id)}
              onAdd={setAddStage}
              onSelect={setSelectedCard}
            />
          ))}
        </motion.div>

        <DragOverlay>
          {draggingCard && (
            <KanbanCard card={draggingCard} onSelect={() => {}} overlay />
          )}
        </DragOverlay>
      </DndContext>

      {/* Modals */}
      <AnimatePresence>
        {addStage && profileId && (
          <AddCardModal
            key="add"
            defaultStage={addStage}
            profileId={profileId}
            onClose={() => setAddStage(null)}
          />
        )}
        {selectedCard && (
          <CardDrawer
            key={`drawer-${selectedCard.id}`}
            card={cards.find((c) => c.id === selectedCard.id) ?? selectedCard}
            onClose={() => setSelectedCard(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
