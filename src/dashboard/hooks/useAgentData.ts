import { useState, useEffect } from 'react';

export const useAgentData = (agentId: string) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/agents/${agentId}`);
        if (!response.ok) throw new Error('Failed to fetch agent data');
        setData(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [agentId]);

  return { data, error, isLoading };
}; 