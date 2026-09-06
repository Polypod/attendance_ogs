"use client";

import { Input } from "@/components/ui/input";

type Props = {
  from: string;
  to: string;
  search: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onSearchChange: (value: string) => void;
};

export function DateRangeSearchPanel({ from, to, search, onFromChange, onToChange, onSearchChange }: Props) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="from" className="block text-sm font-medium mb-1">
            From
          </label>
          <Input id="from" type="date" value={from} onChange={(e) => onFromChange(e.target.value)} />
        </div>

        <div>
          <label htmlFor="to" className="block text-sm font-medium mb-1">
            To
          </label>
          <Input id="to" type="date" value={to} onChange={(e) => onToChange(e.target.value)} />
        </div>
      </div>

      <div>
        <label htmlFor="search" className="block text-sm font-medium mb-1">
          Search
        </label>
        <Input
          id="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Sök medlemmar, klasser, instruktörer..."
        />
      </div>
    </>
  );
}
