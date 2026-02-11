import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Building2 } from 'lucide-react';

export default function Login() {
  const { login, register, loading } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      setError('Unesite email i lozinku');
      return;
    }
    if (password.length < 6) {
      setError('Lozinka mora imati najmanje 6 karaktera');
      return;
    }

    if (isRegister) {
      const err = await register(email, password);
      if (err) {
        setError(err);
      } else {
        setSuccess('Registracija uspjesna! Provjerite email za potvrdu.');
      }
    } else {
      const err = await login(email, password);
      if (err) {
        setError(err);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-primary rounded-xl flex items-center justify-center">
              <Building2 className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">LDGradnja</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Upravljanje gradjevinskim projektima
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vas@email.com"
                autoComplete="email"
              />
            </div>
            <div>
              <Label>Lozinka</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Najmanje 6 karaktera"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-green-600 bg-green-50 rounded-lg p-3">
                {success}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isRegister ? 'Registruj se' : 'Prijavi se'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                className="text-sm text-primary hover:underline cursor-pointer"
                onClick={() => { setIsRegister(!isRegister); setError(null); setSuccess(null); }}
              >
                {isRegister ? 'Vec imate nalog? Prijavite se' : 'Nemate nalog? Registrujte se'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
