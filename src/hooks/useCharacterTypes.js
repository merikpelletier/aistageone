import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useCharacterTypes() {
  const { data = [] } = useQuery({
    queryKey: ['characterTypes'],
    queryFn: () => base44.entities.CharacterType.list('order', 100),
    staleTime: 30000,
  });
  return data.map(ct => ct.name);
}