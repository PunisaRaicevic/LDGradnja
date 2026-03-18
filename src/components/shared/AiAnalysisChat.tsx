import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, Loader2, Sparkles, X, Trash2 } from 'lucide-react';
import type { Expense } from '@/types';
import { analyzeExpenses, type ChatMessage } from '@/lib/ai-analyze';

const SUGGESTED_QUESTIONS = [
  'Ko je koliko platio do sada?',
  'Koliko smo ukupno potrošili?',
  'Koji su najveći troškovi?',
  'Uporedi troškove po kategorijama',
  'Koliko troškova imamo po mjesecima?',
  'Koji dobavljač nam je najskuplji?',
];

interface AiAnalysisChatProps {
  expenses: Expense[];
  open: boolean;
  onClose: () => void;
}

export default function AiAnalysisChat({ expenses, open, onClose }: AiAnalysisChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await analyzeExpenses(expenses, text.trim(), messages);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Greška: ${err.message || 'Nije moguće dobiti odgovor. Provjerite internet konekciju.'}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (!open) return null;

  return (
    <Card className="border-2 border-primary/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/10 to-primary/5 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Analiza troškova</h3>
            <p className="text-xs text-muted-foreground">{expenses.length} troškova učitano</p>
          </div>
        </div>
        <div className="flex gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMessages([])} title="Obriši istoriju">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="h-[400px] overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-center py-6">
            <Sparkles className="h-10 w-10 mx-auto mb-3 text-primary/40" />
            <p className="text-sm text-muted-foreground mb-4">
              Pitajte me bilo šta o troškovima projekta
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted rounded-bl-md'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              ) : (
                <span>{msg.content}</span>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analiziram podatke...
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t bg-muted/30">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pitajte nešto o troškovima..."
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={!input.trim() || loading} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}
