import { NavLink, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Calculator,
  ClipboardList,
  Receipt,
  FileSignature,
  CheckSquare,
  ShoppingCart,
  Camera,
  Building2,
  ChevronLeft,
  Menu,
  LogOut,
  User,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

const mainNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderOpen, label: 'Projekti' },
  { to: '/users', icon: Users, label: 'Korisnici' },
];

const projectNav = [
  { to: 'drawings', icon: FileText, label: 'Crteži i planovi' },
  { to: 'bill', icon: Calculator, label: 'Predmjer radova' },
  { to: 'situations', icon: ClipboardList, label: 'Privremene situacije' },
  { to: 'diary', icon: FileSignature, label: 'Građevinska knjiga' },
  { to: 'expenses', icon: Receipt, label: 'Troškovnik' },
  { to: 'contracts', icon: FileSignature, label: 'Ugovori' },
  { to: 'tasks', icon: CheckSquare, label: 'Zadaci' },
  { to: 'orders', icon: ShoppingCart, label: 'Nabavka' },
  { to: 'photos', icon: Camera, label: 'Fotografije' },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { projectId } = useParams();
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();

  const handleNavClick = () => {
    // Close mobile menu when navigating
    onMobileClose();
  };

  return (
    <aside
      className={cn(
        'h-screen bg-foreground text-white flex flex-col transition-all duration-300',
        // Desktop: static sidebar
        'hidden md:flex md:sticky md:top-0',
        collapsed ? 'md:w-16' : 'md:w-64',
        // Mobile: overlay drawer
        mobileOpen && 'fixed inset-y-0 left-0 z-50 flex w-64'
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {(!collapsed || mobileOpen) && (
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary-foreground" />
            <span className="font-bold text-lg">LDGradnja</span>
          </div>
        )}
        {/* Desktop: collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-white/10 cursor-pointer hidden md:block"
        >
          {collapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        {/* Mobile: close button */}
        <button
          onClick={onMobileClose}
          className="p-1 rounded hover:bg-white/10 cursor-pointer md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-3 mb-2">
          {(!collapsed || mobileOpen) && (
            <span className="text-xs uppercase text-white/50 px-2">Navigacija</span>
          )}
        </div>
        {mainNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={handleNavClick}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-md transition-colors',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {(!collapsed || mobileOpen) && <span className="text-sm">{item.label}</span>}
          </NavLink>
        ))}

        {projectId && (
          <>
            <div className="px-3 mt-6 mb-2">
              {(!collapsed || mobileOpen) && (
                <span className="text-xs uppercase text-white/50 px-2">Moduli projekta</span>
              )}
            </div>
            {projectNav.map((item) => (
              <NavLink
                key={item.to}
                to={`/projects/${projectId}/${item.to}`}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-md transition-colors',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )
                }
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {(!collapsed || mobileOpen) && <span className="text-sm">{item.label}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User & Logout */}
      <div className="border-t border-white/10 p-3">
        {(!collapsed || mobileOpen) ? (
          <div className="flex items-center gap-2 px-2 mb-2">
            <User className="h-4 w-4 text-white/50 flex-shrink-0" />
            <span className="text-xs text-white/50 truncate">{user?.email}</span>
          </div>
        ) : null}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2 w-full rounded-md text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {(!collapsed || mobileOpen) && <span className="text-sm">Odjavi se</span>}
        </button>
      </div>
    </aside>
  );
}
