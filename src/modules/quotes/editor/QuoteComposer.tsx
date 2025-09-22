import React, { useState, useEffect } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import CardWrapper from "./CardWrapper";
import HeaderCard from "./HeaderCard";
import TextCard from "./TextCard";
import TableCard from "./TableCard";
import DividerCard from "./DividerCard";
import FooterCard from "./FooterCard";

export type CardType = "header" | "text" | "table" | "divider" | "footer";

export interface CardData {
  id: string;
  type: CardType;
  content: any;
}

interface Props {
  value?: CardData[];                     // 父層傳入的初始 Schema
  onChange?: (cards: CardData[]) => void; // 每次更新時通知父層
}

export default function QuoteComposer({ value, onChange }: Props) {
  const [cards, setCards] = useState<CardData[]>(
    value && value.length > 0
      ? value
      : [
          { id: "1", type: "header", content: { text: "報價單" } },
          { id: "2", type: "table", content: { rows: [] } },
        ]
  );

  // 當父層 value 改變時同步
  useEffect(() => {
    if (value) setCards(value);
  }, [value]);

  // 每次更新時呼叫父層 onChange
  const updateCards = (next: CardData[]) => {
    setCards(next);
    onChange?.(next);
  };

  const addCard = (type: CardType) => {
    const newCard: CardData = {
      id: Date.now().toString(),
      type,
      content: type === "table" ? { rows: [] } : {},
    };
    updateCards([...cards, newCard]);
  };

  const updateCard = (id: string, content: any) => {
    updateCards(cards.map((c) => (c.id === id ? { ...c, content } : c)));
  };

  return (
    <div className="space-y-4">
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (over && active.id !== over.id) {
            const oldIndex = cards.findIndex((i) => i.id === active.id);
            const newIndex = cards.findIndex((i) => i.id === over.id);
            updateCards(arrayMove(cards, oldIndex, newIndex));
          }
        }}
      >
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <CardWrapper key={card.id} id={card.id}>
              {card.type === "header" && (
                <HeaderCard
                  content={card.content}
                  onChange={(c) => updateCard(card.id, c)}
                />
              )}
              {card.type === "text" && (
                <TextCard
                  content={card.content}
                  onChange={(c) => updateCard(card.id, c)}
                />
              )}
              {card.type === "table" && (
                <TableCard
                  content={card.content}
                  onChange={(c) => updateCard(card.id, c)}
                />
              )}
              {card.type === "divider" && <DividerCard />}
              {card.type === "footer" && (
                <FooterCard
                  content={card.content}
                  onChange={(c) => updateCard(card.id, c)}
                />
              )}
            </CardWrapper>
          ))}
        </SortableContext>
      </DndContext>

      {/* 新增卡片 */}
      <div className="flex gap-2">
        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => addCard("text")}>+ 文字</button>
        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => addCard("table")}>+ 表格</button>
        {/* 圖片請改在「畫布模式」中新增（支援拖曳/縮放/貼齊） */}
      </div>
    </div>
  );
}
