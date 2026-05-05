import type { TechStackItem } from '../../types';
import { Badge } from '../common/Badge';

interface Props {
  items: TechStackItem[];
}

export function TechStack({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Tech Stack
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item.name} variant={item.category === 'language' ? 'primary' : 'default'}>
            {item.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
