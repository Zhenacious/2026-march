import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { loadBodyWeights, fetchBodyWeights } from '../lib/bodyWeight';

// Returns body weight entries. Starts from the local cache instantly, then
// refreshes from the database once the logged-in user is known.
export function useBodyWeights() {
  const { user } = useAuth();
  const [weights, setWeights] = useState(() => loadBodyWeights());

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchBodyWeights(user.id).then(({ weights: rows }) => {
      if (!cancelled) setWeights(rows);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  return [weights, setWeights];
}
