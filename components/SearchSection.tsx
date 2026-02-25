"use client";

import { useState, useCallback, useEffect } from "react";
import { SearchBar } from "./SearchBar";
import { SlideGrid } from "./SlideGrid";
import type { Slide } from "@/lib/types";

export function SearchSection({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (initialQuery.trim()) {
      setQuery(initialQuery);
      setHasSearched(true);
      setIsSearching(true);
      fetch(`/api/slides/search?q=${encodeURIComponent(initialQuery.trim())}`)
        .then((res) => res.json())
        .then((data) => setSlides(Array.isArray(data) ? data : []))
        .catch(() => setSlides([]))
        .finally(() => setIsSearching(false));
    }
  }, [initialQuery]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setSlides([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const res = await fetch(
        `/api/slides/search?q=${encodeURIComponent(query.trim())}`
      );
      const data = await res.json();
      setSlides(Array.isArray(data) ? data : []);
    } catch {
      setSlides([]);
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <SearchBar
            value={query}
            onChange={setQuery}
            onKeyDown={handleKeyDown}
            placeholder="キーワード、タグ、タイトルで検索..."
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching}
          className="rounded-lg px-6 py-3 font-medium transition-colors disabled:opacity-50"
          style={{
            background: "var(--btn-primary-bg)",
            color: "var(--btn-primary-fg)",
          }}
        >
          {isSearching ? "検索中..." : "検索"}
        </button>
      </div>

      <div>
        {hasSearched ? (
          <SlideGrid slides={slides} isEmpty={query.trim() !== "" && slides.length === 0} />
        ) : (
          <SlideGrid slides={[]} />
        )}
      </div>
    </section>
  );
}
