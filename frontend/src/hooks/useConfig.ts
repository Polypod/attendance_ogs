// frontend/src/hooks/useConfig.ts - Hook to fetch system configuration

import { useEffect, useState } from 'react';

export interface CategoryConfig {
  value: string;
  label: string;
  description: string;
  order: number;
}

export interface BeltLevelConfig {
  value: string;
  label: string;
  rank: number;
  color: string;
}

export interface SystemConfig {
  categories: CategoryConfig[];
  beltLevels: BeltLevelConfig[];
}

export function useConfig() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/config`);

        if (!response.ok) {
          throw new Error('Failed to fetch configuration');
        }

        const data = await response.json();
        setConfig(data.data);
      } catch (err: any) {
        setError(err.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  return { config, loading, error };
}
