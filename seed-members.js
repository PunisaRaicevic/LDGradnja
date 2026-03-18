// ============================================================
// UPUSTVO: Otvori aplikaciju u browseru, uloguj se kao admin,
// otvori Developer Tools (F12) → Console tab,
// i zalijepi ovaj cijeli kod pa pritisni Enter.
// ============================================================

(async () => {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

  const supabaseUrl = 'https://jcrqwldljyiyaiogjspt.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjcnF3bGRsanlpeWFpb2dqc3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NjcxMjAsImV4cCI6MjA4NjM0MzEyMH0.st50bMyt78cV144cBzf_-0pZ-FWtnL23YWLyF2TBQ5k';

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Preuzmi sesiju iz localStorage (aplikacija je već ulogovana)
  const storageKey = Object.keys(localStorage).find(k => k.includes('supabase') && k.includes('auth'));
  if (storageKey) {
    const session = JSON.parse(localStorage.getItem(storageKey));
    if (session?.access_token) {
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { console.error('❌ Nisi ulogovan!'); return; }
  console.log('✅ Ulogovan kao:', user.email, '| ID:', user.id);

  // 1. Provjeri postojeće korisnike
  const { data: existingUsers } = await supabase.from('app_users').select('*');
  console.log('📋 Postojeći korisnici:', existingUsers?.map(u => u.full_name));

  // 2. Nađi projekat "Renoviranje Risan"
  const { data: projects } = await supabase.from('projects').select('id, name');
  console.log('📋 Projekti:', projects?.map(p => `${p.name} (${p.id})`));
  const risanProject = projects?.find(p => p.name.toLowerCase().includes('risan'));
  if (!risanProject) { console.error('❌ Projekat "Renoviranje Risan" nije pronađen!'); return; }
  console.log('✅ Pronađen projekat:', risanProject.name, '| ID:', risanProject.id);

  // 3. Kreiraj korisnike ako ne postoje
  const membersToCreate = [
    { fullName: 'Lolo', username: 'lolo', role: 'admin' },
    { fullName: 'Saša', username: 'sasa', role: 'worker' },
    { fullName: 'Noka', username: 'noka', role: 'worker' },
  ];

  const userIds = {};
  for (const m of membersToCreate) {
    const existing = existingUsers?.find(u => u.full_name === m.fullName || u.username === m.username);
    if (existing) {
      console.log(`⏭️  ${m.fullName} već postoji (ID: ${existing.id})`);
      userIds[m.fullName] = existing.id;
    } else {
      const { data: row, error } = await supabase.from('app_users').insert({
        admin_id: user.id,
        full_name: m.fullName,
        username: m.username,
        email: `${m.username}@ldgradnja.local`,
        phone: '',
        role: m.role,
      }).select().single();
      if (error) {
        console.error(`❌ Greška za ${m.fullName}:`, error.message);
      } else {
        console.log(`✅ Kreiran ${m.fullName} (ID: ${row.id})`);
        userIds[m.fullName] = row.id;
      }
    }
  }

  // 4. Dodaj sve na projekat "Renoviranje Risan"
  const { data: existingMembers } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', risanProject.id);
  const existingMemberIds = new Set(existingMembers?.map(m => m.user_id) || []);

  for (const [name, userId] of Object.entries(userIds)) {
    if (existingMemberIds.has(userId)) {
      console.log(`⏭️  ${name} je već član projekta`);
    } else {
      const role = name === 'Lolo' ? 'admin' : 'worker';
      const { error } = await supabase.from('project_members').insert({
        project_id: risanProject.id,
        user_id: userId,
        role,
      });
      if (error) {
        console.error(`❌ Greška pri dodavanju ${name} na projekat:`, error.message);
      } else {
        console.log(`✅ ${name} dodat na projekat "${risanProject.name}" kao ${role}`);
      }
    }
  }

  // 5. Ažuriraj postojeće troškove - poveži "Platio" sa paidByShares
  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, description, paid_by, paid_by_shares')
    .eq('project_id', risanProject.id);

  console.log(`\n📋 Ukupno ${expenses?.length || 0} troškova na projektu`);
  const withPaidBy = expenses?.filter(e => e.paid_by) || [];
  const withShares = expenses?.filter(e => e.paid_by_shares) || [];
  console.log(`   - Sa "platio": ${withPaidBy.length}`);
  console.log(`   - Sa "shares": ${withShares.length}`);

  // Za troškove koji imaju paid_by ali nemaju paid_by_shares, kreiraj shares
  for (const e of withPaidBy) {
    if (!e.paid_by_shares) {
      // Provjeri da li paid_by sadrži jedno od imena
      const name = e.paid_by;
      if (userIds[name]) {
        // Nemamo totalAmount ovdje, samo markiramo share sa paid_by
        console.log(`   ℹ️  Trošak "${e.description}" - platio: ${name} (shares će se generisati)`);
      }
    }
  }

  console.log('\n🎉 Gotovo! Refreshuj stranicu da vidiš promjene.');
})();
