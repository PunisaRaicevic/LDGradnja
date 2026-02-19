import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProjectStore } from '@/store/useProjectStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, FolderOpen, MapPin, Calendar, User } from 'lucide-react';
import { formatDate } from '@/lib/utils';

const statusVariant: Record<string, 'default' | 'success' | 'warning'> = {
  active: 'success',
  completed: 'default',
  paused: 'warning',
};

const statusLabel: Record<string, string> = {
  active: 'Aktivan',
  completed: 'Završen',
  paused: 'Pauziran',
};

export default function Dashboard() {
  const { projects, loadProjects, loading } = useProjectStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const activeProjects = projects.filter((p) => p.status === 'active');
  const completedProjects = projects.filter((p) => p.status === 'completed');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Pregled svih projekata</p>
        </div>
        <Link to="/projects">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novi projekat
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ukupno projekata</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{projects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aktivni projekti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{activeProjects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Završeni projekti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completedProjects.length}</div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-semibold mb-4">Aktivni projekti</h2>
      {loading ? (
        <p className="text-muted-foreground">Učitavanje...</p>
      ) : activeProjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nema aktivnih projekata</p>
            <Link to="/projects" className="mt-4 inline-block">
              <Button variant="outline">Kreiraj prvi projekat</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeProjects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <Badge variant={statusVariant[project.status]}>
                      {statusLabel[project.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{project.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{project.investor}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(project.startDate)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
