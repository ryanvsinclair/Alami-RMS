"use client";

import { useEffect, useRef, useState } from "react";
import {
  autocompletePlaces,
  getPlaceDetails,
  loadGooglePlaces,
  type PlaceDetails,
  type PlacePrediction,
} from "@/features/shopping/integrations/google-places.client";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function RestaurantPlaceSearch() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [selected, setSelected] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  // Load the Google Places SDK once
  useEffect(() => {
    if (!API_KEY) return;
    loadGooglePlaces(API_KEY)
      .then(() => setReady(true))
      .catch(() => {/* places unavailable — degrade silently */});
  }, []);

  // Debounced autocomplete
  useEffect(() => {
    if (!ready) return;
    if (!query.trim() || selected) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await autocompletePlaces(query.trim(), "ca");
        setSuggestions(results);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, ready, selected]);

  async function handleSelect(prediction: PlacePrediction) {
    setError("");
    setLoading(true);
    try {
      const details = await getPlaceDetails(prediction.place_id);
      setSelected(details);
      setQuery(details.name);
      setSuggestions([]);
    } catch {
      setError("Could not load place details. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setSelected(null);
    setQuery("");
    setSuggestions([]);
    setError("");
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border/70 bg-foreground/[0.02] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Restaurant place (optional)
      </p>
      <p className="text-xs text-muted/80">
        If you selected Restaurant, search for your business to attach Google Place metadata now, or skip and add it later.
      </p>

      {/* Hidden fields consumed by signUpAction */}
      <input type="hidden" name="google_place_id"   value={selected?.place_id        ?? ""} />
      <input type="hidden" name="formatted_address" value={selected?.formatted_address ?? ""} />
      <input type="hidden" name="place_latitude"    value={selected ? String(selected.lat) : ""} />
      <input type="hidden" name="place_longitude"   value={selected ? String(selected.lng) : ""} />

      {selected ? (
        /* Confirmed state */
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-foreground/[0.04] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{selected.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted">{selected.formatted_address}</p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            Change
          </button>
        </div>
      ) : (
        /* Search input + dropdown */
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for your restaurant…"
              className="h-11 w-full rounded-2xl border border-border bg-foreground/[0.04] px-4 pr-9 text-foreground placeholder:text-muted/70 outline-none focus:ring-2 focus:ring-primary/30"
            />
            {loading && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="h-4 w-4 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              </span>
            )}
          </div>

          {suggestions.length > 0 && (
            <ul
              ref={listRef}
              className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
            >
              {suggestions.map((s) => (
                <li key={s.place_id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(s)}
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.06] focus:outline-none"
                  >
                    <p className="text-sm font-medium text-foreground">{s.primary_text}</p>
                    {s.secondary_text && (
                      <p className="mt-0.5 text-xs text-muted">{s.secondary_text}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}
    </div>
  );
}
