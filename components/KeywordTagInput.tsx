"use client";

import { useState, useCallback, KeyboardEvent } from "react";

interface KeywordTagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function KeywordTagInput({
  tags,
  onChange,
  placeholder = "キーワードを入力してカンマまたはEnterで追加",
  disabled = false,
}: KeywordTagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const addTag = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed && !tags.includes(trimmed)) {
        onChange([...tags, trimmed]);
      }
    },
    [tags, onChange]
  );

  const removeTag = useCallback(
    (index: number) => {
      onChange(tags.filter((_, i) => i !== index));
      setEditingIndex(null);
    },
    [tags, onChange]
  );

  const updateTag = useCallback(
    (index: number, newValue: string) => {
      const trimmed = newValue.trim();
      if (trimmed) {
        const newTags = [...tags];
        newTags[index] = trimmed;
        onChange(newTags);
      }
      setEditingIndex(null);
    },
    [tags, onChange]
  );

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (editingIndex !== null) return;

    if (e.key === "," || e.key === "Enter" || e.key === "、") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
        setInputValue("");
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditingValue(tags[index]);
  };

  const finishEditing = () => {
    if (editingIndex !== null) {
      const trimmed = editingValue.trim();
      if (trimmed) {
        updateTag(editingIndex, trimmed);
      } else {
        removeTag(editingIndex);
      }
      setEditingIndex(null);
      setEditingValue("");
    }
  };

  const handleEditingKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finishEditing();
    } else if (e.key === "Escape") {
      setEditingIndex(null);
      setEditingValue("");
    }
  };

  return (
    <div className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2">
      {tags.map((tag, index) =>
        editingIndex === index ? (
          <input
            key={`edit-${index}`}
            type="text"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={finishEditing}
            onKeyDown={handleEditingKeyDown}
            autoFocus
            className="w-24 rounded border border-neutral-400 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-500"
          />
        ) : (
          <span
            key={`${tag}-${index}`}
            className="group inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2.5 py-1 text-sm text-neutral-800"
          >
            <button
              type="button"
              onClick={() => startEditing(index)}
              className="max-w-[180px] truncate text-left hover:underline"
              title="クリックで編集"
            >
              {tag}
            </button>
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="ml-0.5 shrink-0 rounded p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800"
              aria-label="削除"
            >
              ×
            </button>
          </span>
        )
      )}
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        disabled={disabled}
        className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0.5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0 disabled:opacity-50"
      />
    </div>
  );
}
