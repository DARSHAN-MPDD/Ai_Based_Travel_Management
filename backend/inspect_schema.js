const { pool } = require('./config/database');

(async () => {
  try {
    const [tables] = await pool.execute('SHOW TABLES');
    console.log('Tables:', tables.map(r => Object.values(r)[0]).join(', '));

    console.log('\n--- bookings ---');
    const [b] = await pool.execute('SHOW COLUMNS FROM bookings');
    b.forEach(c => console.log(`  ${c.Field} | ${c.Type} | Null:${c.Null} | Default:${c.Default} | Extra:${c.Extra}`));

    console.log('\n--- users ---');
    const [u] = await pool.execute('SHOW COLUMNS FROM users');
    u.forEach(c => console.log(`  ${c.Field} | ${c.Type} | Null:${c.Null} | Default:${c.Default} | Extra:${c.Extra}`));

    console.log('\n--- travel_packages ---');
    const [p] = await pool.execute('SHOW COLUMNS FROM travel_packages');
    p.forEach(c => console.log(`  ${c.Field} | ${c.Type} | Null:${c.Null} | Default:${c.Default} | Extra:${c.Extra}`));

    console.log('\n--- destinations ---');
    const [d] = await pool.execute('SHOW COLUMNS FROM destinations');
    d.forEach(c => console.log(`  ${c.Field} | ${c.Type} | Null:${c.Null} | Default:${c.Default} | Extra:${c.Extra}`));

    console.log('\n--- bookings count ---');
    const [cnt] = await pool.execute('SELECT COUNT(*) as c FROM bookings');
    console.log('  bookings rows:', cnt[0].c);

    await pool.end();
  } catch (e) {
    console.error('ERROR:', e.message);
    await pool.end();
    process.exit(1);
  }
})();