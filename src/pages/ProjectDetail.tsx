import { useEffect } from 'react';
import { Link, useParams, Outlet, useLocation } from 'react-router-dom';
import { useProjectStore } from '@/store/useProjectStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Calculator, ClipboardList, FileSignature,
  Receipt, CheckSquare, ShoppingCart, Camera, MapPin, Calendar, User,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

const statusLabel: Record<string, string> = {
  active: 'Aktivan',
  completed: 'Završen',
  paused: 'Pauziran',
};
const statusVariant: Record<string, 'success' | 'default' | 'warning'> = {
  active: 'success',
  completed: 'default',
  paused: 'warning',
};

const modules = [
  { to: 'drawings', icon: FileText, label: 'Crteži i planovi', desc: 'Upload i pregled tehničke dokumentacije' },
  { to: 'bill', icon: Calculator, label: 'Predmjer radova', desc: 'Stavke radova sa cijenama' },
  { to: 'situations', icon: ClipboardList, label: 'Privremene situacije', desc: 'Obračun izvršenih radova' },
  { to: 'diary', icon: FileSignature, label: 'Građevinska knjiga', desc: 'Dnevnik građevinskog objekta' },
  { to: 'expenses', icon: Receipt, label: 'Troškovnik', desc: 'Evidencija troškova i računa' },
  { to: 'contracts', icon: FileSignature, label: 'Ugovori', desc: 'Ugovori sa investitorima i podizvođačima' },
  { to: 'tasks', icon: CheckSquare, label: 'Zadaci', desc: 'Upravljanje zadacima i komunikacija' },
  { to: 'orders', icon: ShoppingCart, label: 'Nabavka', desc: 'Porudžbenice materijala' },
  { to: 'photos', icon: Camera, label: 'Fotografije', desc: 'Galerija fotografija sa terena' },
];

export default function ProjectDetail() {
  const { projectId } = useParams();
  const location = useLocation();
  const { projects, loadProjects } = useProjectStore();

  useEffect(() => {
    if (projects.length === 0) loadProjects();
  }, [projects.length, loadProjects]);

  const project = projects.find((p) => p.id === projectId);
  const isModulePage = location.pathname.split('/').length > 3;

  if (!project) {
    return <p className="text-muted-foreground">Projekat nije pronađen.</p>;
  }

  if (isModulePage) {
    return <Outlet />;
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl lg:text-3xl font-bold">{project.name}</h1>
          <Badge variant={statusVariant[project.status]}>{statusLabel[project.status]}</Badge>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{project.location}</span>
          <span className="flex items-center gap-1"><User className="h-4 w-4" />{project.investor}</span>
          <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{formatDate(project.startDate)}</span>
        </div>
        {project.description && (
          <p className="text-muted-foreground mt-2">{project.description}</p>
        )}
      </div>

      <h2 className="text-xl font-semibold mb-4">Moduli</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => (
          <Link key={mod.to} to={`/projects/${projectId}/${mod.to}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <mod.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{mod.label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{mod.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
