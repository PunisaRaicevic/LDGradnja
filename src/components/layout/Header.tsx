import { useLocation, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Home, Menu } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { projects } = useProjectStore();
  const pathParts = location.pathname.split('/').filter(Boolean);

  const breadcrumbs = buildBreadcrumbs(pathParts, projects);

  // Show back button when not on home page
  const showBack = pathParts.length > 0;

  const handleBack = () => {
    // Navigate to parent path
    if (pathParts.length >= 3) {
      // e.g. /projects/:id/expenses -> /projects/:id
      navigate(`/${pathParts.slice(0, 2).join('/')}`);
    } else if (pathParts.length === 2) {
      // e.g. /projects/:id -> /projects
      navigate(`/${pathParts[0]}`);
    } else {
      navigate('/');
    }
  };

  return (
    <header className="h-14 border-b bg-white flex items-center px-3 lg:px-6 sticky top-0 z-10">
      {/* Mobile: back button + hamburger */}
      <div className="flex items-center lg:hidden">
        {showBack && (
          <button
            onClick={handleBack}
            className="p-2 -ml-1 mr-1 rounded-md hover:bg-muted cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={onMobileMenuToggle}
          className="p-2 rounded-md hover:bg-muted cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex items-center gap-1 text-sm overflow-x-auto ml-2 lg:ml-0">
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
