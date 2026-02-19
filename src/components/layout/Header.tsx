import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home, Menu } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const location = useLocation();
  const { projects } = useProjectStore();
  const pathParts = location.pathname.split('/').filter(Boolean);

  const breadcrumbs = buildBreadcrumbs(pathParts, projects);

  return (
    <header className="h-14 border-b bg-white flex items-center px-3 lg:px-6 sticky top-0 z-10">
      {/* Mobile hamburger */}
      <button
        onClick={onMobileMenuToggle}
        className="p-2 -ml-1 mr-2 rounded-md hover:bg-muted lg:hidden cursor-pointer"
      >
        <Menu className="h-5 w-5" />
      </button>

      <nav className="flex items-center gap-1 text-sm overflow-x-auto">
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
          <Home className="h-4 w-4" />
        </Link>
        {breadcrumbs.map((crumb, i) => (
          <div key={i} className="flex items-center gap-1 flex-shrink-0">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            {crumb.to ? (
              <Link to={crumb.to} className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium whitespace-nowrap">{crumb.label}</span>
            )}
          </div>
        ))}
      </nav>
    </header>
  );
}

interface Breadcrumb {
  label: string;
  to?: string;
}

const moduleLabels: Record<string, string> = {
  drawings: 'Crteži i planovi',
  bill: 'Predmjer radova',
  situations: 'Privremene situacije',
  diary: 'Građevinska knjiga',
  expenses: 'Troškovnik',
  contracts: 'Ugovori',
  tasks: 'Zadaci',
  orders: 'Nabavka',
  photos: 'Fotografije',
};

function buildBreadcrumbs(
  parts: string[],
  projects: { id: string; name: string }[]
): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [];

  if (parts[0] === 'projects') {
    crumbs.push({ label: 'Projekti', to: parts.length > 1 ? '/projects' : undefined });

    if (parts[1]) {
      const project = projects.find((p) => p.id === parts[1]);
      const projectName = project?.name || parts[1];
      crumbs.push({
        label: projectName,
        to: parts.length > 2 ? `/projects/${parts[1]}` : undefined,
      });

      if (parts[2]) {
        const moduleLabel = moduleLabels[parts[2]] || parts[2];
        crumbs.push({ label: moduleLabel });
      }
    }
  }

  return crumbs;
}
